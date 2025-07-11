// Advanced Features Module
class AdvancedFeatures {
  constructor() {
    this.requestHistory = new Map(); // port -> array of requests
    this.serviceDependencies = new Map(); // service -> dependencies
    this.performanceProfiles = new Map(); // port -> performance data
    this.apiEndpoints = new Map(); // port -> discovered endpoints
  }

  // Smart Service Grouping
  analyzeServiceRelationships(services) {
    const groups = {
      frontend: [],
      backend: [],
      database: [],
      tools: [],
      microservices: new Map() // group by common prefix
    };

    services.forEach(service => {
      // Detect microservices by naming patterns
      const nameMatch = service.service.match(/^([\w-]+)-(api|service|frontend|backend|db)/i);
      if (nameMatch) {
        const projectName = nameMatch[1];
        if (!groups.microservices.has(projectName)) {
          groups.microservices.set(projectName, []);
        }
        groups.microservices.get(projectName).push(service);
      }

      // Categorize by type
      if (this.isFrontendService(service)) {
        groups.frontend.push(service);
      } else if (this.isBackendService(service)) {
        groups.backend.push(service);
      } else if (this.isDatabaseService(service)) {
        groups.database.push(service);
      } else {
        groups.tools.push(service);
      }
    });

    return groups;
  }

  isFrontendService(service) {
    const frontendIndicators = ['React', 'Vue', 'Angular', 'Vite', 'Webpack', 'Next.js'];
    return frontendIndicators.some(indicator => 
      service.service.includes(indicator) || 
      [3000, 3001, 4200, 5173, 8080].includes(service.port)
    );
  }

  isBackendService(service) {
    const backendIndicators = ['Express', 'Django', 'Flask', 'Rails', 'API', 'GraphQL'];
    return backendIndicators.some(indicator => 
      service.service.includes(indicator) || 
      [5000, 8000, 8001, 4000].includes(service.port)
    );
  }

  isDatabaseService(service) {
    const dbIndicators = ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch'];
    return dbIndicators.some(indicator => 
      service.service.includes(indicator) || 
      [27017, 5432, 3306, 6379, 9200].includes(service.port)
    );
  }

  // Request Interceptor & Debugger
  async interceptRequest(details) {
    const url = new URL(details.url);
    const port = parseInt(url.port || (url.protocol === 'https:' ? 443 : 80));
    
    if (!this.requestHistory.has(port)) {
      this.requestHistory.set(port, []);
    }

    const request = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      method: details.method,
      url: details.url,
      path: url.pathname,
      query: Object.fromEntries(url.searchParams),
      headers: details.requestHeaders || {},
      type: details.type,
      initiator: details.initiator,
      startTime: performance.now()
    };

    this.requestHistory.get(port).push(request);
    
    // Keep last 100 requests per service
    const requests = this.requestHistory.get(port);
    if (requests.length > 100) {
      requests.shift();
    }

