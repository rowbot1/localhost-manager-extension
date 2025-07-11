// Premium Features Module
class PremiumFeatures {
  constructor() {
    this.logs = new Map(); // port -> array of logs
    this.metrics = new Map(); // port -> metrics object
    this.logStreams = new Map(); // port -> EventSource
    this.metricsInterval = null;
    this.isPremium = false;
  }

  async initialize() {
    // Check premium status
    const { premiumKey } = await chrome.storage.local.get('premiumKey');
    this.isPremium = await this.validatePremiumKey(premiumKey);
    
    if (this.isPremium) {
      this.startMetricsCollection();
      this.setupRequestInterceptor();
    }
    
    return this.isPremium;
  }

  async validatePremiumKey(key) {
    // In production, validate against server
    // For now, check if key matches pattern
    return key && /^LHM-PRO-[A-Z0-9]{8}$/.test(key);
  }

  // Log Aggregation System
  startLogStream(port, protocol) {
    if (!this.isPremium) return;
    
    // Create log endpoint that services can POST to
    const logEndpoint = `${protocol}://localhost:${port}/__localhost_manager_logs__`;
    
    // Store logs for this service
    if (!this.logs.has(port)) {
      this.logs.set(port, []);
    }
    
    // In real implementation, this would set up WebSocket or SSE
    // For now, we'll poll common log endpoints
    this.pollServiceLogs(port, protocol);
  }

  async pollServiceLogs(port, protocol) {
    const commonLogEndpoints = [
      '/__logs__',
      '/logs',
      '/api/logs',
      '/_logs',
      '/debug/logs'
    ];
    
    for (const endpoint of commonLogEndpoints) {
      try {
        const response = await fetch(`${protocol}://localhost:${port}${endpoint}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        });
        
        if (response.ok) {
          const logs = await response.json();
          this.processLogs(port, logs);
          break;
        }
      } catch (e) {
        // Service doesn't expose logs at this endpoint
      }
    }
  }

  processLogs(port, newLogs) {
    const serviceLogs = this.logs.get(port) || [];
    const processedLogs = Array.isArray(newLogs) ? newLogs : [newLogs];
    
    processedLogs.forEach(log => {
      serviceLogs.push({
        timestamp: log.timestamp || new Date().toISOString(),
        level: log.level || 'info',
        message: log.message || JSON.stringify(log),
        service: `localhost:${port}`,
        ...log
      });
    });
    
    // Keep last 1000 logs per service
    if (serviceLogs.length > 1000) {
      serviceLogs.splice(0, serviceLogs.length - 1000);
    }
    
    this.logs.set(port, serviceLogs);
    
    // Notify UI of new logs
    chrome.runtime.sendMessage({
      type: 'NEW_LOGS',
      port,
      logs: processedLogs
    });
  }

  // Health Monitoring System
  startMetricsCollection() {
    if (this.metricsInterval) return;
    
    this.metricsInterval = setInterval(() => {
      this.collectAllMetrics();
    }, 5000); // Every 5 seconds
  }

  async collectAllMetrics() {
    const services = await this.getActiveServices();
    
    for (const service of services) {
      await this.collectServiceMetrics(service);
    }
  }

  async collectServiceMetrics(service) {
    const { port, protocol } = service;
    const startTime = performance.now();
    
    let metrics = this.metrics.get(port) || {
      port,
      protocol,
      uptime: 0,
      totalRequests: 0,
      errorCount: 0,
      responseTimes: [],
      avgResponseTime: 0,
      status: 'unknown',
      lastCheck: null,
      history: []
    };
    
    try {
      // Health check
      const response = await fetch(`${protocol}://localhost:${port}/`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(3000)
      });
      
      const responseTime = performance.now() - startTime;
      
      metrics.status = response.ok ? 'healthy' : 'unhealthy';
      metrics.lastCheck = new Date().toISOString();
      metrics.responseTimes.push(responseTime);
      metrics.totalRequests++;
      
      // Keep last 100 response times
      if (metrics.responseTimes.length > 100) {
        metrics.responseTimes.shift();
      }
      
      // Calculate average
      metrics.avgResponseTime = metrics.responseTimes.reduce((a, b) => a + b, 0) / metrics.responseTimes.length;
      
      // Update history for graphs
      metrics.history.push({
        timestamp: Date.now(),
        responseTime,
        status: metrics.status
      });
      
      // Keep last hour of history
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      metrics.history = metrics.history.filter(h => h.timestamp > oneHourAgo);
      
    } catch (error) {
      metrics.status = 'down';
      metrics.errorCount++;
      metrics.lastCheck = new Date().toISOString();
    }
    
    this.metrics.set(port, metrics);
    
    // Check for alerts
    this.checkHealthAlerts(service, metrics);
  }

