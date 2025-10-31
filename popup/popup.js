class SimplePopupManager {
  constructor() {
    this.prompts = [];
    this.currentCategory = 'all';
    this.categories = ['general', 'writing', 'coding', 'analysis', 'communication', 'creative', 'business', 'education'];
    this.currentShortcut = 'Ctrl+Shift+P';
    this.isRecordingShortcut = false;
    this.isVivaldi = this.detectVivaldi();
    this.draftData = null;
    this.lastSelectedCategory = 'general';
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
    await this.loadDraftData();
    await this.loadLastSelectedCategory();
    await this.loadCustomUrls();
    this.setupEventListeners();
    this.renderCategories();
    this.renderPrompts();
    this.updateGuidanceText();
    
    // Check for pending right-click prompt
    await this.checkForRightClickPrompt();
  }
  
  setupEventListeners() {
    try {
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
    document.getElementById('cleanupBrackets').addEventListener('click', () => this.cleanupAllVariableFormats());
    document.getElementById('editUrls').addEventListener('click', () => this.showUrlManager());
    document.getElementById('addUrl').addEventListener('click', () => this.addCustomUrl());
    document.getElementById('closeUrlManager').addEventListener('click', () => this.hideUrlManager());
    
    // Auto-predict title when content changes and save draft
    document.getElementById('promptContent').addEventListener('input', () => {
      if (!document.getElementById('promptTitle').value.trim()) {
        this.predictTitle();
      }
      this.saveDraftData();
    });
    
    // Save draft when title changes
    document.getElementById('promptTitle').addEventListener('input', () => {
      this.saveDraftData();
    });
    
    // Save draft when category changes
    document.getElementById('promptCategory').addEventListener('change', () => {
      this.saveDraftData();
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
        } else if (action === 'copy') {
          this.copyPrompt(promptId);
        }
      } else {
        const promptItem = e.target.closest('.prompt-item');
        if (promptItem) {
          this.handlePromptSelect(promptItem.dataset.promptId);
        }
      }
    });
    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
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
      // Add mode - check for draft data first
      modalTitle.textContent = 'Add New Prompt';
      saveBtn.textContent = 'Save Prompt';
      
      if (this.draftData && (this.draftData.content || this.draftData.title)) {
        // Restore draft data
        document.getElementById('promptContent').value = this.draftData.content || '';
        document.getElementById('promptTitle').value = this.draftData.title || '';
        document.getElementById('promptCategory').value = this.draftData.category || this.lastSelectedCategory;
        
        // Show indication that draft was restored
        this.showNotification('📝 Draft restored from previous session', 'info');
      } else {
        // No draft, use defaults
        document.getElementById('promptContent').value = '';
        document.getElementById('promptTitle').value = '';
        document.getElementById('promptCategory').value = this.lastSelectedCategory;
      }
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
    
    // Save current form data as draft if not editing
    if (!this.editingPromptId) {
      this.saveDraftData();
    }
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
        this.showNotification('Please write your prompt content before saving', 'error');
        return;
      }
      
      // Check for old variable formats and offer conversion
      content = await this.checkAndConvertVariables(content);
      
      if (!title) {
        console.log('No title provided, auto-predicting');
        this.predictTitle();
        const predictedTitle = document.getElementById('promptTitle').value.trim();
        if (!predictedTitle) {
          this.showNotification('Please give your prompt a title', 'error');
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
        // Remember the last selected category for new prompts
        if (!this.editingPromptId) {
          this.lastSelectedCategory = category;
          await this.saveLastSelectedCategory();
        }
        
        // Clear draft data on successful save
        await this.clearDraftData();
        
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
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    const promptTitle = prompt.title.length > 30 ? prompt.title.substring(0, 30) + '...' : prompt.title;
    if (confirm(`Are you sure you want to delete "${promptTitle}"?\n\nThis action cannot be undone.`)) {
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
  
  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return this.escapeHtml(text);
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark style="background: #f59e0b; color: #000; padding: 1px 2px; border-radius: 2px;">$1</mark>');
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
        <button class="prompt-action-btn delete" data-action="delete" style="position: absolute; top: 8px; right: 8px; background: transparent; color: #dc2626; border: none; padding: 4px; border-radius: 4px; font-size: 12px; cursor: pointer; z-index: 2;"><i class="far fa-trash-alt"></i></button>
        <button class="prompt-action-btn edit" data-action="edit" style="position: absolute; top: 8px; right: 40px; background: #ea580c; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 12px; cursor: pointer; z-index: 2;"><i class="far fa-edit"></i></button>
        <div class="prompt-title">${this.highlightSearchTerm(prompt.title, searchTerm)}</div>
        <div class="prompt-preview">${this.highlightSearchTerm(this.truncate(prompt.content, 120), searchTerm)}</div>
        <div class="prompt-actions">
          <button class="prompt-action-btn use" data-action="use">Use</button>
          <button class="prompt-action-btn copy" data-action="copy" title="Copy to clipboard"><i class="far fa-copy"></i></button>
        </div>
      </div>
    `).join('');
  }
  
  handleSearch(term) {
    this.renderPrompts();
  }
  
  async copyPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    try {
      await navigator.clipboard.writeText(prompt.content);
      this.showNotification('Prompt copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy prompt:', error);
      this.showNotification('Failed to copy prompt', 'error');
    }
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
        // Inject directly into the current AI tab
        try {
          await chrome.tabs.sendMessage(activeTab.id, {
            action: 'injectPrompt',
            prompt: prompt
          });
          this.showNotification('Prompt injected into chat!', 'success');
          window.close();
        } catch (error) {
          // Fallback: copy to clipboard
          await navigator.clipboard.writeText(prompt.content);
          this.showNotification('Prompt copied to clipboard!', 'success');
          window.close();
        }
      } else {
        // Auto-navigate to default LLM and inject prompt after page loads
        const defaultLLM = await this.getDefaultLLM();
        const newTab = await chrome.tabs.create({ url: defaultLLM });
        this.showNotification('Opening AI chat and injecting prompt...', 'success');
        window.close();
        
        // Wait for the tab to load, then inject the prompt
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(newTab.id, {
              action: 'injectPrompt',
              prompt: prompt
            });
          } catch (error) {
            // If injection fails, copy to clipboard as fallback
            console.log('Auto-injection failed, copying to clipboard');
            await navigator.clipboard.writeText(prompt.content);
          }
        }, 3000); // Wait 3 seconds for page to load
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
        type === 'navigate' ? 'background: #14b8a6;' :
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
          <button class="category-edit-btn" data-category="${category}" style="background: #ea580c; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;"><i class="far fa-edit"></i></button>
          <button class="category-delete-btn" data-category="${category}" style="background: #ea580c; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;"><i class="far fa-trash-alt"></i></button>
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
      this.showNotification('Please type a name for your new category', 'error');
      return;
    }

    if (this.categories.includes(newCategoryName)) {
      this.showNotification('That category name is already being used. Try a different one.', 'error');
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
    try {
      const categorySelect = document.getElementById('promptCategory');
      if (!categorySelect) {
        console.warn('Category select element not found');
        return;
      }
      
      categorySelect.innerHTML = this.categories.map(category => {
        if (!category || typeof category !== 'string') return '';
        const safeCategoryValue = category.replace(/['"]/g, ''); // Remove quotes that could break HTML
        const safeCategoryDisplay = this.escapeHtml(category.charAt(0).toUpperCase() + category.slice(1));
        return `<option value="${safeCategoryValue}">${safeCategoryDisplay}</option>`;
      }).filter(option => option).join('');
    } catch (error) {
      console.error('Error populating category dropdown:', error);
    }
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
        el.innerHTML = `On ChatGPT/Claude: Press <span style="color: #14b8a6;">${this.currentShortcut}</span>`;
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
    this.updateUrlCount();
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

      // Calculate import stats
      const promptCount = data.prompts ? data.prompts.length : 0;
      const categoryCount = data.categories ? data.categories.length : 0;
      
      if (!confirm(`Import ${promptCount} prompts and ${categoryCount} categories? New prompts will be added to your existing collection (duplicates will be skipped).`)) {
        return;
      }

      let newPromptsAdded = 0;
      let duplicatesSkipped = 0;
      let newCategoriesAdded = 0;

      // Import prompts - merge instead of replace
      if (data.prompts && data.prompts.length > 0) {
        const existingTitles = new Set(this.prompts.map(p => p.title.toLowerCase().trim()));
        
        data.prompts.forEach(importedPrompt => {
          try {
            // Ensure we have valid data
            if (!importedPrompt || !importedPrompt.title || !importedPrompt.content) {
              console.warn('Skipping invalid prompt:', importedPrompt);
              return;
            }
            
            // Check for duplicates based on title
            const titleKey = importedPrompt.title.toLowerCase().trim();
            if (!existingTitles.has(titleKey)) {
              // Convert old variable formats to our standard
              const convertedContent = this.convertVariableFormatsImport(importedPrompt.content.trim());
              
              // Ensure the prompt has a unique ID and valid category
              const newPrompt = {
                ...importedPrompt,
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                importedAt: new Date().toISOString(),
                category: importedPrompt.category || 'general', // Fallback category
                title: importedPrompt.title.trim(),
                content: convertedContent
              };
              this.prompts.push(newPrompt);
              existingTitles.add(titleKey);
              newPromptsAdded++;
            } else {
              duplicatesSkipped++;
            }
          } catch (promptError) {
            console.error('Error processing imported prompt:', promptError, importedPrompt);
            duplicatesSkipped++; // Count as skipped rather than crashing
          }
        });
        
        await this.savePrompts();
      }

      // Import categories - merge instead of replace
      if (data.categories && data.categories.length > 0) {
        const existingCategories = new Set(this.categories.map(c => c.toLowerCase().trim()));
        
        data.categories.forEach(category => {
          // Skip if category is empty or invalid
          if (!category || typeof category !== 'string') return;
          
          const categoryKey = category.toLowerCase().trim();
          if (categoryKey && !existingCategories.has(categoryKey)) {
            this.categories.push(category.trim());
            existingCategories.add(categoryKey);
            newCategoriesAdded++;
          }
        });
        
        await this.saveCategories();
      }

      // Refresh the UI
      try {
        await this.loadCategories(); // Reload categories from storage first
        this.renderCategories();
        this.renderPrompts();
        this.populateCategoryDropdown();
      } catch (renderError) {
        console.error('Error refreshing UI after import:', renderError);
        this.showNotification('Import completed but there was an issue refreshing the display. Please restart the extension.', 'warning');
      }

      // Show detailed success message
      let message = `Import completed! Added ${newPromptsAdded} new prompts`;
      if (newCategoriesAdded > 0) {
        message += ` and ${newCategoriesAdded} new categories`;
      }
      if (duplicatesSkipped > 0) {
        message += `. Skipped ${duplicatesSkipped} duplicate prompts`;
      }
      
      this.showNotification(message, 'success');
      this.hideSettingsModal();

    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification('Failed to import data. Please check the file format.', 'error');
    }

    // Clear the file input
    event.target.value = '';
  }

  validateImportData(data) {
    try {
      // Check if data has the required structure
      if (!data || typeof data !== 'object') {
        console.error('Import data is not an object');
        return false;
      }

      // Check prompts array
      if (data.prompts && Array.isArray(data.prompts)) {
        for (const prompt of data.prompts) {
          if (!prompt || typeof prompt !== 'object') {
            console.error('Invalid prompt object found');
            return false;
          }
          if (!prompt.title || typeof prompt.title !== 'string') {
            console.error('Prompt missing valid title');
            return false;
          }
          if (!prompt.content || typeof prompt.content !== 'string') {
            console.error('Prompt missing valid content');
            return false;
          }
          // Category and ID are less critical, can be auto-generated
        }
      }

      // Check categories array
      if (data.categories && !Array.isArray(data.categories)) {
        console.error('Categories is not an array');
        return false;
      }

      if (data.categories) {
        for (const category of data.categories) {
          if (typeof category !== 'string') {
            console.error('Invalid category found (not a string)');
            return false;
          }
        }
      }

      return true;
    } catch (error) {
      console.error('Error validating import data:', error);
      return false;
    }
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

  convertVariableFormatsImport(content) {
    // Automatically convert old formats during import (no user confirmation needed)
    try {
      let convertedContent = content;
      
      // Convert {{variable}} to {variable}
      convertedContent = convertedContent.replace(/\{\{([^}]+)\}\}/g, '{$1}');
      
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
      
      return convertedContent;
    } catch (error) {
      console.error('Error converting variable formats during import:', error);
      return content;
    }
  }

  async cleanupAllVariableFormats() {
    try {
      if (!confirm('This will convert old variable formats ({{var}} and [single]) to our standard {variable} format across ALL your prompts.\n\nMultiple choice options like [opt1/opt2/opt3] will be preserved.\n\nContinue?')) {
        return;
      }
      
      let convertedCount = 0;
      
      this.prompts.forEach(prompt => {
        const originalContent = prompt.content;
        const convertedContent = this.convertVariableFormatsImport(prompt.content);
        
        if (originalContent !== convertedContent) {
          prompt.content = convertedContent;
          convertedCount++;
        }
      });
      
      if (convertedCount > 0) {
        await this.savePrompts();
        this.renderPrompts();
        this.showNotification(`✅ Cleaned up variable formats in ${convertedCount} prompts!`, 'success');
      } else {
        this.showNotification('No variable formats needed cleanup.', 'info');
      }
    } catch (error) {
      console.error('Error during cleanup:', error);
      this.showNotification('Error during cleanup. Please try again.', 'error');
    }
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

  // Draft Data Management
  async loadDraftData() {
    try {
      const result = await chrome.storage.local.get(['promptDraftData']);
      this.draftData = result.promptDraftData || null;
      console.log('Loaded draft data:', this.draftData);
    } catch (error) {
      console.error('Failed to load draft data:', error);
      this.draftData = null;
    }
  }

  async saveDraftData() {
    try {
      // Only save if modal is open and we're not editing
      const modal = document.getElementById('addPromptModal');
      if (modal.style.display !== 'flex' || this.editingPromptId) {
        return;
      }

      const content = document.getElementById('promptContent').value;
      const title = document.getElementById('promptTitle').value;
      const category = document.getElementById('promptCategory').value;

      // Only save if there's actual content
      if (content.trim() || title.trim()) {
        this.draftData = {
          content: content,
          title: title,
          category: category,
          timestamp: new Date().toISOString()
        };
        
        await chrome.storage.local.set({promptDraftData: this.draftData});
        console.log('Saved draft data:', this.draftData);
      }
    } catch (error) {
      console.error('Failed to save draft data:', error);
    }
  }

  async clearDraftData() {
    try {
      this.draftData = null;
      await chrome.storage.local.remove(['promptDraftData']);
      console.log('Cleared draft data');
    } catch (error) {
      console.error('Failed to clear draft data:', error);
    }
  }

  // Last Selected Category Management
  async loadLastSelectedCategory() {
    try {
      const result = await chrome.storage.local.get(['lastSelectedCategory']);
      this.lastSelectedCategory = result.lastSelectedCategory || 'general';
      console.log('Loaded last selected category:', this.lastSelectedCategory);
    } catch (error) {
      console.error('Failed to load last selected category:', error);
      this.lastSelectedCategory = 'general';
    }
  }

  async saveLastSelectedCategory() {
    try {
      await chrome.storage.local.set({lastSelectedCategory: this.lastSelectedCategory});
      console.log('Saved last selected category:', this.lastSelectedCategory);
    } catch (error) {
      console.error('Failed to save last selected category:', error);
    }
  }

  // Custom URLs Management
  async loadCustomUrls() {
    try {
      const result = await chrome.storage.local.get(['customUrls']);
      this.customUrls = result.customUrls || [
        'chatgpt.com',
        'chat.openai.com', 
        'claude.ai',
        'gemini.google.com',
        'ai.com',
        'perplexity.ai',
        'www.deepseek.com',
        'deepseek.com',
        'x.com',
        'meta.ai',
        'grok.com'
      ];
      console.log('Loaded custom URLs:', this.customUrls);
      this.updateUrlCount();
    } catch (error) {
      console.error('Failed to load custom URLs:', error);
      this.customUrls = [
        'chatgpt.com',
        'chat.openai.com', 
        'claude.ai',
        'gemini.google.com',
        'ai.com',
        'perplexity.ai',
        'www.deepseek.com',
        'deepseek.com',
        'x.com',
        'meta.ai',
        'grok.com'
      ];
      this.updateUrlCount();
    }
  }

  async saveCustomUrls() {
    try {
      await chrome.storage.local.set({customUrls: this.customUrls});
      console.log('Saved custom URLs:', this.customUrls);
    } catch (error) {
      console.error('Failed to save custom URLs:', error);
    }
  }

  renderUrlList() {
    const urlList = document.getElementById('urlList');
    if (!urlList) return;

    urlList.innerHTML = this.customUrls.map(url => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px; border: 1px solid #334155; border-radius: 4px; margin-bottom: 4px; background: #0f0f23;">
        <span style="color: #e2e8f0; font-size: 12px; font-family: monospace;">${this.escapeHtml(url)}</span>
        <button class="url-delete-btn" data-url="${this.escapeHtml(url)}" style="background: #ea580c; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;"><i class="far fa-trash-alt"></i></button>
      </div>
    `).join('');

    // Add event listeners to delete buttons
    urlList.querySelectorAll('.url-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const url = e.target.closest('button').dataset.url;
        this.deleteCustomUrl(url);
      });
    });
  }

  async addCustomUrl() {
    const url = prompt('Enter URL (e.g., chat.openai.com):');
    if (!url || !url.trim()) return;

    const cleanUrl = url.trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    if (this.customUrls.includes(cleanUrl)) {
      this.showNotification('URL already exists', 'error');
      return;
    }

    this.customUrls.push(cleanUrl);
    await this.saveCustomUrls();
    this.renderUrlList();
    this.updateUrlCount();
    this.showNotification('URL added successfully!', 'success');
  }

  async deleteCustomUrl(url) {
    if (!confirm(`Remove ${url} from supported URLs?`)) return;

    this.customUrls = this.customUrls.filter(u => u !== url);
    await this.saveCustomUrls();
    this.renderUrlList();
    this.updateUrlCount();
    this.showNotification('URL removed successfully!', 'success');
  }

  showUrlManager() {
    document.getElementById('urlManager').style.display = 'block';
    this.renderUrlList();
  }

  hideUrlManager() {
    document.getElementById('urlManager').style.display = 'none';
  }

  updateUrlCount() {
    const urlCount = document.getElementById('urlCount');
    if (urlCount) {
      urlCount.textContent = `(${this.customUrls.length} URLs)`;
    }
  }

  async getDefaultLLM() {
    try {
      const result = await chrome.storage.local.get(['defaultLLM']);
      return result.defaultLLM || 'https://chatgpt.com';
    } catch (error) {
      console.error('Failed to get default LLM:', error);
      return 'https://chatgpt.com';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new SimplePopupManager();
});