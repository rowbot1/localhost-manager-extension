// Simplified Popup Controller
let currentServices = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Clear the badge when popup opens
    chrome.action.setBadgeText({ text: '' });
    chrome.storage.local.set({ newServicesCount: 0 });
    
    setupEventListeners();
    showLoadingState();
    
    // Trigger a fresh scan on load
    chrome.runtime.sendMessage({ type: 'SCAN_PORTS' }, (response) => {
      console.log('Initial scan response:', response);
      loadServices();
    });
    
    startRealTimeUpdates();
    
    // Load saved view preference
    chrome.storage.local.get('viewMode', (data) => {
      if (data.viewMode) {
        switchView(data.viewMode);
      }
    });
  } catch (error) {
    console.error('Error initializing:', error);
  }
});

// Event Listeners
function setupEventListeners() {
  // Header Actions
  document.getElementById('refreshBtn').addEventListener('click', refreshAll);
  document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
  
  // View toggles
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });
  
  // Settings
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', toggleSettings);
  
  // Search
  document.getElementById('searchInput').addEventListener('input', filterServices);
}

// Services Tab
async function loadServices() {
  console.log('Loading services...');
  chrome.runtime.sendMessage({ type: 'GET_SERVICES' }, async (response) => {
    console.log('Services response:', response);
    if (chrome.runtime.lastError) {
      console.error('Error getting services:', chrome.runtime.lastError);
      return;
    }
    
    currentServices = response?.services || [];
    console.log('Current services:', currentServices);
    displayServices();
  });
}

function displayServices() {
  const container = document.getElementById('servicesGrid');
  container.innerHTML = '';
  
  // Sort services: new ones first, then by port number
  const sortedServices = [...currentServices].sort((a, b) => {
    // New services come first
    if (a.isNew && !b.isNew) return -1;
    if (!a.isNew && b.isNew) return 1;
    
    // If both new or both not new, sort by discovery time (newest first)
    if (a.isNew && b.isNew && a.discoveredAt && b.discoveredAt) {
      return b.discoveredAt - a.discoveredAt;
    }
    
    // Then sort by port number
    return a.port - b.port;
  });
  
  sortedServices.forEach(service => {
    const card = createServiceCard(service);
    container.appendChild(card);
  });
}

function createServiceCard(service) {
  const card = document.createElement('div');
  card.className = `service-card ${service.status || 'unknown'} ${service.isNew ? 'new' : ''}`;
  
  // Show framework info if available and different from service name
  let frameworkInfo = '';
  if (service.framework && service.framework !== service.service && service.framework !== 'Web Application') {
    frameworkInfo = `<div class="service-framework">${service.framework}</div>`;
  }
  
  // Status indicator
  const statusIcon = service.status === 'error' ? '🔴' : 
                    service.status === 'running' ? '🟢' : '⚪';
  
  const url = `${service.protocol}://localhost:${service.port}`;
  
  // Add NEW badge if this is a recently discovered service
  const newBadge = service.isNew ? '<div class="new-badge">NEW</div>' : '';
  
  card.innerHTML = `
    ${newBadge}
    <div class="service-status">${statusIcon}</div>
    <div class="service-info">
      <div class="service-name" title="${service.customName || service.service}">${service.customName || service.service}</div>
      ${frameworkInfo}
      <div class="service-port">${url}</div>
    </div>
    <div class="service-actions">
      <button class="copy-btn" title="Copy URL">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
      <button class="open-btn">Open</button>
    </div>
  `;
  
  // Add event listeners
  card.querySelector('.open-btn').addEventListener('click', () => openService(service));
  card.querySelector('.copy-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    copyToClipboard(url);
  });
  
  // Click on card to open (except buttons)
  card.addEventListener('click', (e) => {
    if (!e.target.closest('button')) {
      openService(service);
    }
  });
  
  return card;
}

// Real-time Updates
function startRealTimeUpdates() {
  // Auto-refresh services every 30 seconds
  setInterval(() => {
    chrome.runtime.sendMessage({ type: 'SCAN_PORTS' }, (response) => {
      if (response && response.success) {
        loadServices();
      }
    });
  }, 30000);
}

// View Management
function switchView(view) {
  // Update button states
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  
  // Update grid layout
  const grid = document.getElementById('servicesGrid');
  if (view === 'list') {
    grid.style.display = 'flex';
    grid.style.flexDirection = 'column';
    grid.style.gap = '8px';
    
    // Update service cards for list view
    document.querySelectorAll('.service-card').forEach(card => {
      card.style.display = 'flex';
      card.style.alignItems = 'center';
      card.style.padding = '12px 16px';
      
      // Adjust layout
      const info = card.querySelector('.service-info');
      if (info) info.style.flex = '1';
    });
  } else {
    // Grid view (default)
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(180px, 1fr))';
    grid.style.flexDirection = '';
    grid.style.gap = '16px';
    
    // Reset service cards to grid view
    document.querySelectorAll('.service-card').forEach(card => {
      card.style.display = 'block';
      card.style.alignItems = '';
      card.style.padding = '16px';
      
      const info = card.querySelector('.service-info');
      if (info) info.style.flex = '';
    });
  }
  
  // Save preference
  chrome.storage.local.set({ viewMode: view });
}

// Action Handlers
function openService(service) {
  chrome.tabs.create({
    url: `${service.protocol}://localhost:${service.port}/`,
    active: true
  });
}

function refreshAll() {
  chrome.runtime.sendMessage({ type: 'SCAN_PORTS' }, (response) => {
    if (response && response.success) {
      loadServices();
    }
  });
}

function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  const isVisible = panel.style.display === 'block';
  
  if (!isVisible) {
    loadSettings();
    panel.style.display = 'block';
  } else {
    panel.style.display = 'none';
  }
}

function filterServices() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const cards = document.querySelectorAll('.service-card');
  
  cards.forEach(card => {
    const name = card.querySelector('.service-name').textContent.toLowerCase();
    const port = card.querySelector('.service-port').textContent.toLowerCase();
    const visible = name.includes(search) || port.includes(search);
    card.style.display = visible ? 'block' : 'none';
  });
}

// Helper Functions
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <div class="notification-header">
      <div class="notification-title">LocalHost Manager</div>
      <span class="notification-close">×</span>
    </div>
    <div class="notification-body">${message}</div>
  `;
  
  // Add close handler
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });
  
  // Add to body
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function loadSettings() {
  chrome.storage.local.get(['enableAutoScan', 'notificationsEnabled'], (data) => {
    const autoScanToggle = document.getElementById('autoScanToggle');
    const notificationsToggle = document.getElementById('notificationsToggle');
    if (autoScanToggle) autoScanToggle.checked = data.enableAutoScan !== false;
    if (notificationsToggle) notificationsToggle.checked = data.notificationsEnabled !== false;
  });
}

function saveSettings() {
  const autoScan = document.getElementById('autoScanToggle')?.checked;
  const notifications = document.getElementById('notificationsToggle')?.checked;
  
  chrome.storage.local.set({
    enableAutoScan: autoScan,
    notificationsEnabled: notifications
  }, () => {
    showNotification('Settings saved successfully!', 'success');
    toggleSettings();
  });
}

// Helper function to copy to clipboard
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('Copied to clipboard!', 'success');
  }).catch(err => {
    console.error('Failed to copy:', err);
    showNotification('Failed to copy', 'error');
  });
}

// Show loading state
function showLoadingState() {
  const container = document.getElementById('servicesGrid');
  container.innerHTML = `
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Scanning localhost ports...</p>
    </div>
  `;
}