const DEFAULT_PORTS = [
  3000, 3001, 3002, 3003, 3004, 3005,
  4000, 4200, 4300, 4400, 4500,
  5000, 5001, 5173, 5174, 5432, 5500, 5555, 5984,
  6006, 6379, 6380,
  7000, 7001, 7070,
  8000, 8001, 8080, 8081, 8082, 8083, 8084, 8085, 8086, 8087, 8088, 8089,
  8090, 8100, 8200, 8300, 8400, 8500, 8600, 8700, 8800, 8888, 8890,
  9000, 9001, 9090, 9091, 9092, 9093, 9094, 9095, 9096, 9097, 9098, 9099,
  9200, 9222, 9229, 9300, 9999,
  10000, 11211, 19000, 19001, 19002,
  27017, 27018, 27019, 28017
];

const SERVICE_PATTERNS = {
  'React Dev Server': {
    ports: [3000, 3001, 3002],
    paths: ['/', '/static/js/bundle.js'],
    headers: ['x-powered-by', 'webpack']
  },
  'Vue Dev Server': {
    ports: [8080, 8081],
    paths: ['/', '/src/main.js'],
    headers: ['x-powered-by']
  },
  'Angular Dev Server': {
    ports: [4200, 4201],
    paths: ['/', '/vendor.js'],
    content: ['ng-version']
  },
  'Vite Dev Server': {
    ports: [5173, 5174],
    paths: ['/'],
    headers: ['x-powered-by'],
    content: ['Vite']
  },
  'Next.js': {
    ports: [3000, 3001],
    paths: ['/', '/_next/'],
    headers: ['x-powered-by']
  },
  'Node.js/Express': {
    ports: [3000, 4000, 5000, 8000, 8080],
    paths: ['/'],
    headers: ['x-powered-by']
  },
  'Django': {
    ports: [8000, 8001],
    paths: ['/admin/', '/static/'],
    content: ['Django', 'csrfmiddlewaretoken']
  },
  'Flask': {
    ports: [5000, 5001],
    paths: ['/'],
    headers: ['server'],
    content: ['Flask']
  },
  'Rails': {
    ports: [3000],
    paths: ['/', '/rails/info'],
    headers: ['x-powered-by', 'server'],
    content: ['Rails']
  },
  'MongoDB': {
    ports: [27017, 28017],
    paths: ['/'],
    content: ['MongoDB', 'mongo']
  },
  'PostgreSQL': {
    ports: [5432],
    requiresNative: true
  },
  'MySQL': {
    ports: [3306],
    requiresNative: true
  },
  'Redis': {
    ports: [6379],
    requiresNative: true
  },
  'Elasticsearch': {
    ports: [9200, 9300],
    paths: ['/', '/_cluster/health'],
    content: ['elasticsearch', 'cluster_name']
  },
  'Jupyter': {
    ports: [8888, 8889, 8890],
    paths: ['/', '/tree'],
    content: ['Jupyter', 'notebook']
  },
  'Storybook': {
    ports: [6006],
    paths: ['/', '/iframe.html'],
    content: ['Storybook']
  },
  'GraphQL Playground': {
    ports: [4000],
    paths: ['/graphql', '/playground'],
    content: ['GraphQL', 'playground']
  },
  'phpMyAdmin': {
    ports: [8080, 8081],
    paths: ['/phpmyadmin/', '/'],
    content: ['phpMyAdmin', 'pma_']
  },
  'Webpack Dev Server': {
    ports: [8080, 8081, 8082],
    paths: ['/', '/webpack-dev-server'],
    headers: ['x-powered-by'],
    content: ['webpack']
  },
  'CouchDB': {
    ports: [5984],
    paths: ['/', '/_utils'],
    content: ['CouchDB', 'Futon']
  },
  'RabbitMQ': {
    ports: [15672],
    paths: ['/', '/api/overview'],
    content: ['RabbitMQ']
  },
  'Memcached': {
    ports: [11211],
    requiresNative: true
  },
  'MinIO': {
    ports: [9000, 9001],
    paths: ['/', '/minio/health/live'],
    content: ['MinIO']
  }
};

