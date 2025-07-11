// State management
let currentServices = [];
let selectedServices = new Set();
let commandPaletteVisible = false;
let currentFocus = -1;
let serviceGroups = {};
let searchQuery = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadServices();
  setupEventListeners();
  setupKeyboardShortcuts();
  loadTheme();
  loadSettings();
});

// Event listeners
function setupEventListeners() {
  // Header actions
  document.getElementById('refreshBtn').addEventListener('click', refreshServices);
  document.getElementById('themeBtn').addEventListener('click', toggleTheme);
  document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
  document.getElementById('commandPaletteBtn').addEventListener('click', toggleCommandPalette);
  
  // Search
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value.toLowerCase();
    filterServices();
  });
  
  // Quick actions
  document.getElementById('openAllBtn').addEventListener('click', openSelectedServices);
  document.getElementById('copyUrlsBtn').addEventListener('click', copySelectedUrls);
  
  // Settings
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', toggleSettings);
  
  // Command palette
  document.getElementById('commandInput').addEventListener('input', updateCommandResults);
  
  // Message listener
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SCAN_COMPLETE') {
      loadServices();
    }
  });
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Command palette
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      toggleCommandPalette();
    }
    
    // Search
    if (e.key === '/' && !isInputFocused()) {
      e.preventDefault();
      document.getElementById('searchInput').focus();
    }
    
    // Refresh
    if (e.key === 'r' && !isInputFocused()) {
      e.preventDefault();
      refreshServices();
    }
    
    // Theme
    if (e.key === 't' && !isInputFocused()) {
      e.preventDefault();
      toggleTheme();
    }
    
    // Settings
    if (e.key === ',' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      toggleSettings();
    }
    
    // Navigation
    if (e.key === 'ArrowDown' && !isInputFocused()) {
      e.preventDefault();
      navigateServices(1);
    }
    
    if (e.key === 'ArrowUp' && !isInputFocused()) {
      e.preventDefault();
      navigateServices(-1);
    }
    
    // Open service
    if (e.key === 'Enter' && currentFocus >= 0) {
      e.preventDefault();
      const services = document.querySelectorAll('.service-item');
      if (services[currentFocus]) {
        const service = getServiceFromElement(services[currentFocus]);
        if (service) openService(service.protocol, service.port);
      }
    }
    
    // Escape
    if (e.key === 'Escape') {
      if (commandPaletteVisible) toggleCommandPalette();
      else if (document.getElementById('settingsPanel').style.display === 'block') toggleSettings();
    }
  });
}

// Service loading and display
async function loadServices() {
  showLoadingState();
  
  chrome.runtime.sendMessage({ type: 'GET_SERVICES' }, (response) => {
    currentServices = response.services || [];
    
    if (currentServices.length === 0) {
      showEmptyState();
    } else {
      organizeAndDisplayServices();
    }
  });
}

function organizeAndDisplayServices() {
  chrome.storage.local.get(['groupByType', 'serviceGroups'], (data) => {
    const groupByType = data.groupByType !== false;
    const customGroups = data.serviceGroups || {};
    
    if (groupByType) {
      serviceGroups = groupServicesByType(currentServices, customGroups);
    } else {
      serviceGroups = { 'All Services': currentServices };
    }
    
    displayServiceGroups();
  });
}

function groupServicesByType(services, customGroups) {
  const groups = {};
  const defaultGroups = {
    'Frontend': ['React', 'Vue', 'Angular', 'Vite', 'Webpack'],
    'Backend': ['Node.js', 'Django', 'Flask', 'Rails', 'Express'],
    'Databases': ['MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch'],
    'Tools': ['Storybook', 'Jupyter', 'GraphQL', 'phpMyAdmin'],
    'Other': []
  };
  
  // Merge custom groups with defaults
  const allGroups = { ...defaultGroups, ...customGroups };
  
  services.forEach(service => {
    let grouped = false;
    
    for (const [groupName, patterns] of Object.entries(allGroups)) {
      if (patterns.some(pattern => service.service.includes(pattern))) {
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push(service);
        grouped = true;
        break;
      }
    }
    
    if (!grouped) {
      if (!groups['Other']) groups['Other'] = [];
      groups['Other'].push(service);
    }
  });
  
  // Remove empty groups
  Object.keys(groups).forEach(key => {
    if (groups[key].length === 0) delete groups[key];
  });
  
  return groups;
}