    return request;
  }

  // Performance Profiler
  profileServicePerformance(service, metrics) {
    const profile = {
      timestamp: Date.now(),
      avgResponseTime: metrics.avgResponseTime,
      p95ResponseTime: this.calculatePercentile(metrics.responseTimes, 95),
      p99ResponseTime: this.calculatePercentile(metrics.responseTimes, 99),
      requestsPerSecond: this.calculateRPS(metrics),
      errorRate: (metrics.errorCount / metrics.totalRequests) * 100,
      healthScore: this.calculateHealthScore(metrics),
      bottlenecks: this.detectBottlenecks(metrics),
      recommendations: this.generateRecommendations(metrics)
    };

    this.performanceProfiles.set(service.port, profile);
    return profile;
  }

  calculatePercentile(times, percentile) {
    if (!times || times.length === 0) return 0;
    const sorted = [...times].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }

  calculateRPS(metrics) {
    if (!metrics.history || metrics.history.length < 2) return 0;
    const timeSpan = (metrics.history[metrics.history.length - 1].timestamp - 
                     metrics.history[0].timestamp) / 1000;
    return metrics.totalRequests / timeSpan;
  }

  calculateHealthScore(metrics) {
    let score = 100;
    
    // Deduct for high response times
    if (metrics.avgResponseTime > 1000) score -= 20;
    else if (metrics.avgResponseTime > 500) score -= 10;
    
    // Deduct for errors
    const errorRate = (metrics.errorCount / metrics.totalRequests) * 100;
    score -= errorRate * 2;
    
    // Deduct for downtime
    if (metrics.status === 'down') score -= 50;
    else if (metrics.status === 'unhealthy') score -= 25;
    
    return Math.max(0, Math.min(100, score));
  }

  detectBottlenecks(metrics) {
    const bottlenecks = [];
    
    if (metrics.avgResponseTime > 1000) {
      bottlenecks.push({
        type: 'slow_response',
        severity: 'high',
        message: 'Response times exceed 1 second'
      });
    }
    
    if ((metrics.errorCount / metrics.totalRequests) > 0.05) {
      bottlenecks.push({
        type: 'high_error_rate',
        severity: 'high',
        message: 'Error rate exceeds 5%'
      });
    }
    
    const p99 = this.calculatePercentile(metrics.responseTimes, 99);
    if (p99 > metrics.avgResponseTime * 3) {
      bottlenecks.push({
        type: 'response_variance',
        severity: 'medium',
        message: 'High response time variance detected'
      });
    }
    
    return bottlenecks;
  }

  generateRecommendations(metrics) {
    const recommendations = [];
    
    if (metrics.avgResponseTime > 1000) {
      recommendations.push({
        category: 'performance',
        priority: 'high',
        suggestion: 'Consider implementing caching or optimizing database queries'
      });
    }
    
    if ((metrics.errorCount / metrics.totalRequests) > 0.01) {
      recommendations.push({
        category: 'reliability',
        priority: 'high',
        suggestion: 'Investigate error logs and add better error handling'
      });
    }
    
    return recommendations;
  }

  // API Documentation Discovery
  async discoverAPIEndpoints(service) {
    const commonDocs = [
      '/swagger',
      '/api-docs',
      '/docs',
      '/graphql',
      '/api/v1',
      '/_routes',
      '/sitemap.json'
    ];
    
    const discovered = [];
    
    for (const endpoint of commonDocs) {
      try {
        const response = await fetch(`${service.protocol}://localhost:${service.port}${endpoint}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(2000)
        });
        
        if (response.ok) {
          discovered.push({
            path: endpoint,
            type: this.detectDocType(endpoint, response),
            url: `${service.protocol}://localhost:${service.port}${endpoint}`
          });
        }
      } catch (error) {
        // Endpoint not available
      }
    }
    
    this.apiEndpoints.set(service.port, discovered);
    return discovered;
  }

  detectDocType(endpoint, response) {
    if (endpoint.includes('swagger')) return 'swagger';
    if (endpoint.includes('graphql')) return 'graphql';
    if (endpoint.includes('docs')) return 'documentation';
    return 'api';
  }

  // Service Dependencies Visualization Data
  async analyzeDependencies(services) {
    const dependencies = new Map();
    
    for (const service of services) {
      const deps = {
        service: service,
        dependsOn: [],
        dependedBy: []
      };
      
      // Analyze request patterns to detect dependencies
      const requests = this.requestHistory.get(service.port) || [];
      requests.forEach(req => {
        const targetUrl = new URL(req.url);
        const targetPort = parseInt(targetUrl.port);
        
        if (targetPort && targetPort !== service.port) {
          const targetService = services.find(s => s.port === targetPort);
          if (targetService && !deps.dependsOn.includes(targetService)) {
            deps.dependsOn.push(targetService);
          }
        }
      });
      
      dependencies.set(service.port, deps);
    }
    
    // Build reverse dependencies
    dependencies.forEach((deps, port) => {
      deps.dependsOn.forEach(depService => {
        const targetDeps = dependencies.get(depService.port);
        if (targetDeps && !targetDeps.dependedBy.includes(deps.service)) {
          targetDeps.dependedBy.push(deps.service);
        }
      });
    });
    
    return dependencies;
  }

  // Export/Import Configuration
  exportConfiguration(services, settings) {
    const config = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      services: services.map(s => ({
        name: s.customName || s.service,
        port: s.port,
        protocol: s.protocol,
        type: s.service,
        customName: s.customName
      })),
      settings: settings,
      customPorts: settings.customPorts || [],
      serviceGroups: settings.serviceGroups || {},
      environment: this.exportEnvironmentSafe()
    };
    
    return config;
  }

  exportEnvironmentSafe() {
    // Export only non-sensitive environment variable keys
    const safeKeys = ['NODE_ENV', 'PORT', 'API_VERSION', 'DEBUG'];
    const env = {};
    
    // In real implementation, would read from actual env
    safeKeys.forEach(key => {
      if (process.env && process.env[key]) {
        env[key] = process.env[key];
      }
    });
    
    return env;
  }

  importConfiguration(config) {
    if (config.version !== '1.0') {
      throw new Error('Incompatible configuration version');
    }
    
    return {
      services: config.services,
      settings: config.settings,
      customPorts: config.customPorts,
      serviceGroups: config.serviceGroups
    };
  }

  // Quick Actions
  generateQuickActions(service) {
    const actions = [
      {
        id: 'open',
        label: 'Open in Browser',
        icon: '🌐',
        action: () => chrome.tabs.create({ url: `${service.protocol}://localhost:${service.port}` })
      },
      {
        id: 'logs',
        label: 'View Logs',
        icon: '📋',
        action: () => this.focusOnServiceLogs(service)
      },
      {
        id: 'metrics',
        label: 'View Metrics',
        icon: '📊',
        action: () => this.focusOnServiceMetrics(service)
      }
    ];
    
    // Add API docs if discovered
    const apiDocs = this.apiEndpoints.get(service.port);
    if (apiDocs && apiDocs.length > 0) {
      actions.push({
        id: 'api-docs',
        label: 'API Documentation',
        icon: '📖',
        action: () => chrome.tabs.create({ url: apiDocs[0].url })
      });
    }
    
    // Add debugging for slow services
    const profile = this.performanceProfiles.get(service.port);
    if (profile && profile.healthScore < 80) {
      actions.push({
        id: 'debug',
        label: 'Debug Performance',
        icon: '🔍',
        action: () => this.openDebugger(service)
      });
    }
    
    return actions;
  }

  focusOnServiceLogs(service) {
    chrome.runtime.sendMessage({
      type: 'FOCUS_LOGS',
      serviceFilter: `localhost:${service.port}`
    });
  }

  focusOnServiceMetrics(service) {
    chrome.runtime.sendMessage({
      type: 'FOCUS_METRICS',
      port: service.port
    });
  }

  openDebugger(service) {
    const profile = this.performanceProfiles.get(service.port);
    const debugInfo = {
      service: service,
      profile: profile,
      requests: this.requestHistory.get(service.port) || [],
      bottlenecks: profile.bottlenecks,
      recommendations: profile.recommendations
    };
    
    // In real implementation, would open a debug panel
    console.log('Debug Info:', debugInfo);
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AdvancedFeatures;
}