let detectedServices = new Map();
let previousServices = new Map();
let scanInProgress = false;
let lastScanTime = 0;

// Import premium features
let premiumFeatures = null;

chrome.runtime.onInstalled.addListener(() => {
  console.log('LocalHost Manager installed');
  chrome.storage.local.set({ 
    customPorts: [],
    scanInterval: 30,
    enableAutoScan: true,
    serviceAliases: {},
    premiumKey: null,
    notificationsEnabled: true,
    seenServices: {} // Track services that have been seen before
  });
  
  // Initialize premium features
  initializePremiumFeatures();
});

async function checkPort(port, timeout = 2000) {
  const protocols = ['http', 'https'];
  
  for (const protocol of protocols) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      // First try a simple fetch with no-cors to check if port is open
      const response = await fetch(`${protocol}://localhost:${port}/`, {
        method: 'GET',
        mode: 'no-cors',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      // If we get here, the port responded, now try to get more info
      try {
        const headResponse = await fetch(`${protocol}://localhost:${port}/`, {
          method: 'HEAD',
          signal: controller.signal
        });
        
        return {
          port,
          protocol,
          status: headResponse.status,
          headers: Object.fromEntries(headResponse.headers.entries()),
          accessible: true
        };
      } catch (headError) {
        // Port is open but CORS might be blocking HEAD request
        return {
          port,
          protocol,
          status: 200,
          headers: {},
          accessible: true
        };
      }
    } catch (error) {
      // This port/protocol combination didn't work
      continue;
    }
  }
  
  return null;
}

async function identifyService(portInfo) {
  const { port, protocol, headers } = portInfo;
  
  // Try to get the actual page content
  let pageContent = null;
  let pageTitle = null;
  let frameworkName = null;
  
  let isError = false;
  
  try {
    const response = await fetch(`${protocol}://localhost:${port}/`, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,text/plain,*/*'
      }
    });
    
    const text = await response.text();
    
    // First, try to extract meaningful content
    if (text) {
      // Check if it's an error message (common patterns)
      isError = text.includes('Error:') || text.includes('Cannot ') || text.includes('ENOENT') || 
                text.includes('failed') || text.includes('exception') || response.status >= 400;
      
      if (isError) {
        // Extract the error message
        const errorMatch = text.match(/(Error:[^<\n]+|Cannot [^<\n]+|ENOENT[^<\n]+)/i);
        if (errorMatch) {
          pageContent = errorMatch[0].trim();
        }
      }
      
      // If not an error, try to get the title
      if (!pageContent) {
        const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          pageTitle = titleMatch[1].trim()
            .replace(/\s*[\|\-\:]\s*localhost:\d+$/i, '')
            .replace(/^localhost:\d+\s*[\|\-\:]\s*/i, '')
            .trim();
          pageContent = pageTitle;
        }
      }
      
      // If still no content, try to get first heading or text
      if (!pageContent) {
        // Try h1
        const h1Match = text.match(/<h1[^>]*>([^<]+)<\/h1>/i);
        if (h1Match && h1Match[1]) {
          pageContent = h1Match[1].trim();
        } else {
          // Try to get first meaningful text (remove HTML tags)
          const textOnly = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
          if (textOnly.length > 0) {
            // Get first 100 chars of actual content
            pageContent = textOnly.substring(0, 100);
            if (textOnly.length > 100) pageContent += '...';
          }
        }
      }
      
      // Try to identify the framework
      for (const [serviceName, pattern] of Object.entries(SERVICE_PATTERNS)) {
        if (pattern.requiresNative) continue;
        
        if (pattern.content) {
          const hasContent = pattern.content.some(content => 
            text.toLowerCase().includes(content.toLowerCase())
          );
          if (hasContent) {
            frameworkName = serviceName;
            break;
          }
        }
      }
    }
  } catch (error) {
    // If fetch fails, show the error
    pageContent = `Connection failed: ${error.message}`;
    isError = true;
  }
  
  // Return the actual content found
  if (pageContent) {
    return {
      ...portInfo,
      service: pageContent,
      framework: frameworkName || '',
      status: isError ? 'error' : 'running',
      confidence: 'high'
    };
  }
  
  // Fall back to pattern matching if no content found
  for (const [serviceName, pattern] of Object.entries(SERVICE_PATTERNS)) {
    if (pattern.requiresNative) continue;
    
    if (pattern.ports && !pattern.ports.includes(port)) continue;
    
    if (pattern.headers) {
      const hasMatchingHeader = pattern.headers.some(header => 
        Object.keys(headers).some(h => h.toLowerCase() === header.toLowerCase())
      );
      if (hasMatchingHeader) {
        return { ...portInfo, service: serviceName, framework: serviceName, status: 'running', confidence: 'high' };
      }
    }
    
    if (pattern.ports && pattern.ports.includes(port)) {
      return { ...portInfo, service: serviceName, framework: serviceName, status: 'running', confidence: 'medium' };
    }
  }
  
  return { ...portInfo, service: `Port ${port} (No content)`, framework: 'Unknown', status: 'unknown', confidence: 'low' };
}