function displayServiceGroups() {
  const container = document.getElementById('serviceGroups');
  container.innerHTML = '';
  container.style.display = 'block';
  
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';
  
  Object.entries(serviceGroups).forEach(([groupName, services]) => {
    if (searchQuery && !services.some(s => matchesSearch(s))) return;
    
    const groupEl = createGroupElement(groupName, services);
    container.appendChild(groupEl);
  });
  
  updateQuickActionsVisibility();
}

function createGroupElement(groupName, services) {
  const group = document.createElement('div');
  group.className = 'service-group';
  
  const header = document.createElement('div');
  header.className = 'group-header';
  header.innerHTML = `
    <div class="group-title">
      <span>${groupName}</span>
      <span class="group-count">${services.length}</span>
    </div>
    <svg class="group-toggle" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  `;
  
  header.addEventListener('click', () => {
    group.classList.toggle('collapsed');
  });
  
  const servicesContainer = document.createElement('div');
  servicesContainer.className = 'group-services';
  
  services.forEach(service => {
    if (!searchQuery || matchesSearch(service)) {
      const serviceEl = createServiceElement(service);
      servicesContainer.appendChild(serviceEl);
    }
  });
  
  group.appendChild(header);
  group.appendChild(servicesContainer);
  
  return group;
}

function createServiceElement(service) {
  const div = document.createElement('div');
  div.className = 'service-item';
  div.dataset.port = service.port;
  div.dataset.protocol = service.protocol;
  div.tabIndex = 0;
  
  const displayName = service.customName || service.service;
  
  div.innerHTML = `
    <div class="service-status"></div>
    <div class="service-info">
      <div class="service-header">
        <span class="service-name">${displayName}</span>
        <span class="service-port">:${service.port}</span>
      </div>
      <div class="service-details">
        <span class="protocol-badge ${service.protocol}">${service.protocol}</span>
        ${service.customName ? `<span class="service-type">${service.service}</span>` : ''}
      </div>
    </div>
    <div class="service-actions">
      <button class="action-btn edit-btn" data-tooltip="Rename">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="action-btn primary open-btn" data-tooltip="Open">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
        </svg>
      </button>
    </div>
  `;
  
  // Multi-select with cmd/ctrl click
  div.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey) {
      toggleServiceSelection(service);
    } else if (!e.target.closest('button')) {
      clearSelections();
      toggleServiceSelection(service);
    }
  });
  
  // Double click to open
  div.addEventListener('dblclick', () => {
    openService(service.protocol, service.port);
  });
  
  // Button event listeners
  const editBtn = div.querySelector('.edit-btn');
  const openBtn = div.querySelector('.open-btn');
  
  editBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    editAlias(service);
  });
  
  openBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openService(service.protocol, service.port);
  });
  
  return div;
}

// Selection management
function toggleServiceSelection(service) {
  const key = `${service.port}:${service.protocol}`;
  const element = document.querySelector(`[data-port="${service.port}"][data-protocol="${service.protocol}"]`);
  
  if (selectedServices.has(key)) {
    selectedServices.delete(key);
    element.classList.remove('selected');
  } else {
    selectedServices.add(key);
    element.classList.add('selected');
  }
  
  updateQuickActionsVisibility();
}

function clearSelections() {
  selectedServices.clear();
  document.querySelectorAll('.service-item.selected').forEach(el => {
    el.classList.remove('selected');
  });
  updateQuickActionsVisibility();
}

function updateQuickActionsVisibility() {
  const quickActions = document.getElementById('quickActions');
  if (selectedServices.size > 0) {
    quickActions.classList.add('visible');
  } else {
    quickActions.classList.remove('visible');
  }
}

