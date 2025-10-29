class SimplePopupManager {
  constructor() {
    this.prompts = [];
    this.currentCategory = 'all';
    this.categories = ['general', 'writing', 'coding', 'analysis', 'communication', 'creative', 'business', 'education'];
    this.currentShortcut = 'Ctrl+Shift+P';
    this.isRecordingShortcut = false;
    this.isVivaldi = this.detectVivaldi();
    console.log('Browser detected:', this.isVivaldi ? 'Vivaldi' : 'Other');
    this.init();
  }
  
  detectVivaldi() {
    try {
      return navigator.userAgent.includes('Vivaldi') || 
             (window.vivaldi !== undefined) ||
             navigator.userAgent.includes('Chrome') && navigator.vendor.includes('Google') === false;
    } catch (error) {
      console.error('Error detecting browser:', error);
      return false;
    }
  }
  
  async init() {
    await this.loadPrompts();
    await this.loadCategories();
    await this.loadShortcut();
    this.setupEventListeners();
    this.renderCategories();
    this.renderPrompts();
    this.updateGuidanceText();
    
    // Check for pending right-click prompt
    await this.checkForRightClickPrompt();
  }
  
  setupEventListeners() {
    document.getElementById('addPromptBtn').addEventListener('click', () => this.showAddPromptModal());
    document.getElementById('searchBox').addEventListener('input', (e) => this.handleSearch(e.target.value));
    document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());
    document.getElementById('expandBtn').addEventListener('click', () => this.openFullView());
    
    // Modal events
    document.getElementById('savePrompt').addEventListener('click', () => this.handleSavePrompt());
    document.getElementById('cancelPrompt').addEventListener('click', () => this.hideAddPromptModal());
    document.getElementById('editCategories').addEventListener('click', () => this.showCategoryModal());
    
    // Category modal events
    document.getElementById('addCategory').addEventListener('click', () => this.addCategory());
    document.getElementById('closeCategoryModal').addEventListener('click', () => this.hideCategoryModal());
    
    // Settings modal events
    document.getElementById('exportData').addEventListener('click', () => this.exportData());
    document.getElementById('importData').addEventListener('click', () => document.getElementById('importFile').click());
    document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));
    document.getElementById('closeSettings').addEventListener('click', () => this.hideSettingsModal());
    document.getElementById('recordShortcut').addEventListener('click', () => this.startRecordingShortcut());
    document.getElementById('resetShortcut').addEventListener('click', () => this.resetShortcut());
    
    // Auto-predict title when content changes
    document.getElementById('promptContent').addEventListener('input', () => {
      if (!document.getElementById('promptTitle').value.trim()) {
        this.predictTitle();
      }
    });
    
    // Close modal when clicking overlay
    document.getElementById('addPromptModal').addEventListener('click', (e) => {
      if (e.target.id === 'addPromptModal') {
        this.hideAddPromptModal();
      }
    });
    
    document.getElementById('categoryModal').addEventListener('click', (e) => {
      if (e.target.id === 'categoryModal') {
        this.hideCategoryModal();
      }
    });
    
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        this.hideSettingsModal();
      }
    });
    
    // Categories
    document.getElementById('categories').addEventListener('click', (e) => {
      if (e.target.classList.contains('category-tab')) {
        this.selectCategory(e.target.dataset.category);
      }
    });
    
    // Prompts - handle action buttons
    document.getElementById('promptsList').addEventListener('click', (e) => {
      e.stopPropagation();
      
      if (e.target.classList.contains('prompt-action-btn')) {
        const promptId = e.target.closest('.prompt-item').dataset.promptId;
        const action = e.target.dataset.action;
        
        if (action === 'edit') {
          this.editPrompt(promptId);
        } else if (action === 'delete') {
          this.deletePrompt(promptId);
        } else if (action === 'use') {
          this.handlePromptSelect(promptId);
        }
      } else {
        const promptItem = e.target.closest('.prompt-item');
        if (promptItem) {
          this.handlePromptSelect(promptItem.dataset.promptId);
        }
      }
    });
  }
  
  async loadPrompts() {
    try {
      // Use chrome.storage.local for consistency with background script
      const result = await chrome.storage.local.get(['localPrompts']);
      this.prompts = result.localPrompts || [];
      console.log('Loaded prompts:', this.prompts.length);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      this.prompts = [];
    }
  }
  
  async savePrompts() {
    try {
      // For Vivaldi, add extra safety measures
      if (this.isVivaldi) {
        console.log('Using Vivaldi-safe storage method');
        
        // Check if localStorage is available
        if (typeof Storage === 'undefined') {
          console.error('localStorage not available');
          return false;
        }
        
        // Test write small data first using chrome.storage.local
        try {
          await chrome.storage.local.set({promptdex_test: 'test'});
          await chrome.storage.local.remove(['promptdex_test']);
        } catch (testError) {
          console.error('chrome.storage.local test failed:', testError);
          return false;
        }
        
        // Use smaller chunks for Vivaldi
        const dataString = JSON.stringify(this.prompts);
        console.log('Data size:', dataString.length, 'characters');
        
        // Split into chunks if too large (Vivaldi might have smaller limits)
        if (dataString.length > 1000000) { // 1MB limit
          console.warn('Data too large, truncating for Vivaldi compatibility');
          return false;
        }
      }
      
      // Use chrome.storage.local for consistency
      await chrome.storage.local.set({localPrompts: this.prompts});
      console.log('Saved prompts:', this.prompts.length);
      return true;
    } catch (error) {
      console.error('Failed to save prompts:', error);
      
      // Additional error handling for Vivaldi
      if (this.isVivaldi) {
        console.error('Vivaldi-specific error, trying alternative method');
        try {
          // Try saving with setTimeout to avoid blocking
          setTimeout(async () => {
            try {
              await chrome.storage.local.set({localPrompts: this.prompts});
              console.log('Delayed save successful');
            } catch (delayedError) {
              console.error('Delayed save also failed:', delayedError);
            }
          }, 100);
        } catch (timeoutError) {
          console.error('Timeout save failed:', timeoutError);
        }
      }
      
      return false;
    }
  }
  
  showAddPromptModal(promptToEdit = null, rightClickData = null) {
    console.log('Showing add prompt modal', promptToEdit ? 'for editing' : rightClickData ? 'for right-click' : 'for new prompt');
    const modal = document.getElementById('addPromptModal');
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('savePrompt');
    
    // Always populate dropdown first
    this.populateCategoryDropdown();
    
    modal.style.display = 'flex';
    
    if (promptToEdit) {
      // Editing mode
      modalTitle.textContent = 'Edit Prompt';
      saveBtn.textContent = 'Update Prompt';
      document.getElementById('promptContent').value = promptToEdit.content;
      document.getElementById('promptTitle').value = promptToEdit.title;
      document.getElementById('promptCategory').value = promptToEdit.category || 'general';
      this.editingPromptId = promptToEdit.id;
    } else if (rightClickData) {
      // Right-click mode with auto-filled data
      modalTitle.textContent = 'Save Selected Text as Prompt';
      saveBtn.textContent = 'Save Prompt';
      document.getElementById('promptContent').value = rightClickData.content;
      document.getElementById('promptTitle').value = rightClickData.title;
      document.getElementById('promptCategory').value = rightClickData.category;
      this.editingPromptId = null;
      
      // Show a helpful message about auto-filled data
      this.showNotification('Auto-filled from selected text. Review and save!', 'info');
    } else {
      // Add mode
      modalTitle.textContent = 'Add New Prompt';
      saveBtn.textContent = 'Save Prompt';
      document.getElementById('promptContent').value = '';
      document.getElementById('promptTitle').value = '';
      document.getElementById('promptCategory').value = 'general';
      this.editingPromptId = null;
    }
    
    // Focus on content input (content first now)
    setTimeout(() => {
      document.getElementById('promptContent').focus();
    }, 100);
  }
  
  hideAddPromptModal() {
    console.log('Hiding add prompt modal');
    const modal = document.getElementById('addPromptModal');
    modal.style.display = 'none';
  }
  
  predictTitle() {
    const content = document.getElementById('promptContent').value.trim();
    if (!content) return;
    
    // Extract first meaningful sentence or phrase
    let title = '';
    
    // Remove common prompt starters
    let cleanContent = content.replace(/^(please|can you|could you|help me|i need|i want|write|create|generate|explain|analyze)/i, '');
    
    // Get first sentence or first 50 characters
    const sentences = cleanContent.split(/[.!?]/);
    if (sentences.length > 0 && sentences[0].trim()) {
      title = sentences[0].trim();
    } else {
      title = cleanContent.substring(0, 50).trim();
    }
    
    // Clean up and capitalize
    title = title.replace(/{.*?}/g, '[variable]'); // Replace variables
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    // Limit length
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }
    
    // Set the predicted title
    document.getElementById('promptTitle').value = title || 'Custom Prompt';
    console.log('Predicted title:', title);
  }
  
  async handleSavePrompt() {
    try {
      console.log('Starting handleSavePrompt');
      
      const title = document.getElementById('promptTitle').value.trim();
      let content = document.getElementById('promptContent').value.trim();
      const category = document.getElementById('promptCategory').value;
      
      if (!content) {
        console.log('No content provided');
        this.showNotification('Please enter content', 'error');
        return;
      }
      
      // Check for old variable formats and offer conversion
      content = await this.checkAndConvertVariables(content);
      
      if (!title) {
        console.log('No title provided, auto-predicting');
        this.predictTitle();
        const predictedTitle = document.getElementById('promptTitle').value.trim();
        if (!predictedTitle) {
          this.showNotification('Please enter a title', 'error');
          return;
        }
      }
      
      const finalTitle = document.getElementById('promptTitle').value.trim();
      
      if (this.editingPromptId) {
        // Update existing prompt
        const promptIndex = this.prompts.findIndex(p => p.id === this.editingPromptId);
        if (promptIndex >= 0) {
          this.prompts[promptIndex] = {
            ...this.prompts[promptIndex],
            title: finalTitle,
            content: content,
            category: category,
            updatedAt: new Date().toISOString()
          };
          console.log('Updated prompt:', this.prompts[promptIndex]);
        }
      } else {
        // Create new prompt
        const newPrompt = {
          id: Date.now().toString(),
          title: finalTitle,
          content: content,
          category: category,
          createdAt: new Date().toISOString()
        };
        
        console.log('Created prompt:', newPrompt);
        this.prompts.push(newPrompt);
      }
      
      console.log('Total prompts:', this.prompts.length);
      
      // Save to localStorage
      const saved = await this.savePrompts();
      console.log('Save result:', saved);
      
      if (saved) {
        this.hideAddPromptModal();
        this.renderCategories();
        this.renderPrompts();
        this.showNotification(this.editingPromptId ? 'Prompt updated successfully!' : 'Prompt saved successfully!', 'success');
      } else {
        if (!this.editingPromptId) {
          // Remove from array if save failed for new prompt
          this.prompts.pop();
        }
        this.showNotification('Failed to save prompt', 'error');
      }
      
    } catch (error) {
      console.error('Error in handleSavePrompt:', error);
      this.showNotification('Error: ' + error.message, 'error');
    }
  }
  
  editPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (prompt) {
      this.showAddPromptModal(prompt);
    }
  }
  
  async deletePrompt(promptId) {
    if (confirm('Are you sure you want to delete this prompt?')) {
      try {
        const promptIndex = this.prompts.findIndex(p => p.id === promptId);
        if (promptIndex >= 0) {
          this.prompts.splice(promptIndex, 1);
          const saved = await this.savePrompts();
          
          if (saved) {
            this.renderCategories();
            this.renderPrompts();
            this.showNotification('Prompt deleted successfully!', 'success');
          } else {
            this.showNotification('Failed to delete prompt', 'error');
          }
        }
      } catch (error) {
        console.error('Error deleting prompt:', error);
        this.showNotification('Error: ' + error.message, 'error');
      }
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
        ? 'No prompts yet. Click "Add Prompt" to create your first one!' 
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
      <div class="prompt-item" data-prompt-id="${prompt.id}" style="position: relative;">
        <button class="prompt-action-btn edit" data-action="edit" style="position: absolute; top: 8px; right: 8px; background: #ea580c; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 12px; cursor: pointer; z-index: 2;">✏️</button>
        <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
        <div class="prompt-preview">${this.escapeHtml(this.truncate(prompt.content, 120))}</div>
        <div class="prompt-actions">
          <button class="prompt-action-btn use" data-action="use">Use</button>
          <button class="prompt-action-btn delete" data-action="delete" style="position: absolute; bottom: 8px; right: 8px; background: #ea580c; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 12px; cursor: pointer; z-index: 2;">🗑️</button>
        </div>
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
      
      console.log('Current tab URL:', activeTab.url);
      console.log('Is AI tab:', this.isAITab(activeTab.url));
      
      if (this.isAITab(activeTab.url)) {
        // With the new embedded approach, instruct user to use keyboard shortcut
        this.showNotification('Go to the ChatGPT/Claude tab and press Ctrl+Shift+P to open the prompt picker!', 'info');
        
        // Close popup after a short delay
        setTimeout(() => {
          window.close();
        }, 3000);
      } else {
        console.log('Not an AI tab, current URL:', activeTab.url);
        this.showNotification(`Please navigate to ${PROMPTDEX_CONFIG.getPlatformUrls()} and press Ctrl+Shift+P to use prompts.`, 'error');
      }
    } catch (error) {
      console.error('Failed to check tab:', error);
      this.showNotification('Error: ' + error.message, 'error');
    }
  }
  
  isAITab(url) {
    const isAI = PROMPTDEX_CONFIG.isAIUrl(url);
    console.log('isAITab check:', url, '->', isAI);
    return isAI;
  }
  
  showNotification(message, type = 'info') {
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
      ${type === 'success' ? 'background: #14b8a6;' : 
        type === 'error' ? 'background: #dc2626;' : 
        'background: #f97316;'}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
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
  
  truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Category Management Methods
  async loadCategories() {
    try {
      const result = await chrome.storage.local.get(['customCategories']);
      if (result.customCategories) {
        this.categories = result.customCategories;
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  }

  async saveCategories() {
    try {
      await chrome.storage.local.set({customCategories: this.categories});
      return true;
    } catch (error) {
      console.error('Failed to save categories:', error);
      return false;
    }
  }

  showCategoryModal() {
    document.getElementById('categoryModal').style.display = 'flex';
    this.renderCategoryList();
    this.populateCategoryDropdown();
  }

  hideCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
  }

  renderCategoryList() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = this.categories.map(category => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; border: 1px solid #334155; border-radius: 6px; margin-bottom: 4px; background: #0f0f23;">
        <span style="color: #e2e8f0; text-transform: capitalize;">${category}</span>
        <div style="display: flex; gap: 4px;">
          <button class="category-edit-btn" data-category="${category}" style="background: #ea580c; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;">✏️</button>
          <button class="category-delete-btn" data-category="${category}" style="background: #ea580c; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;">🗑️</button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    categoryList.querySelectorAll('.category-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.editCategory(e.target.dataset.category));
    });

    categoryList.querySelectorAll('.category-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.deleteCategory(e.target.dataset.category));
    });
  }

  async addCategory() {
    const newCategoryName = document.getElementById('newCategoryName').value.trim().toLowerCase();
    if (!newCategoryName) {
      this.showNotification('Please enter a category name', 'error');
      return;
    }

    if (this.categories.includes(newCategoryName)) {
      this.showNotification('Category already exists', 'error');
      return;
    }

    this.categories.push(newCategoryName);
    await this.saveCategories();
    this.renderCategoryList();
    this.populateCategoryDropdown();
    this.renderCategories();
    document.getElementById('newCategoryName').value = '';
    this.showNotification('Category added successfully!', 'success');
  }

  async editCategory(oldCategory) {
    const newName = prompt('Edit category name:', oldCategory);
    if (!newName || newName.trim() === '') return;

    const newCategoryName = newName.trim().toLowerCase();
    if (newCategoryName === oldCategory) return;

    if (this.categories.includes(newCategoryName)) {
      this.showNotification('Category already exists', 'error');
      return;
    }

    // Update category in list
    const categoryIndex = this.categories.indexOf(oldCategory);
    this.categories[categoryIndex] = newCategoryName;

    // Update all prompts with this category
    this.prompts.forEach(prompt => {
      if (prompt.category === oldCategory) {
        prompt.category = newCategoryName;
      }
    });

    await this.saveCategories();
    await this.savePrompts();
    this.renderCategoryList();
    this.populateCategoryDropdown();
    this.renderCategories();
    this.renderPrompts();
    this.showNotification('Category updated successfully!', 'success');
  }

  async deleteCategory(categoryToDelete) {
    if (!confirm(`Delete category "${categoryToDelete}"? Prompts in this category will be moved to "uncategorised".`)) {
      return;
    }

    // Remove from categories list
    this.categories = this.categories.filter(cat => cat !== categoryToDelete);

    // Add uncategorised if it doesn't exist
    if (!this.categories.includes('uncategorised')) {
      this.categories.push('uncategorised');
    }

    // Move prompts to uncategorised
    this.prompts.forEach(prompt => {
      if (prompt.category === categoryToDelete) {
        prompt.category = 'uncategorised';
      }
    });

    await this.saveCategories();
    await this.savePrompts();
    this.renderCategoryList();
    this.populateCategoryDropdown();
    this.renderCategories();
    this.renderPrompts();
    this.showNotification('Category deleted. Prompts moved to uncategorised.', 'success');
  }

  populateCategoryDropdown() {
    const categorySelect = document.getElementById('promptCategory');
    categorySelect.innerHTML = this.categories.map(category => 
      `<option value="${category}">${category.charAt(0).toUpperCase() + category.slice(1)}</option>`
    ).join('');
  }

  // Keyboard Shortcut Methods
  async loadShortcut() {
    try {
      const result = await chrome.storage.local.get(['customShortcut']);
      if (result.customShortcut) {
        this.currentShortcut = result.customShortcut;
      }
    } catch (error) {
      console.error('Failed to load shortcut:', error);
    }
  }

  async saveShortcut() {
    try {
      await chrome.storage.local.set({customShortcut: this.currentShortcut});
      return true;
    } catch (error) {
      console.error('Failed to save shortcut:', error);
      return false;
    }
  }

  updateGuidanceText() {
    const guidanceElements = document.querySelectorAll('.shortcut-guidance');
    guidanceElements.forEach(el => {
      if (el) {
        el.textContent = `On ChatGPT/Claude: Press ${this.currentShortcut}`;
      }
    });
  }

  startRecordingShortcut() {
    this.isRecordingShortcut = true;
    const recordBtn = document.getElementById('recordShortcut');
    const shortcutInput = document.getElementById('shortcutInput');
    
    recordBtn.textContent = 'Press Keys...';
    recordBtn.disabled = true;
    shortcutInput.value = 'Press your key combination...';
    shortcutInput.style.background = '#ea580c';
    
    // Listen for keydown on the whole document
    document.addEventListener('keydown', this.handleShortcutRecording.bind(this), true);
  }

  handleShortcutRecording(e) {
    if (!this.isRecordingShortcut) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const keys = [];
    if (e.ctrlKey) keys.push('Ctrl');
    if (e.altKey) keys.push('Alt');
    if (e.shiftKey) keys.push('Shift');
    if (e.metaKey) keys.push('Meta');
    
    // Add the main key if it's not a modifier
    if (!['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
      keys.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
      
      // Only finish recording when we have modifier(s) + a non-modifier key
      if (keys.length > 1) {
        const shortcut = keys.join('+');
        this.finishRecordingShortcut(shortcut);
      }
    }
    // Don't finish recording if only modifiers are pressed
  }

  async finishRecordingShortcut(shortcut) {
    this.isRecordingShortcut = false;
    document.removeEventListener('keydown', this.handleShortcutRecording.bind(this), true);
    
    const recordBtn = document.getElementById('recordShortcut');
    const shortcutInput = document.getElementById('shortcutInput');
    
    recordBtn.textContent = 'Record New';
    recordBtn.disabled = false;
    shortcutInput.style.background = '#0f0f23';
    
    this.currentShortcut = shortcut;
    shortcutInput.value = shortcut;
    
    await this.saveShortcut();
    this.updateGuidanceText();
    this.showNotification(`Shortcut updated to ${shortcut}`, 'success');
  }

  async resetShortcut() {
    this.currentShortcut = 'Ctrl+Shift+P';
    await this.saveShortcut();
    
    const shortcutInput = document.getElementById('shortcutInput');
    shortcutInput.value = this.currentShortcut;
    
    this.updateGuidanceText();
    this.showNotification('Shortcut reset to default', 'success');
  }

  // Settings Modal Methods
  showSettingsModal() {
    document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('shortcutInput').value = this.currentShortcut;
  }

  hideSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
  }

  async exportData() {
    try {
      const data = {
        prompts: this.prompts,
        categories: this.categories,
        exportDate: new Date().toISOString(),
        version: '1.1'
      };

      const dataStr = JSON.stringify(data, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `promptdex-backup-${timestamp}.json`;

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      this.showNotification(`Backup exported: ${this.prompts.length} prompts, ${this.categories.length} categories`, 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Failed to export data', 'error');
    }
  }

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // Validate the data structure
      if (!this.validateImportData(data)) {
        this.showNotification('Invalid backup file format', 'error');
        return;
      }

      // Ask for confirmation
      const promptCount = data.prompts ? data.prompts.length : 0;
      const categoryCount = data.categories ? data.categories.length : 0;
      
      if (!confirm(`Import ${promptCount} prompts and ${categoryCount} categories? This will replace your current data.`)) {
        return;
      }

      // Import the data
      if (data.prompts) {
        this.prompts = data.prompts;
        await this.savePrompts();
      }

      if (data.categories) {
        this.categories = data.categories;
        await this.saveCategories();
      }

      // Refresh the UI
      this.renderCategories();
      this.renderPrompts();
      this.populateCategoryDropdown();

      this.showNotification(`Successfully imported ${promptCount} prompts and ${categoryCount} categories!`, 'success');
      this.hideSettingsModal();

    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification('Failed to import data. Please check the file format.', 'error');
    }

    // Clear the file input
    event.target.value = '';
  }

  validateImportData(data) {
    // Check if data has the required structure
    if (!data || typeof data !== 'object') {
      return false;
    }

    // Check prompts array
    if (data.prompts && Array.isArray(data.prompts)) {
      for (const prompt of data.prompts) {
        if (!prompt.id || !prompt.title || !prompt.content || !prompt.category) {
          return false;
        }
      }
    }

    // Check categories array
    if (data.categories && !Array.isArray(data.categories)) {
      return false;
    }

    return true;
  }

  async checkAndConvertVariables(content) {
    // Check for old double bracket format {{variable}}
    const hasDoubleBrackets = /\{\{[^}]+\}\}/.test(content);
    
    // Check for var[variable] format
    const hasVarBrackets = /var\[[^\]]+\]/gi.test(content);
    
    // Check for angle bracket format <variable>
    const hasAngleBrackets = /<[^>]+>/.test(content);
    
    // Check for single-value [variable] format (not multiple choice)
    const singleValueBrackets = [];
    const bracketMatches = content.match(/\[[^\]]+\]/g) || [];
    bracketMatches.forEach(match => {
      const content_inner = match.slice(1, -1);
      const hasMultipleValues = /[,\/\|]|(\s+or\s+)|(\s+and\s+)/.test(content_inner.trim());
      if (!hasMultipleValues && /^[a-zA-Z_][a-zA-Z0-9_\s]*$/.test(content_inner.trim())) {
        singleValueBrackets.push(match);
      }
    });
    
    if (hasDoubleBrackets || hasVarBrackets || hasAngleBrackets || singleValueBrackets.length > 0) {
      let conversionMessage = 'Found old variable format(s) in your prompt:\n\n';
      
      if (hasDoubleBrackets) {
        const doubleBracketVars = content.match(/\{\{[^}]+\}\}/g) || [];
        conversionMessage += `• Double brackets: ${doubleBracketVars.join(', ')}\n`;
      }
      
      if (hasVarBrackets) {
        const varBracketVars = content.match(/var\[[^\]]+\]/gi) || [];
        conversionMessage += `• Var format: ${varBracketVars.join(', ')}\n`;
      }
      
      if (hasAngleBrackets) {
        const angleBracketVars = content.match(/<[^>]+>/g) || [];
        conversionMessage += `• Angle brackets: ${angleBracketVars.join(', ')}\n`;
      }
      
      if (singleValueBrackets.length > 0) {
        conversionMessage += `• Single variables: ${singleValueBrackets.join(', ')}\n`;
      }
      
      conversionMessage += '\nWould you like to convert them to the new {variable} format?\n';
      conversionMessage += '(Note: [option1/option2/option3] will remain as multiple choice)';
      
      if (confirm(conversionMessage)) {
        // Convert {{variable}} to {variable}
        let convertedContent = content.replace(/\{\{([^}]+)\}\}/g, '{$1}');
        
        // Convert var[variable] to {variable}
        convertedContent = convertedContent.replace(/var\[([^\]]+)\]/gi, '{$1}');
        
        // Convert <variable> to {variable}
        convertedContent = convertedContent.replace(/<([^>]+)>/g, '{$1}');
        
        // Convert single-value [variable] to {variable}
        convertedContent = convertedContent.replace(/\[([^\]]+)\]/g, (match, content_inner) => {
          const hasMultipleValues = /[,\/\|]|(\s+or\s+)|(\s+and\s+)/.test(content_inner.trim());
          if (!hasMultipleValues && /^[a-zA-Z_][a-zA-Z0-9_\s]*$/.test(content_inner.trim())) {
            return `{${content_inner.trim()}}`;
          }
          return match; // Keep multiple choice as [option1/option2/option3]
        });
        
        // Update the textarea to show the converted content
        document.getElementById('promptContent').value = convertedContent;
        
        this.showNotification('Variables converted to new format!', 'success');
        return convertedContent;
      }
    }
    
    return content;
  }

  async checkForRightClickPrompt() {
    try {
      const result = await chrome.storage.local.get(['pendingRightClickPrompt']);
      if (result.pendingRightClickPrompt) {
        const promptData = result.pendingRightClickPrompt;
        console.log('Found pending right-click prompt:', promptData);
        
        // Clear the pending data
        await chrome.storage.local.remove(['pendingRightClickPrompt']);
        
        // Show the add prompt modal with auto-filled data
        this.showAddPromptModal(null, promptData);
      }
    } catch (error) {
      console.error('Error checking for right-click prompt:', error);
    }
  }

  openFullView() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('fullview/fullview.html')
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SimplePopupManager();
});