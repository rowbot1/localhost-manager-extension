let currentServices = [];
let isEditingAlias = null;

document.addEventListener('DOMContentLoaded', () => {
  loadServices();
  setupEventListeners();
});

function setupEventListeners() {
  document.getElementById('refreshBtn').addEventListener('click', refreshServices);
  document.getElementById('settingsBtn').addEventListener('click', toggleSettings);
  document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
  document.getElementById('closeSettingsBtn').addEventListener('click', toggleSettings);
  
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'SCAN_COMPLETE') {
      loadServices();
    }
  });
}

async function loadServices() {
  showLoadingState();
  
  chrome.runtime.sendMessage({ type: 'GET_SERVICES' }, (response) => {
    currentServices = response.services || [];
    updateLastScanTime(response.lastScanTime);
    
    if (currentServices.length === 0) {
      showEmptyState();
    } else {
      showServices(currentServices);
    }
  });
}

async function refreshServices() {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.disabled = true;
  refreshBtn.querySelector('svg').style.animation = 'spin 1s linear infinite';
  
  showLoadingState();
  
  chrome.runtime.sendMessage({ type: 'SCAN_PORTS' }, (response) => {
    refreshBtn.disabled = false;
    refreshBtn.querySelector('svg').style.animation = '';
    
    if (response.success) {
      currentServices = response.services;
      if (currentServices.length === 0) {
        showEmptyState();
      } else {
        showServices(currentServices);
      }
      updateLastScanTime(Date.now());
    }
  });
}

function showLoadingState() {
  document.getElementById('loadingState').style.display = 'flex';
  document.getElementById('emptyState').style.display = 'none';
  document.getElementById('servicesList').style.display = 'none';
}

function showEmptyState() {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('emptyState').style.display = 'flex';
  document.getElementById('servicesList').style.display = 'none';
}

function showServices(services) {
  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('emptyState').style.display = 'none';
  
  const servicesList = document.getElementById('servicesList');
  servicesList.style.display = 'block';
  servicesList.innerHTML = '';
  
  services.sort((a, b) => a.port - b.port);
  
  services.forEach(service => {
    const serviceEl = createServiceElement(service);
    servicesList.appendChild(serviceEl);
  });
}

function createServiceElement(service) {
  const div = document.createElement('div');
  div.className = 'service-item';
  div.dataset.port = service.port;
  div.dataset.protocol = service.protocol;
  
  const displayName = service.customName || service.service;
  const confidenceClass = service.confidence || 'low';
  
  div.innerHTML = `
    <div class="service-info">
      <div class="service-header">
        <span class="service-name">${displayName}</span>
        <span class="service-port">:${service.port}</span>
      </div>
      <div class="service-details">
        <span class="protocol-badge ${service.protocol}">${service.protocol}</span>
        <div class="confidence-indicator" title="Detection confidence: ${confidenceClass}">
          <span class="confidence-dot ${confidenceClass}"></span>
          <span>${service.customName ? service.service : ''}</span>
        </div>
      </div>
    </div>
    <div class="service-actions">
      <button class="action-btn edit-btn" data-port="${service.port}" data-protocol="${service.protocol}" data-alias="${service.customName || ''}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="action-btn primary open-btn" data-protocol="${service.protocol}" data-port="${service.port}">Open</button>
    </div>
  `;
  
  // Add event listeners
  const editBtn = div.querySelector('.edit-btn');
  const openBtn = div.querySelector('.open-btn');
  
  editBtn.addEventListener('click', () => {
    editAlias(service.port, service.protocol, service.customName || '');
  });
  
  openBtn.addEventListener('click', () => {
    openService(service.protocol, service.port);
  });
  
  return div;
}

function openService(protocol, port) {
  chrome.tabs.create({
    url: `${protocol}://localhost:${port}/`,
    active: true
  });
}

function editAlias(port, protocol, currentAlias) {
  if (isEditingAlias) {
    cancelEditAlias();
  }
  
  isEditingAlias = { port, protocol };
  
  const serviceItem = document.querySelector(`[data-port="${port}"][data-protocol="${protocol}"]`);
  const actionsDiv = serviceItem.querySelector('.service-actions');
  
  const form = document.createElement('div');
  form.className = 'edit-alias-form';
  form.innerHTML = `
    <input type="text" id="aliasInput" placeholder="Custom name" value="${currentAlias}">
    <button class="action-btn save-alias-btn">Save</button>
    <button class="action-btn cancel-alias-btn">Cancel</button>
  `;
  
  serviceItem.appendChild(form);
  actionsDiv.style.display = 'none';
  
  const aliasInput = form.querySelector('#aliasInput');
  const saveBtn = form.querySelector('.save-alias-btn');
  const cancelBtn = form.querySelector('.cancel-alias-btn');
  
  aliasInput.focus();
  aliasInput.select();
  
  saveBtn.addEventListener('click', () => saveAlias());
  cancelBtn.addEventListener('click', () => cancelEditAlias());
  
  aliasInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') saveAlias();
    if (e.key === 'Escape') cancelEditAlias();
  });
}

function saveAlias() {
  if (!isEditingAlias) return;
  
  const alias = document.getElementById('aliasInput').value.trim();
  
  chrome.runtime.sendMessage({
    type: 'UPDATE_ALIAS',
    port: isEditingAlias.port,
    protocol: isEditingAlias.protocol,
    alias: alias || null
  }, () => {
    cancelEditAlias();
    loadServices();
  });
}

function cancelEditAlias() {
  if (!isEditingAlias) return;
  
  const serviceItem = document.querySelector(`[data-port="${isEditingAlias.port}"][data-protocol="${isEditingAlias.protocol}"]`);
  const form = serviceItem.querySelector('.edit-alias-form');
  const actionsDiv = serviceItem.querySelector('.service-actions');
  
  if (form) form.remove();
  if (actionsDiv) actionsDiv.style.display = 'flex';
  
  isEditingAlias = null;
};

function toggleSettings() {
  const settingsPanel = document.getElementById('settingsPanel');
  const isVisible = settingsPanel.style.display === 'block';
  
  if (!isVisible) {
    loadSettings();
    settingsPanel.style.display = 'block';
  } else {
    settingsPanel.style.display = 'none';
  }
}

async function loadSettings() {
  chrome.storage.local.get(['enableAutoScan', 'customPorts'], (data) => {
    document.getElementById('autoScanToggle').checked = data.enableAutoScan !== false;
    document.getElementById('customPortsInput').value = (data.customPorts || []).join(', ');
  });
}

async function saveSettings() {
  const enableAutoScan = document.getElementById('autoScanToggle').checked;
  const customPortsText = document.getElementById('customPortsInput').value;
  
  const customPorts = customPortsText
    .split(',')
    .map(p => parseInt(p.trim()))
    .filter(p => !isNaN(p) && p > 0 && p < 65536);
  
  chrome.storage.local.set({
    enableAutoScan,
    customPorts
  }, () => {
    toggleSettings();
    refreshServices();
  });
}

function updateLastScanTime(timestamp) {
  if (!timestamp) {
    document.getElementById('lastScanTime').textContent = 'Last scan: Never';
    return;
  }
  
  const now = Date.now();
  const diff = now - timestamp;
  
  let timeAgo;
  if (diff < 60000) {
    timeAgo = 'just now';
  } else if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    timeAgo = `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  } else {
    const hours = Math.floor(diff / 3600000);
    timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  
  document.getElementById('lastScanTime').textContent = `Last scan: ${timeAgo}`;
}