  checkHealthAlerts(service, metrics) {
    // Alert if service goes down
    if (metrics.status === 'down' && this.lastStatus?.[service.port] === 'healthy') {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Service Down',
        message: `${service.service} on port ${service.port} is not responding`,
        priority: 2
      });
    }
    
    // Alert if response time is too high
    if (metrics.avgResponseTime > 1000) { // 1 second
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon-48.png',
        title: 'Slow Response',
        message: `${service.service} on port ${service.port} is responding slowly (${Math.round(metrics.avgResponseTime)}ms)`,
        priority: 1
      });
    }
    
    this.lastStatus = this.lastStatus || {};
    this.lastStatus[service.port] = metrics.status;
  }

  // Environment Variable Management
  async loadEnvironmentVariables(projectPath) {
    if (!this.isPremium) return {};
    
    // This would integrate with a native component in production
    // For now, return mock data
    return {
      development: {
        NODE_ENV: 'development',
        API_URL: 'http://localhost:3000',
        DB_HOST: 'localhost',
        DB_PORT: '5432'
      },
      staging: {
        NODE_ENV: 'staging',
        API_URL: 'https://staging.api.com',
        DB_HOST: 'staging.db.com',
        DB_PORT: '5432'
      }
    };
  }

  async saveEnvironmentVariables(projectPath, environment, variables) {
    if (!this.isPremium) return false;
    
    await chrome.storage.local.set({
      [`env_${projectPath}_${environment}`]: variables
    });
    
    return true;
  }

  // Request Interceptor
  setupRequestInterceptor() {
    if (!chrome.webRequest) return;
    
    chrome.webRequest.onBeforeRequest.addListener(
      (details) => {
        // Track API calls
        const url = new URL(details.url);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          this.trackApiCall(details);
        }
      },
      { urls: ["http://localhost/*", "http://127.0.0.1/*", "https://localhost/*", "https://127.0.0.1/*"] },
      ["requestBody"]
    );
  }

  trackApiCall(details) {
    const url = new URL(details.url);
    const port = url.port || (url.protocol === 'https:' ? 443 : 80);
    
    const metrics = this.metrics.get(parseInt(port)) || {};
    metrics.apiCalls = metrics.apiCalls || [];
    
    metrics.apiCalls.push({
      timestamp: Date.now(),
      method: details.method,
      path: url.pathname,
      type: details.type
    });
    
    // Keep last 100 API calls
    if (metrics.apiCalls.length > 100) {
      metrics.apiCalls = metrics.apiCalls.slice(-100);
    }
    
    this.metrics.set(parseInt(port), metrics);
  }

  // Get data for UI
  async getServiceLogs(port) {
    return this.logs.get(port) || [];
  }

  async getServiceMetrics(port) {
    return this.metrics.get(port) || null;
  }

  async getAllMetrics() {
    return Array.from(this.metrics.values());
  }

  async getActiveServices() {
    // Get from main background script
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_SERVICES' }, (response) => {
        resolve(response.services || []);
      });
    });
  }
}

// Export for use in background script
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PremiumFeatures;
}