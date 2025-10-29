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
    this.storageManager = new StorageManager();
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
    this.updateSetupVisibility();
    
    // Auto-show setup if not completed
    await this.checkAndShowSetupIfNeeded();
  }
  
  async loadSettings() {
    try {
      // Load from both chrome storage and localStorage
      const chromeResult = await chrome.storage.local.get(['clientId', 'storageType']);
      const localSettings = this.storageManager.getSettings();
      
      this.settings = {
        clientId: chromeResult.clientId || localSettings.clientId || '',
        storageType: chromeResult.storageType || localSettings.storageType || 'gdrive'
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
      // Load from both chrome storage and localStorage
      const chromeResult = await chrome.storage.local.get(['setupSteps']);
      const localSteps = this.storageManager.getSetupSteps();
      
      if (chromeResult.setupSteps || localSteps) {
        this.setupSteps = {...this.setupSteps, ...chromeResult.setupSteps, ...localSteps};
      }
    } catch (error) {
      console.error('Failed to load setup progress:', error);
    }
  }
  
  async saveSetupProgress() {
    try {
      // Save to both chrome storage and localStorage
      await chrome.storage.local.set({setupSteps: this.setupSteps});
      this.storageManager.saveSetupSteps(this.setupSteps);
    } catch (error) {
      console.error('Failed to save setup progress:', error);
    }
  }
  
  async saveSettings() {
    try {
      // Save to both chrome storage and localStorage
      await chrome.storage.local.set({
        clientId: this.settings.clientId,
        storageType: this.settings.storageType
      });
      this.storageManager.saveSettings(this.settings);
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
      this.updateSetupVisibility();
      this.saveSettings();
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
    this.updateStepButtonStyling(stepId);
    
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
        this.updateStepButtonStyling(stepId);
      } else {
        stepEl.classList.remove('completed');
      }
    });
    
    // Mark the next incomplete step as active
    const nextStep = this.getNextIncompleteStep();
    if (nextStep) {
      document.getElementById(nextStep).classList.add('active');
    }
    
    // Update setup visibility based on storage type
    this.updateSetupVisibility();
  }
  
  async checkAndShowSetupIfNeeded() {
    // Check if setup is complete
    const isSetupComplete = this.isSetupComplete();
    
    // Only show setup for Google Drive storage
    if (!isSetupComplete && this.settings.storageType === 'gdrive') {
      // Auto-show setup screen
      this.showSettings();
      
      // Scroll to the next incomplete step
      const nextStep = this.getNextIncompleteStep();
      if (nextStep) {
        // Small delay to ensure the settings panel is visible
        setTimeout(() => {
          const stepElement = document.getElementById(nextStep);
          if (stepElement) {
            stepElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
          }
        }, 100);
      }
    }
  }
  
  isSetupComplete() {
    // Setup is complete when we have a client ID and all steps are done
    return this.settings.clientId && 
           this.setupSteps.step1 && 
           this.setupSteps.step2 && 
           this.setupSteps.step3 && 
           this.setupSteps.step4;
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
    this.updateSetupVisibility();
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
    if (this.settings.storageType === 'local') {
      this.updateAuthStatus('local');
      return;
    }
    
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
        statusEl.style.display = 'flex';
        break;
      case 'disconnected':
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'auth-status disconnected';
        indicator.className = 'status-indicator status-disconnected';
        document.getElementById('connectBtn').innerHTML = '🔗 Connect Drive';
        statusEl.style.display = 'flex';
        break;
      case 'setup':
        statusEl.textContent = 'Setup Needed';
        statusEl.className = 'auth-status setup-needed';
        indicator.className = 'status-indicator status-setup';
        document.getElementById('connectBtn').innerHTML = '⚙️ Setup Required';
        statusEl.style.display = 'flex';
        break;
      case 'local':
        // Hide the status pill for localStorage - no status needed
        statusEl.style.display = 'none';
        document.getElementById('connectBtn').innerHTML = '💾 Local Mode';
        break;
    }
    
    // Only prepend indicator if status is visible
    if (statusEl.style.display !== 'none') {
      statusEl.insertBefore(indicator, statusEl.firstChild);
    }
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
    try {
      if (this.settings.storageType === 'local') {
        // Load from localStorage
        this.prompts = await this.storageManager.getPrompts();
      } else if (this.settings.storageType === 'gdrive') {
        // Load from Google Drive
        if (!this.settings.clientId) return;
        
        const response = await chrome.runtime.sendMessage({
          action: 'loadPrompts',
          clientId: this.settings.clientId
        });
        
        if (response.success) {
          this.prompts = response.prompts || [];
        }
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
        ? (this.settings.storageType === 'local' 
          ? 'No prompts yet. Click "Add Prompt" to create your first one!' 
          : (this.settings.clientId 
            ? 'No prompts yet. Click "Add Prompt" to create your first one!' 
            : 'Welcome to PromptDex. Click the ⚙️ settings button to set up your Google Drive integration.'))
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
    try {
      console.log('handleAddPrompt started');
      
      if (this.settings.storageType === 'gdrive' && !this.settings.clientId) {
        this.showSettings();
        this.showNotification('Please complete the setup wizard first', 'error');
        return;
      }
      
      console.log('Getting title...');
      const title = prompt('Enter prompt title:');
      if (!title) return;
      console.log('Title received:', title);
      
      console.log('Getting content...');
      const content = prompt('Enter prompt content (use {{variable}} for variables):');
      if (!content) return;
      console.log('Content received:', content);
      
      const newPrompt = {
        id: Date.now().toString(),
        title: title.trim(),
        content: content.trim(),
        category: this.categorizePrompt(content),
        createdAt: new Date().toISOString()
      };
      console.log('Created new prompt object:', newPrompt);
      
      let success = false;
      
      if (this.settings.storageType === 'local') {
        console.log('Using localStorage mode');
        
        try {
          // Add to prompts array first
          console.log('Current prompts count:', this.prompts.length);
          this.prompts.push(newPrompt);
          console.log('Added to prompts array, new count:', this.prompts.length);
          
          // Save to storage
          console.log('Calling savePrompts...');
          success = await this.storageManager.savePrompts(this.prompts);
          console.log('savePrompts completed, success:', success);
          
        } catch (storageError) {
          console.error('Storage error:', storageError);
          // Remove the prompt we just added if save failed
          this.prompts.pop();
          throw storageError;
        }
        
      } else if (this.settings.storageType === 'gdrive') {
        console.log('Using Google Drive mode');
        // Save to Google Drive
        const response = await chrome.runtime.sendMessage({
          action: 'savePrompt',
          prompt: newPrompt,
          clientId: this.settings.clientId
        });
        
        if (response.success) {
          this.prompts.push(newPrompt);
          success = true;
        }
      }
      
      console.log('Save operation completed, success:', success);
      
      if (success) {
        console.log('Updating UI...');
        this.renderCategories();
        this.renderPrompts();
        this.showNotification('Prompt saved successfully!', 'success');
        console.log('UI updated successfully');
      } else {
        this.showNotification('Failed to save prompt', 'error');
      }
      
    } catch (error) {
      console.error('handleAddPrompt error:', error);
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
  
  updateStepButtonStyling(stepId) {
    const stepEl = document.getElementById(stepId);
    if (!stepEl) return;
    
    // Find primary buttons in this step and make them less vibrant
    const primaryButtons = stepEl.querySelectorAll('.btn-wizard-primary');
    primaryButtons.forEach(button => {
      if (this.setupSteps[stepId]) {
        button.classList.add('completed-step-button');
      } else {
        button.classList.remove('completed-step-button');
      }
    });
  }
  
  updateSetupVisibility() {
    const setupWizard = document.querySelector('.setup-wizard');
    const localStorageInfo = document.querySelector('.local-storage-info');
    
    if (setupWizard && localStorageInfo) {
      if (this.settings.storageType === 'local') {
        setupWizard.style.display = 'none';
        localStorageInfo.style.display = 'block';
      } else {
        setupWizard.style.display = 'block';
        localStorageInfo.style.display = 'none';
      }
    }
  }
}

// Storage Manager class for localStorage support
class StorageManager {
  constructor() {
    this.prefix = 'promptdex_';
  }
  
  // Settings management
  saveSettings(settings) {
    try {
      localStorage.setItem(this.prefix + 'settings', JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save settings to localStorage:', error);
    }
  }
  
  getSettings() {
    try {
      const stored = localStorage.getItem(this.prefix + 'settings');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load settings from localStorage:', error);
      return {};
    }
  }
  
  // Setup steps management
  saveSetupSteps(steps) {
    try {
      localStorage.setItem(this.prefix + 'setupSteps', JSON.stringify(steps));
    } catch (error) {
      console.error('Failed to save setup steps to localStorage:', error);
    }
  }
  
  getSetupSteps() {
    try {
      const stored = localStorage.getItem(this.prefix + 'setupSteps');
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('Failed to load setup steps from localStorage:', error);
      return {};
    }
  }
  
  // Prompts management (for local storage option)
  async savePrompts(prompts) {
    try {
      // Validate prompts data to prevent circular references
      if (!Array.isArray(prompts)) {
        console.error('Invalid prompts data: not an array');
        return false;
      }
      
      // Create a clean copy to avoid any potential circular references
      const cleanPrompts = prompts.map(prompt => ({
        id: prompt.id,
        title: prompt.title,
        content: prompt.content,
        category: prompt.category,
        createdAt: prompt.createdAt,
        source: prompt.source
      }));
      
      // Save to localStorage first (synchronous)
      localStorage.setItem(this.prefix + 'prompts', JSON.stringify(cleanPrompts));
      
      // Then save to chrome.storage.local (async) - with timeout
      const saveTimeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Chrome storage timeout')), 5000)
      );
      
      const saveOperation = chrome.storage.local.set({localPrompts: cleanPrompts});
      
      await Promise.race([saveOperation, saveTimeout]);
      
      return true;
    } catch (error) {
      console.error('Failed to save prompts:', error);
      return false;
    }
  }
  
  async getPrompts() {
    try {
      // Try chrome.storage.local first (for background script updates), then localStorage
      const chromeResult = await chrome.storage.local.get(['localPrompts']);
      if (chromeResult.localPrompts) {
        // Sync to localStorage as well
        localStorage.setItem(this.prefix + 'prompts', JSON.stringify(chromeResult.localPrompts));
        return chromeResult.localPrompts;
      }
      
      // Fallback to localStorage
      const stored = localStorage.getItem(this.prefix + 'prompts');
      const prompts = stored ? JSON.parse(stored) : [];
      
      // Sync to chrome.storage.local
      if (prompts.length > 0) {
        await chrome.storage.local.set({localPrompts: prompts});
      }
      
      return prompts;
    } catch (error) {
      console.error('Failed to load prompts from localStorage:', error);
      return [];
    }
  }
  
  // Clear all data
  clearAll() {
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PopupManager();
});