async function scanPorts() {
  if (scanInProgress) {
    console.log('Scan already in progress');
    return;
  }
  
  scanInProgress = true;
  const startTime = Date.now();
  console.log('Starting port scan...');
  
  try {
    const settings = await chrome.storage.local.get(['customPorts', 'serviceAliases', 'seenServices']);
    const customPorts = settings.customPorts || [];
    const aliases = settings.serviceAliases || {};
    const seenServices = settings.seenServices || {};
    
    const allPorts = [...new Set([...DEFAULT_PORTS, ...customPorts])];
    console.log(`Scanning ${allPorts.length} ports...`);
    const newDetectedServices = new Map();
    
    const checkPromises = allPorts.map(port => checkPort(port, 1500));
    const results = await Promise.allSettled(checkPromises);
    
    const activePortInfos = results
      .filter(result => result.status === 'fulfilled' && result.value !== null)
      .map(result => result.value);
    
    console.log(`Found ${activePortInfos.length} active ports`);
    
    const identifyPromises = activePortInfos.map(portInfo => identifyService(portInfo));
    const identifiedServices = await Promise.all(identifyPromises);
    
    for (const service of identifiedServices) {
      const key = `${service.port}:${service.protocol}`;
      const customAlias = aliases[key];
      if (customAlias) {
        service.customName = customAlias;
      }
      
      // Check if this is a new service (never seen before in any session)
      if (!seenServices[key]) {
        service.isNew = true;
        service.discoveredAt = Date.now();
        seenServices[key] = Date.now();
      } else {
        // Service has been seen before - not new
        service.isNew = false;
        service.discoveredAt = seenServices[key];
      }
      
      newDetectedServices.set(key, service);
    }
    
    // Check for new services before updating
    checkForNewServices(newDetectedServices);
    
    previousServices = detectedServices;
    detectedServices = newDetectedServices;
    lastScanTime = Date.now();
    
    await chrome.storage.local.set({
      detectedServices: Array.from(detectedServices.entries()),
      lastScanTime,
      seenServices // Save the seen services
    });
    
    chrome.runtime.sendMessage({
      type: 'SCAN_COMPLETE',
      services: Array.from(detectedServices.values()),
      scanDuration: Date.now() - startTime
    }).catch(() => {});
    
  } finally {
    scanInProgress = false;
  }
}

