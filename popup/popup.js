class PopupManager {
  constructor() {
    this.prompts = [];
    this.currentCategory = 'all';
    this.settings = {};
    this.setupSteps = {
      step1: false,
      step2: false,
      step3: false,
      step4: false
    };
    this.init();
  }
  
  async init() {
    await this.loadSettings();
    await this.loadSetupProgress();
    this.setupEventListeners();
    await this.checkAuthStatus();
    await this.loadPrompts();
    this.renderCategories();
    this.renderPrompts();
    this.updateSetupWizard();
  }
  
  async loadSettings() {
    try {
      const result = await chrome.storage.local.get(['clientId', 'storageType']);
      this.settings = {
        clientId: result.clientId || '',
        storageType: result.storageType || 'gdrive'
      };
      
      // Update settings form
      if (this.settings.clientId) {
        document.getElementById('clientIdInput').value = this.settings.clientId;
        this.setupSteps.step4 = true;
      }
      document.getElementById('storageSelect').value = this.settings.storageType;
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
  
  async loadSetupProgress() {
    try {
      const result = await chrome.storage.local.get(['setupSteps']);
      if (result.setupSteps) {
        this.setupSteps = {...this.setupSteps, ...result.setupSteps};
      }
    } catch (error) {
      console.error('Failed to load setup progress:', error);
    }
  }
  
  async saveSetupProgress() {
    try {
      await chrome.storage.local.set({setupSteps: this.setupSteps});
    } catch (error) {
      console.error('Failed to save setup progress:', error);
    }
  }
  
  async saveSettings() {
    try {
      await chrome.storage.local.set({
        clientId: this.settings.clientId,
        storageType: this.settings.storageType
      });
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }
  
  setupEventListeners() {
    // Main UI
    document.getElementById('connectBtn').addEventListener('click', () => this.handleConnect());
    document.getElementById('addPromptBtn').addEventListener('click', () => this.handleAddPrompt());
    document.getElementById('searchBox').addEventListener('input', (e) => this.handleSearch(e.target.value));
    document.getElementById('settingsBtn').addEventListener('click', () => this.showSettings());
    
    // Settings
    document.getElementById('closeSettingsBtn').addEventListener('click', () => this.hideSettings());
    document.getElementById('clientIdInput').addEventListener('input', (e) => {
      this.settings.clientId = e.target.value.trim();
    });
    document.getElementById('storageSelect').addEventListener('change', (e) => {
      this.settings.storageType = e.target.value;
    });
    
    // Setup Wizard
    document.getElementById('step1Done').addEventListener('click', () => this.markStepComplete('step1'));
    document.getElementById('step2Done').addEventListener('click', () => this.markStepComplete('step2'));
    document.getElementById('toggleStep3Details').addEventListener('click', () => this.toggleStep3Details());
    document.getElementById('saveClientId').addEventListener('click', () => this.handleSaveClientId());
    document.getElementById('testConnection').addEventListener('click', () => this.handleTestConnection());
    
    // Categories
    document.getElementById('categories').addEventListener('click', (e) => {
      if (e.target.classList.contains('category-tab')) {
        this.selectCategory(e.target.dataset.category);
      }
    });
    
    // Prompts
    document.getElementById('promptsList').addEventListener('click', (e) => {
      const promptItem = e.target.closest('.prompt-item');
      if (promptItem) {
        this.handlePromptSelect(promptItem.dataset.promptId);
      }
    });
  }
  
  markStepComplete(stepId) {
    this.setupSteps[stepId] = true;
    this.saveSetupProgress();
    this.updateSetupWizard();
    
    // Auto-advance to next step
    const nextStep = this.getNextIncompleteStep();
    if (nextStep) {
      document.getElementById(nextStep).scrollIntoView({behavior: 'smooth'});
    }
  }
  
  getNextIncompleteStep() {
    const steps = ['step1', 'step2', 'step3', 'step4'];
    return steps.find(step => !this.setupSteps[step]);
  }
  
  updateSetupWizard() {
    Object.keys(this.setupSteps).forEach(stepId => {
      const stepEl = document.getElementById(stepId);
      if (this.setupSteps[stepId]) {
        stepEl.classList.add('completed');
        stepEl.classList.remove('active');
      } else {
        stepEl.classList.remove('completed');
      }
    });
    
    // Mark the next incomplete step as active
    const nextStep = this.getNextIncompleteStep();
    if (nextStep) {
      document.getElementById(nextStep).classList.add('active');
    }
  }
  
  toggleStep3Details() {
    const details = document.getElementById('step3Details');
    const button = document.getElementById('toggleStep3Details');
    
    details.classList.toggle('expanded');
    button.textContent = details.classList.contains('expanded') ? '📋 Hide Details' : '📋 Show Details';
  }
  
  async handleSaveClientId() {
    if (!this.settings.clientId) {
      this.showNotification('Please enter a valid Client ID', 'error');
      return;
    }
    
    await this.saveSettings();
    this.setupSteps.step4 = true;
    await this.saveSetupProgress();
    this.updateSetupWizard();
    await this.checkAuthStatus();
    this.showNotification('Client ID saved successfully!', 'success');
  }
  
  showSettings() {
    document.getElementById('settingsPanel').classList.remove('hidden');
  }
  
  hideSettings() {
    document.getElementById('settingsPanel').classList.add('hidden');
  }
  
  async handleTestConnection() {
    if (!this.settings.clientId) {
      this.showNotification('Please enter a Client ID first', 'error');
      return;
    }
    
    try {
      const btn = document.getElementById('testConnection');
      const originalText = btn.innerHTML;
      btn.innerHTML = '🔄 Testing...';
      btn.disabled = true;
      
      const response = await chrome.runtime.sendMessage({
        action: 'testConnection',
        clientId: this.settings.clientId
      });
      
      btn.innerHTML = originalText;
      btn.disabled = false;
      
      if (response.success) {
        this.showNotification('Connection successful! ✅', 'success');
        this.setupSteps.step3 = true;
        await this.saveSetupProgress();
        this.updateSetupWizard();
      } else {
        this.showNotification('Connection failed: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Test connection failed:', error);
      this.showNotification('Test failed: ' + error.message, 'error');
    }
  }
  
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      font-size: 13px;
      z-index: 1000;
      max-width: 300px;
      word-wrap: break-word;
      transition: all 0.3s ease;
      ${type === 'success' ? 'background: #059669;' : 
        type === 'error' ? 'background: #dc2626;' : 
        'background: #6366f1;'}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Auto remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }
  
  async checkAuthStatus() {
    if (!this.settings.clientId) {
      this.updateAuthStatus('setup');
      return;
    }
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'checkAuth',
        clientId: this.settings.clientId
      });
      
      if (response.success && response.authenticated) {
        this.updateAuthStatus('connected');
      } else {
        this.updateAuthStatus('disconnected');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      this.updateAuthStatus('disconnected');
    }
  }
  
  updateAuthStatus(status) {
    const statusEl = document.getElementById('authStatus');
    const indicator = statusEl.querySelector('.status-indicator');
    
    switch (status) {
      case 'connected':
        statusEl.textContent = 'Connected';
        statusEl.className = 'auth-status connected';
        indicator.className = 'status-indicator status-connected';
        document.getElementById('connectBtn').innerHTML = '🔓 Disconnect';
        break;
      case 'disconnected':
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'auth-status disconnected';
        indicator.className = 'status-indicator status-disconnected';
        document.getElementById('connectBtn').innerHTML = '🔗 Connect Drive';
        break;
      case 'setup':
        statusEl.textContent = 'Setup Needed';
        statusEl.className = 'auth-status setup-needed';
        indicator.className = 'status-indicator status-setup';
        document.getElementById('connectBtn').innerHTML = '⚙️ Setup Required';
        break;
    }
    
    // Prepend indicator
    statusEl.insertBefore(indicator, statusEl.firstChild);
  }
  
  async handleConnect() {
    if (!this.settings.clientId) {
      this.showSettings();
      this.showNotification('Please complete the setup wizard first', 'error');
      return;
    }
    
    const connectBtn = document.getElementById('connectBtn');
    const isConnected = connectBtn.innerHTML.includes('Disconnect');
    
    if (isConnected) {
      await this.disconnect();
    } else {
      await this.connect();
    }
  }
  
  async connect() {
    try {
      const btn = document.getElementById('connectBtn');
      const originalText = btn.innerHTML;
      btn.innerHTML = '🔄 Connecting...';
      btn.disabled = true;
      
      const response = await chrome.runtime.sendMessage({
        action: 'authenticate',
        clientId: this.settings.clientId
      });
      
      btn.disabled = false;
      
      if (response.success) {
        this.updateAuthStatus('connected');
        await this.loadPrompts();
        this.renderPrompts();
        this.showNotification('Successfully connected to Google Drive!', 'success');
      } else {
        btn.innerHTML = originalText;
        this.showNotification('Failed to connect: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Authentication failed:', error);
      document.getElementById('connectBtn').disabled = false;
      this.showNotification('Connection failed: ' + error.message, 'error');
    }
  }
  
  async disconnect() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'disconnect'
      });
      
      if (response.success) {
        this.updateAuthStatus('disconnected');
        this.prompts = [];
        this.renderPrompts();
        this.showNotification('Disconnected from Google Drive', 'info');
      }
    } catch (error) {
      console.error('Disconnect failed:', error);
      this.showNotification('Disconnect failed: ' + error.message, 'error');
    }
  }
  
  async loadPrompts() {
    if (!this.settings.clientId) return;
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'loadPrompts',
        clientId: this.settings.clientId
      });
      
      if (response.success) {
        this.prompts = response.prompts || [];
      }
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  }
  
  renderCategories() {
    const categoriesEl = document.getElementById('categories');
    const categories = ['all', ...new Set(this.prompts.map(p => p.category))];
    
    categoriesEl.innerHTML = categories.map(cat => 
      `<div class="category-tab ${cat === this.currentCategory ? 'active' : ''}" data-category="${cat}">
        ${cat.charAt(0).toUpperCase() + cat.slice(1)}
      </div>`
    ).join('');
  }
  
  selectCategory(category) {
    this.currentCategory = category;
    document.querySelectorAll('.category-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.category === category);
    });
    this.renderPrompts();
  }
  
  renderPrompts() {
    const promptsListEl = document.getElementById('promptsList');
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    
    let filteredPrompts = this.prompts;
    
    if (this.currentCategory !== 'all') {
      filteredPrompts = filteredPrompts.filter(p => p.category === this.currentCategory);
    }
    
    if (searchTerm) {
      filteredPrompts = filteredPrompts.filter(p => 
        p.title.toLowerCase().includes(searchTerm) || 
        p.content.toLowerCase().includes(searchTerm)
      );
    }
    
    if (filteredPrompts.length === 0) {
      const emptyMessage = this.prompts.length === 0 
        ? (this.settings.clientId 
          ? 'No prompts yet. Click "Add Prompt" to create your first one!' 
          : 'Welcome to PromptDex. Click the ⚙️ settings button to set up your Google Drive integration.')
        : 'No matching prompts found. Try adjusting your search or category filter.';
        
      promptsListEl.innerHTML = `
        <div class="empty-state">
          <h3>${this.prompts.length === 0 ? 'Welcome!' : 'No matches'}</h3>
          <p>${emptyMessage}</p>
        </div>
      `;
      return;
    }
    
    promptsListEl.innerHTML = filteredPrompts.map(prompt => `
      <div class="prompt-item" data-prompt-id="${prompt.id}">
        <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
        <div class="prompt-preview">${this.escapeHtml(this.truncate(prompt.content, 120))}</div>
        <div class="prompt-category">${prompt.category}</div>
      </div>
    `).join('');
  }
  
  handleSearch(term) {
    this.renderPrompts();
  }
  
  async handlePromptSelect(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    try {
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const activeTab = tabs[0];
      
      if (this.isAITab(activeTab.url)) {
        await chrome.tabs.sendMessage(activeTab.id, {
          action: 'injectPrompt',
          prompt: prompt
        });
        window.close();
      } else {
        this.showNotification('Please navigate to ChatGPT or Claude to use this prompt.', 'error');
      }
    } catch (error) {
      console.error('Failed to inject prompt:', error);
      this.showNotification('Failed to inject prompt. Make sure you\'re on ChatGPT or Claude.', 'error');
    }
  }
  
  isAITab(url) {
    return url && (
      url.includes('chat.openai.com') || 
      url.includes('claude.ai')
    );
  }
  
  async handleAddPrompt() {
    if (!this.settings.clientId) {
      this.showSettings();
      this.showNotification('Please complete the setup wizard first', 'error');
      return;
    }
    
    const title = prompt('Enter prompt title:');
    if (!title) return;
    
    const content = prompt('Enter prompt content (use {{variable}} for variables):');
    if (!content) return;
    
    const newPrompt = {
      id: Date.now().toString(),
      title: title.trim(),
      content: content.trim(),
      category: this.categorizePrompt(content),
      createdAt: new Date().toISOString()
    };
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'savePrompt',
        prompt: newPrompt,
        clientId: this.settings.clientId
      });
      
      if (response.success) {
        this.prompts.push(newPrompt);
        this.renderCategories();
        this.renderPrompts();
        this.showNotification('Prompt saved successfully!', 'success');
      } else {
        this.showNotification('Failed to save prompt: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to save prompt:', error);
      this.showNotification('Failed to save prompt: ' + error.message, 'error');
    }
  }
  
  categorizePrompt(content) {
    const lowerContent = content.toLowerCase();
    
    if (lowerContent.includes('write') || lowerContent.includes('blog') || lowerContent.includes('article')) {
      return 'writing';
    }
    if (lowerContent.includes('code') || lowerContent.includes('debug') || lowerContent.includes('function')) {
      return 'coding';
    }
    if (lowerContent.includes('analyze') || lowerContent.includes('data') || lowerContent.includes('research')) {
      return 'analysis';
    }
    if (lowerContent.includes('email') || lowerContent.includes('message') || lowerContent.includes('letter')) {
      return 'communication';
    }
    
    return 'general';
  }
  
  truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});