// Service actions
function openService(protocol, port) {
  chrome.tabs.create({
    url: `${protocol}://localhost:${port}/`,
    active: true
  });
}

function openSelectedServices() {
  selectedServices.forEach(key => {
    const [port, protocol] = key.split(':');
    openService(protocol, port);
  });
}

function copySelectedUrls() {
  const urls = Array.from(selectedServices).map(key => {
    const [port, protocol] = key.split(':');
    return `${protocol}://localhost:${port}/`;
  });
  
  navigator.clipboard.writeText(urls.join('\n')).then(() => {
    showNotification('URLs copied to clipboard', 'success');
  });
}

// Command palette
function toggleCommandPalette() {
  const palette = document.getElementById('commandPalette');
  commandPaletteVisible = !commandPaletteVisible;
  
  if (commandPaletteVisible) {
    palette.classList.add('visible');
    document.getElementById('commandInput').value = '';
    document.getElementById('commandInput').focus();
    updateCommandResults();
  } else {
    palette.classList.remove('visible');
  }
}

function updateCommandResults() {
  const input = document.getElementById('commandInput').value.toLowerCase();
  const results = document.getElementById('commandResults');
  results.innerHTML = '';
  
  const commands = [
    { name: 'Open All Services', desc: 'Open all detected services', icon: '🚀', action: () => {
      currentServices.forEach(s => openService(s.protocol, s.port));
    }},
    { name: 'Copy All URLs', desc: 'Copy all service URLs', icon: '📋', action: () => {
      const urls = currentServices.map(s => `${s.protocol}://localhost:${s.port}/`);
      navigator.clipboard.writeText(urls.join('\n'));
      showNotification('URLs copied!', 'success');
    }},
    { name: 'Refresh Services', desc: 'Scan for services again', icon: '🔄', action: refreshServices },
    { name: 'Toggle Theme', desc: 'Switch between light and dark', icon: '🌓', action: toggleTheme },
    { name: 'Settings', desc: 'Open settings panel', icon: '⚙️', action: toggleSettings },
  ];
  
  // Add service-specific commands
  currentServices.forEach(service => {
    const name = service.customName || service.service;
    commands.push({
      name: `Open ${name}`,
      desc: `${service.protocol}://localhost:${service.port}`,
      icon: '🌐',
      action: () => openService(service.protocol, service.port)
    });
  });
  
  const filtered = commands.filter(cmd => 
    cmd.name.toLowerCase().includes(input) || 
    cmd.desc.toLowerCase().includes(input)
  );
  
  filtered.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = 'command-item';
    if (index === 0) item.classList.add('selected');
    
    item.innerHTML = `
      <div class="command-icon">${cmd.icon}</div>
      <div class="command-text">
        <div class="command-name">${cmd.name}</div>
        <div class="command-desc">${cmd.desc}</div>
      </div>
    `;
    
    item.addEventListener('click', () => {
      cmd.action();
      toggleCommandPalette();
    });
    
    results.appendChild(item);
  });
}

// Theme management
function toggleTheme() {
  const isDark = document.body.classList.toggle('dark');
  chrome.storage.local.set({ darkTheme: isDark });
  showNotification(`Switched to ${isDark ? 'dark' : 'light'} theme`, 'success');
}

function loadTheme() {
  chrome.storage.local.get('darkTheme', (data) => {
    if (data.darkTheme) {
      document.body.classList.add('dark');
    }
  });
}