chrome.alarms.create('portScan', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'portScan') {
    chrome.storage.local.get('enableAutoScan', (data) => {
      if (data.enableAutoScan !== false) {
        scanPorts();
      }
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.type);
  
  if (request.type === 'SCAN_PORTS') {
    scanPorts().then(() => {
      const services = Array.from(detectedServices.values());
      console.log('Scan complete, found services:', services);
      sendResponse({ 
        success: true, 
        services: services
      });
    }).catch(error => {
      console.error('Scan error:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (request.type === 'GET_SERVICES') {
    chrome.storage.local.get(['detectedServices', 'lastScanTime'], (data) => {
      const services = data.detectedServices ? 
        data.detectedServices.map(([_, service]) => service) : [];
      console.log('Returning stored services:', services);
      
      // Check if any services are still marked as new
      const hasNewServices = services.some(service => service.isNew);
      if (!hasNewServices) {
        // Clear badge if no new services
        chrome.action.setBadgeText({ text: '' });
      }
      
      sendResponse({ 
        services,
        lastScanTime: data.lastScanTime || 0
      });
    });
    return true;
  }
  
  if (request.type === 'UPDATE_ALIAS') {
    chrome.storage.local.get('serviceAliases', (data) => {
      const aliases = data.serviceAliases || {};
      const key = `${request.port}:${request.protocol}`;
      
      if (request.alias) {
        aliases[key] = request.alias;
      } else {
        delete aliases[key];
      }
      
      chrome.storage.local.set({ serviceAliases: aliases }, () => {
        const service = detectedServices.get(key);
        if (service) {
          if (request.alias) {
            service.customName = request.alias;
          } else {
            delete service.customName;
          }
          detectedServices.set(key, service);
        }
        sendResponse({ success: true });
      });
    });
    return true;
  }
});

// Handle keyboard shortcut command
chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-popup' || command === '_execute_action') {
    chrome.action.openPopup();
  }
});

// Notification when new service detected
function checkForNewServices(newServices) {
  // Find truly new services
  const newPorts = [];
  let newServicesCount = 0;
  
  for (const [key, service] of newServices) {
    if (service.isNew) {
      newPorts.push(`Port ${service.port}: ${service.service}`);
      newServicesCount++;
    }
  }
  
  if (newServicesCount > 0) {
    // Set badge on extension icon
    chrome.action.setBadgeText({ text: newServicesCount.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#10b981' }); // Green color
    
    // Store the count of new services
    chrome.storage.local.set({ newServicesCount });
    
    // Send notification if enabled
    chrome.storage.local.get('notificationsEnabled', (data) => {
      if (data.notificationsEnabled !== false) {
        const message = newPorts.length === 1 
          ? newPorts[0]
          : `${newPorts.length} new services: ${newPorts.slice(0, 3).join(', ')}${newPorts.length > 3 ? '...' : ''}`;
          
        chrome.notifications.create({
          type: 'basic',
          iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
          title: 'New Service Detected!',
          message: message,
          priority: 1
        });
      }
    });
  }
}

// Initialize premium features
async function initializePremiumFeatures() {
  // Skip premium features in background for now
  console.log('Background script initialized');
}

// Handle notification clicks
chrome.notifications.onClicked.addListener((notificationId) => {
  // Open the extension popup when notification is clicked
  chrome.action.openPopup();
});

// Initialize on startup
// Load previous state first
chrome.storage.local.get(['detectedServices', 'seenServices', 'newServicesCount'], (data) => {
  if (data.detectedServices) {
    // Restore previous services
    detectedServices = new Map(data.detectedServices);
    previousServices = new Map(data.detectedServices);
    
    // Count new services and restore badge if needed
    let newCount = 0;
    for (const [_, service] of detectedServices) {
      if (service.isNew) newCount++;
    }
    
    if (newCount > 0) {
      chrome.action.setBadgeText({ text: newCount.toString() });
      chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
    }
  }
  // Then scan for current services
  scanPorts();
});