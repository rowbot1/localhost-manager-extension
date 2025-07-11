// Enhanced Service Card Component
class ServiceCard {
  constructor(service, metrics, advancedFeatures) {
    this.service = service;
    this.metrics = metrics;
    this.advancedFeatures = advancedFeatures;
  }

  render() {
    const healthScore = this.metrics ? 
      this.advancedFeatures.calculateHealthScore(this.metrics) : 0;
    
    const healthClass = this.getHealthClass(healthScore);
    const healthEmoji = this.getHealthEmoji(healthScore);
    
    const card = document.createElement('div');
    card.className = `service-card ${healthClass}`;
    card.dataset.port = this.service.port;
    card.dataset.protocol = this.service.protocol;
    
    // Quick actions menu
    const quickActions = this.advancedFeatures.generateQuickActions(this.service);
    const actionsHtml = quickActions.map(action => `
      <button class="quick-action" data-action="${action.id}" title="${action.label}">
        ${action.icon}
      </button>
    `).join('');
    
    card.innerHTML = `
      <div class="service-header">
        <div class="service-health-indicator">
          <div class="health-score">${healthEmoji} ${healthScore}%</div>
          <div class="health-bar">
            <div class="health-fill" style="width: ${healthScore}%"></div>
          </div>
        </div>
        <div class="quick-actions-menu">
          ${actionsHtml}
        </div>
      </div>
      
      <div class="service-main">
        <div class="service-icon">${this.getServiceIcon()}</div>
        <div class="service-name">${this.service.customName || this.service.service}</div>
        <div class="service-url">${this.service.protocol}://localhost:${this.service.port}</div>
      </div>
      
      <div class="service-stats">
        <div class="stat">
          <div class="stat-value">${this.formatResponseTime()}</div>
          <div class="stat-label">Response</div>
        </div>
        <div class="stat">
          <div class="stat-value">${this.formatRequests()}</div>
          <div class="stat-label">Requests</div>
        </div>
        <div class="stat">
          <div class="stat-value">${this.formatUptime()}</div>
          <div class="stat-label">Uptime</div>
        </div>
      </div>
      
      ${this.renderBottlenecks()}
      ${this.renderSparkline()}
    `;
    
    // Attach event listeners
    this.attachEventListeners(card, quickActions);
    
    return card;
  }

  getHealthClass(score) {
    if (score >= 90) return 'health-excellent';
    if (score >= 70) return 'health-good';
    if (score >= 50) return 'health-warning';
    return 'health-critical';
  }

  getHealthEmoji(score) {
    if (score >= 90) return '🟢';
    if (score >= 70) return '🟡';
    if (score >= 50) return '🟠';
    return '🔴';
  }

  getServiceIcon() {
    const icons = {
      'React': '⚛️',
      'Vue': '💚',
      'Angular': '🅰️',
      'Node.js': '🟩',
      'Django': '🐍',
      'MongoDB': '🍃',
      'PostgreSQL': '🐘',
      'Redis': '🔴',
      'Docker': '🐳'
    };
    
    for (const [key, icon] of Object.entries(icons)) {
      if (this.service.service.includes(key)) {
        return icon;
      }
    }
    
    return '🌐';
  }

  formatResponseTime() {
    if (!this.metrics || !this.metrics.avgResponseTime) return 'N/A';
    const time = Math.round(this.metrics.avgResponseTime);
    if (time > 1000) return `${(time / 1000).toFixed(1)}s`;
    return `${time}ms`;
  }

  formatRequests() {
    if (!this.metrics || !this.metrics.totalRequests) return '0';
    const count = this.metrics.totalRequests;
    if (count > 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count > 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  }

  formatUptime() {
    if (!this.metrics || !this.metrics.startTime) return 'N/A';
    const uptime = Date.now() - this.metrics.startTime;
    const hours = Math.floor(uptime / 3600000);
    const minutes = Math.floor((uptime % 3600000) / 60000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  renderBottlenecks() {
    const profile = this.advancedFeatures.performanceProfiles.get(this.service.port);
    if (!profile || !profile.bottlenecks || profile.bottlenecks.length === 0) {
      return '';
    }
    
    const bottleneck = profile.bottlenecks[0];
    return `
      <div class="service-alert ${bottleneck.severity}">
        <span class="alert-icon">⚠️</span>
        <span class="alert-text">${bottleneck.message}</span>
      </div>
    `;
  }

  renderSparkline() {
    if (!this.metrics || !this.metrics.history || this.metrics.history.length < 2) {
      return '';
    }
    
    const data = this.metrics.history.slice(-20).map(h => h.responseTime);
    const max = Math.max(...data);
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * 100;
      const y = 100 - ((value / max) * 100);
      return `${x},${y}`;
    }).join(' ');
    
    return `
      <div class="service-sparkline">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none">
          <polyline points="${points}" fill="none" stroke="var(--primary)" stroke-width="2"/>
        </svg>
      </div>
    `;
  }

  attachEventListeners(card, quickActions) {
    // Main card click
    card.addEventListener('click', (e) => {
      if (!e.target.closest('.quick-action')) {
        chrome.tabs.create({
          url: `${this.service.protocol}://localhost:${this.service.port}`
        });
      }
    });
    
    // Quick action clicks
    card.querySelectorAll('.quick-action').forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        quickActions[index].action();
      });
    });
    
    // Hover effects
    card.addEventListener('mouseenter', () => {
      card.classList.add('hover');
    });
    
    card.addEventListener('mouseleave', () => {
      card.classList.remove('hover');
    });
  }
}