// Notifications
function showNotification(message, type = 'info') {
  chrome.storage.local.get('notificationsEnabled', (data) => {
    if (data.notificationsEnabled === false) return;
    
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-header">
        <div class="notification-title">LocalHost Manager</div>
        <span class="notification-close">×</span>
      </div>
      <div class="notification-body">${message}</div>
    `;
    
    notification.querySelector('.notification-close').addEventListener('click', () => {
      notification.remove();
    });
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutRight 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  });
}

// Helper functions
function isInputFocused() {
  const activeEl = document.activeElement;
  return activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA';
}

function matchesSearch(service) {
  const name = (service.customName || service.service).toLowerCase();
  const port = service.port.toString();
  return name.includes(searchQuery) || port.includes(searchQuery);
}

function filterServices() {
  displayServiceGroups();
}

function navigateServices(direction) {
  const services = document.querySelectorAll('.service-item');
  if (services.length === 0) return;
  
  currentFocus += direction;
  if (currentFocus >= services.length) currentFocus = 0;
  if (currentFocus < 0) currentFocus = services.length - 1;
  
  services.forEach((service, index) => {
    if (index === currentFocus) {
      service.focus();
      service.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}

function getServiceFromElement(element) {
  const port = parseInt(element.dataset.port);
  const protocol = element.dataset.protocol;
  return currentServices.find(s => s.port === port && s.protocol === protocol);
}

// Existing functions adapted
function refreshServices() {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.querySelector('svg').style.animation = 'spin 1s linear infinite';
  
  showLoadingState();
  
  chrome.runtime.sendMessage({ type: 'SCAN_PORTS' }, (response) => {
    refreshBtn.querySelector('svg').style.animation = '';
    
    if (response.success) {
      currentServices = response.services;
      if (currentServices.length === 0) {
        showEmptyState();
      } else {
        organizeAndDisplayServices();
      }
    }
  });
}

function showLoadingState() {
  document.getElementById('loadingState').style.display = 'flex';
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('serviceGroups').style.display = 'none';
}

function showEmptyState() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('serviceGroups').style.display = 'none';
}

function editAlias(service) {
  const currentAlias = service.customName || '';
  const newAlias = prompt('Enter custom name:', currentAlias);
  
  if (newAlias !== null && newAlias !== currentAlias) {
    chrome.runtime.sendMessage({
      type: 'UPDATE_ALIAS',
      port: service.port,
      protocol: service.protocol,
      alias: newAlias.trim() || null
    }, () => {
      loadServices();
    });
  }
}

function toggleSettings() {
  const panel = document.getElementById('settingsPanel');
  const isVisible = panel.style.display === 'block';
  panel.style.display = isVisible ? 'none' : 'block';
  
  if (!isVisible) loadSettings();
}

function loadSettings() {
  chrome.storage.local.get(['enableAutoScan', 'customPorts', 'groupByType', 'notificationsEnabled', 'serviceGroups'], (data) => {
    document.getElementById('autoScanToggle').checked = data.enableAutoScan !== false;
    document.getElementById('groupByTypeToggle').checked = data.groupByType !== false;
    document.getElementById('notificationsToggle').checked = data.notificationsEnabled !== false;
    document.getElementById('customPortsInput').value = (data.customPorts || []).join(', ');
    document.getElementById('serviceGroupsInput').value = JSON.stringify(data.serviceGroups || {}, null, 2);
  });
}

function saveSettings() {
  const enableAutoScan = document.getElementById('autoScanToggle').checked;
  const groupByType = document.getElementById('groupByTypeToggle').checked;
  const notificationsEnabled = document.getElementById('notificationsToggle').checked;
  const customPortsText = document.getElementById('customPortsInput').value;
  const serviceGroupsText = document.getElementById('serviceGroupsInput').value;
  
  const customPorts = customPortsText
    .split(',')
    .map(p => parseInt(p.trim()))
    .filter(p => !isNaN(p) && p > 0 && p < 65536);
  
  let serviceGroups = {};
  try {
    serviceGroups = JSON.parse(serviceGroupsText);
  } catch (e) {
    showNotification('Invalid JSON for service groups', 'error');
    return;
  }
  
  chrome.storage.local.set({
    enableAutoScan,
    groupByType,
    notificationsEnabled,
    customPorts,
    serviceGroups
  }, () => {
    toggleSettings();
    showNotification('Settings saved!', 'success');
    loadServices();
  });
}