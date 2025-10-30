class SidebarManager {
  constructor() {
    this.prompts = [];
    this.categories = ['general', 'writing', 'coding', 'analysis', 'communication', 'creative', 'business', 'education'];
    this.currentCategory = 'all';
    this.currentSearch = '';
    this.editingPromptId = null;
    this.currentShortcut = 'Ctrl+Shift+P';
    this.customUrls = [];
    this.draftData = null;
    
    this.init();
  }

  async init() {
    await this.loadData();
    await this.loadDraftData();
    await this.loadCustomUrls();
    await this.checkForRightClickPrompt();
    this.setupEventListeners();
    this.renderCategories();
    this.renderPrompts();
    this.updateShortcutDisplay();
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(['localPrompts', 'customCategories', 'customShortcut']);
      this.prompts = result.localPrompts || [];
      if (result.customCategories) {
        this.categories = result.customCategories;
      }
      if (result.customShortcut) {
        this.currentShortcut = result.customShortcut;
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }

  async loadCustomUrls() {
    try {
      const result = await chrome.storage.local.get(['supportedUrls']);
      this.customUrls = result.supportedUrls || [
        'https://chatgpt.com',
        'https://chat.openai.com',
        'https://claude.ai',
        'https://gemini.google.com',
        'https://www.perplexity.ai',
        'https://chat.deepseek.com',
        'https://grok.x.ai',
        'https://www.meta.ai',
        'https://you.com',
        'https://poe.com',
        'https://huggingface.co/chat'
      ];
    } catch (error) {
      console.error('Failed to load custom URLs:', error);
      this.customUrls = [];
    }
  }

  async checkForRightClickPrompt() {
    try {
      const result = await chrome.storage.local.get(['pendingRightClickPrompt']);
      if (result.pendingRightClickPrompt) {
        console.log('Found right-click prompt data, auto-opening add prompt modal');
        
        // Set draft data to the right-click data
        this.draftData = {
          content: result.pendingRightClickPrompt.content,
          title: result.pendingRightClickPrompt.title,
          category: result.pendingRightClickPrompt.category
        };
        
        // Clear the pending data
        await chrome.storage.local.remove(['pendingRightClickPrompt']);
        
        // Auto-open the add prompt modal after a short delay
        setTimeout(() => {
          this.showAddPromptModal();
          this.showNotification('Right-click text loaded! Edit and save as needed.', 'success');
        }, 500);
      }
    } catch (error) {
      console.error('Failed to check for right-click prompt:', error);
    }
  }

  async savePrompts() {
    try {
      await chrome.storage.local.set({localPrompts: this.prompts});
      return true;
    } catch (error) {
      console.error('Failed to save prompts:', error);
      return false;
    }
  }

  setupEventListeners() {
    // Header actions
    document.getElementById('addPromptBtn').addEventListener('click', () => this.showAddPromptModal());
    document.getElementById('fullViewBtn').addEventListener('click', () => this.openFullView());
    document.getElementById('expandBtn').addEventListener('click', () => this.openFullView());
    document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());

    // Search
    document.getElementById('searchBox').addEventListener('input', (e) => {
      this.currentSearch = e.target.value;
      this.renderPrompts();
    });

    // Modal events
    document.getElementById('cancelPrompt').addEventListener('click', () => this.hideAddPromptModal());
    document.getElementById('savePrompt').addEventListener('click', () => this.savePrompt());
    document.getElementById('editCategories').addEventListener('click', () => this.showCategoryModal());
    document.getElementById('closeCategoryModal').addEventListener('click', () => this.hideCategoryModal());
    document.getElementById('addCategory').addEventListener('click', () => this.addCategory());
    document.getElementById('closeSettings').addEventListener('click', () => this.hideSettingsModal());

    // Settings modal events (will be added when settings are loaded)
    this.setupSettingsEventListeners();

    // Auto-predict title when content changes and save draft
    document.getElementById('promptContent').addEventListener('input', () => {
      if (!document.getElementById('promptTitle').value.trim()) {
        this.predictTitle();
      }
      this.saveDraftData();
    });

    document.getElementById('promptTitle').addEventListener('input', () => this.saveDraftData());
    document.getElementById('promptCategory').addEventListener('change', () => this.saveDraftData());

    // Empty state add button
    const emptyStateAddBtn = document.getElementById('emptyStateAddBtn');
    if (emptyStateAddBtn) {
      emptyStateAddBtn.addEventListener('click', () => this.showAddPromptModal());
    }

    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal-overlay')) {
        this.hideAllModals();
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideAllModals();
      }
    });
  }

  setupSettingsEventListeners() {
    // These will be set up after settings content is loaded
    setTimeout(() => {
      const exportBtn = document.getElementById('exportData');
      const importBtn = document.getElementById('importData');
      const importFile = document.getElementById('importFile');
      const recordShortcut = document.getElementById('recordShortcut');
      const resetShortcut = document.getElementById('resetShortcut');
      const cleanupBrackets = document.getElementById('cleanupBrackets');
      const editUrls = document.getElementById('editUrls');
      const addUrl = document.getElementById('addUrl');
      const closeUrlManager = document.getElementById('closeUrlManager');

      if (exportBtn) exportBtn.addEventListener('click', () => this.exportData());
      if (importBtn) importBtn.addEventListener('click', () => importFile.click());
      if (importFile) importFile.addEventListener('change', (e) => this.importData(e));
      if (recordShortcut) recordShortcut.addEventListener('click', () => this.startRecordingShortcut());
      if (resetShortcut) resetShortcut.addEventListener('click', () => this.resetShortcut());
      if (cleanupBrackets) cleanupBrackets.addEventListener('click', () => this.cleanupAllVariableFormats());
      if (editUrls) editUrls.addEventListener('click', () => this.showUrlManager());
      if (addUrl) addUrl.addEventListener('click', () => this.addCustomUrl());
      if (closeUrlManager) closeUrlManager.addEventListener('click', () => this.hideUrlManager());
    }, 100);
  }

  updateShortcutDisplay() {
    const shortcutKey = document.querySelector('.shortcut-key');
    if (shortcutKey) {
      shortcutKey.textContent = this.currentShortcut;
    }
  }

  renderCategories() {
    const categoriesContainer = document.getElementById('categories');
    const usedCategories = [...new Set(this.prompts.map(p => p.category))];
    
    categoriesContainer.innerHTML = '';
    
    // Add "All" category
    const allTab = document.createElement('div');
    allTab.className = `category-tab ${this.currentCategory === 'all' ? 'active' : ''}`;
    allTab.dataset.category = 'all';
    allTab.textContent = 'All';
    allTab.addEventListener('click', () => this.filterByCategory('all'));
    categoriesContainer.appendChild(allTab);
    
    // Add used categories
    usedCategories.forEach(category => {
      const tab = document.createElement('div');
      tab.className = `category-tab ${this.currentCategory === category ? 'active' : ''}`;
      tab.dataset.category = category;
      tab.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      tab.addEventListener('click', () => this.filterByCategory(category));
      categoriesContainer.appendChild(tab);
    });
  }

  filterByCategory(category) {
    this.currentCategory = category;
    this.renderCategories();
    this.renderPrompts();
  }

  renderPrompts() {
    const promptsList = document.getElementById('promptsList');
    let filteredPrompts = this.prompts;

    // Filter by category
    if (this.currentCategory !== 'all') {
      filteredPrompts = filteredPrompts.filter(p => p.category === this.currentCategory);
    }

    // Filter by search
    if (this.currentSearch) {
      const searchTerm = this.currentSearch.toLowerCase();
      filteredPrompts = filteredPrompts.filter(p => 
        p.title.toLowerCase().includes(searchTerm) || 
        p.content.toLowerCase().includes(searchTerm)
      );
    }

    if (filteredPrompts.length === 0) {
      promptsList.innerHTML = `
        <div class="empty-state">
          <h3>${this.prompts.length === 0 ? 'No prompts yet' : 'No matches found'}</h3>
          <p>${this.prompts.length === 0 ? 'Add your first prompt to get started!' : 'Try different search terms or categories'}</p>
          ${this.prompts.length === 0 ? `
            <button class="quick-action-btn" id="emptyStateAddBtn2">
              <i class="fas fa-plus"></i> Add Your First Prompt
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    promptsList.innerHTML = filteredPrompts.map(prompt => `
      <div class="prompt-item" data-prompt-id="${prompt.id}">
        <div class="prompt-title">${this.escapeHtml(prompt.title)}</div>
        <div class="prompt-preview">${this.escapeHtml(this.truncate(prompt.content, 100))}</div>
        <div class="prompt-meta">
          <span class="prompt-category" style="background: ${this.getCategoryColor(prompt.category)}; color: #000000;">
            ${prompt.category}
          </span>
          <div class="prompt-actions">
            <button class="prompt-action-btn use" data-action="use" data-prompt-id="${prompt.id}">
              <i class="fas fa-play"></i> USE
            </button>
            <button class="prompt-action-btn edit" data-action="edit" data-prompt-id="${prompt.id}">
              <i class="far fa-edit"></i>
            </button>
            <button class="prompt-action-btn delete" data-action="delete" data-prompt-id="${prompt.id}">
              <i class="far fa-trash-alt"></i>
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Add click listeners for prompt items
    document.querySelectorAll('.prompt-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.prompt-actions')) {
          this.usePrompt(item.dataset.promptId);
        }
      });
    });

    // Add event listeners for action buttons
    document.querySelectorAll('.prompt-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;
        const promptId = btn.dataset.promptId;
        
        switch (action) {
          case 'use':
            this.usePrompt(promptId);
            break;
          case 'edit':
            this.editPrompt(promptId);
            break;
          case 'delete':
            this.deletePrompt(promptId);
            break;
        }
      });
    });

    // Add event listener for empty state button if it exists
    const emptyStateAddBtn2 = document.getElementById('emptyStateAddBtn2');
    if (emptyStateAddBtn2) {
      emptyStateAddBtn2.addEventListener('click', () => this.showAddPromptModal());
    }
  }

  getCategoryColor(category) {
    const categoryColors = {
      'general': '#8b5cf6', // purple
      'writing': '#06b6d4', // cyan  
      'coding': '#10b981', // emerald
      'analysis': '#f59e0b', // amber
      'communication': '#ef4444', // red
      'creative': '#ec4899', // pink
      'business': '#3b82f6', // blue
      'education': '#84cc16' // lime
    };
    return categoryColors[category] || '#6b7280'; // default gray
  }

  async usePrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      // Check if this is a supported URL
      const isSupportedUrl = this.customUrls.some(url => {
        try {
          const urlPattern = new URL(url);
          return tab.url.includes(urlPattern.hostname);
        } catch {
          return tab.url.includes(url);
        }
      });

      if (isSupportedUrl) {
        // Inject into the page via content script
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'usePrompt',
            prompt: prompt
          });
          this.showNotification('Prompt injected!', 'success');
        } catch (error) {
          // Fallback: copy to clipboard and show navigation message
          await this.copyToClipboard(prompt.content);
          this.showNotification('Please navigate to ChatGPT or Claude to use prompts.', 'navigate');
        }
      } else {
        // Copy to clipboard and show navigation message
        await this.copyToClipboard(prompt.content);
        this.showNotification('Please navigate to ChatGPT or Claude to use prompts.', 'navigate');
      }
    } catch (error) {
      console.error('Error using prompt:', error);
      // Fallback: copy to clipboard
      await this.copyToClipboard(prompt.content);
      this.showNotification('Prompt copied to clipboard!', 'success');
    }
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      return false;
    }
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
      z-index: 10000;
      backdrop-filter: blur(10px);
      ${type === 'success' ? 'background: rgba(20, 184, 166, 0.9);' : 
        type === 'error' ? 'background: rgba(220, 38, 38, 0.9);' : 
        type === 'navigate' ? 'background: rgba(20, 184, 166, 0.9);' :
        'background: rgba(249, 115, 22, 0.9);'}
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

  showAddPromptModal() {
    this.editingPromptId = null;
    document.getElementById('modalTitle').textContent = 'Add New Prompt';
    
    // Load draft data if available
    if (this.draftData) {
      document.getElementById('promptContent').value = this.draftData.content || '';
      document.getElementById('promptTitle').value = this.draftData.title || '';
      document.getElementById('promptCategory').value = this.draftData.category || 'general';
    } else {
      document.getElementById('promptContent').value = '';
      document.getElementById('promptTitle').value = '';
      document.getElementById('promptCategory').value = 'general';
    }
    
    this.populateCategorySelect();
    document.getElementById('addPromptModal').style.display = 'flex';
    
    setTimeout(() => {
      document.getElementById('promptContent').focus();
    }, 100);
  }

  editPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    this.editingPromptId = promptId;
    document.getElementById('modalTitle').textContent = 'Edit Prompt';
    document.getElementById('promptContent').value = prompt.content;
    document.getElementById('promptTitle').value = prompt.title;
    document.getElementById('promptCategory').value = prompt.category;
    
    this.populateCategorySelect();
    document.getElementById('addPromptModal').style.display = 'flex';
    
    setTimeout(() => {
      document.getElementById('promptContent').focus();
    }, 100);
  }

  async deletePrompt(promptId) {
    if (!confirm('Delete this prompt?')) return;

    this.prompts = this.prompts.filter(p => p.id !== promptId);
    await this.savePrompts();
    this.renderCategories();
    this.renderPrompts();
    this.showNotification('Prompt deleted!', 'success');
  }

  async savePrompt() {
    const content = document.getElementById('promptContent').value.trim();
    const title = document.getElementById('promptTitle').value.trim();
    const category = document.getElementById('promptCategory').value;

    if (!content) {
      this.showNotification('Please enter prompt content', 'error');
      return;
    }

    const finalTitle = title || this.generateTitle(content);

    if (this.editingPromptId) {
      // Update existing prompt
      const promptIndex = this.prompts.findIndex(p => p.id === this.editingPromptId);
      this.prompts[promptIndex] = {
        ...this.prompts[promptIndex],
        title: finalTitle,
        content: content,
        category: category,
        updatedAt: new Date().toISOString()
      };
      this.showNotification('Prompt updated!', 'success');
    } else {
      // Create new prompt
      const newPrompt = {
        id: Date.now().toString(),
        title: finalTitle,
        content: content,
        category: category,
        createdAt: new Date().toISOString()
      };
      this.prompts.push(newPrompt);
      this.showNotification('Prompt saved!', 'success');
    }

    await this.savePrompts();
    await this.clearDraftData();
    this.hideAddPromptModal();
    this.renderCategories();
    this.renderPrompts();
  }

  populateCategorySelect() {
    const select = document.getElementById('promptCategory');
    select.innerHTML = '';
    
    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      select.appendChild(option);
    });
  }

  generateTitle(content) {
    const words = content.trim().split(/\s+/).slice(0, 6);
    let title = words.join(' ');
    title = title.replace(/^(please|can you|could you|help me|i need|i want|write|create)/i, '');
    title = title.trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    return title.length > 50 ? title.substring(0, 47) + '...' : title || 'Custom Prompt';
  }

  predictTitle() {
    const content = document.getElementById('promptContent').value.trim();
    if (content) {
      const predictedTitle = this.generateTitle(content);
      document.getElementById('promptTitle').value = predictedTitle;
    }
  }

  hideAddPromptModal() {
    document.getElementById('addPromptModal').style.display = 'none';
    this.editingPromptId = null;
  }

  showCategoryModal() {
    this.renderCategoryList();
    document.getElementById('categoryModal').style.display = 'flex';
  }

  hideCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
  }

  renderCategoryList() {
    const categoryList = document.getElementById('categoryList');
    categoryList.innerHTML = this.categories.map(category => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px; background: #0f0f23; border: 1px solid #334155; border-radius: 6px; margin-bottom: 6px;">
        <span style="color: #e2e8f0;">${category.charAt(0).toUpperCase() + category.slice(1)}</span>
        <button class="delete-category-btn" data-category="${category}" style="background: #dc2626; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 11px; cursor: pointer;">Delete</button>
      </div>
    `).join('');
    
    // Add event listeners to delete buttons
    document.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.deleteCategory(btn.dataset.category);
      });
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
    await chrome.storage.local.set({customCategories: this.categories});
    
    document.getElementById('newCategoryName').value = '';
    this.renderCategoryList();
    this.populateCategorySelect();
    this.showNotification('Category added!', 'success');
  }

  async deleteCategory(categoryName) {
    if (!confirm(`Delete category "${categoryName}"? Prompts in this category will be moved to "general".`)) {
      return;
    }

    // Move prompts to general category
    this.prompts.forEach(prompt => {
      if (prompt.category === categoryName) {
        prompt.category = 'general';
      }
    });

    // Remove category
    this.categories = this.categories.filter(cat => cat !== categoryName);
    
    await Promise.all([
      chrome.storage.local.set({customCategories: this.categories}),
      this.savePrompts()
    ]);

    this.renderCategoryList();
    this.populateCategorySelect();
    this.renderCategories();
    this.renderPrompts();
    this.showNotification('Category deleted!', 'success');
  }

  openFullView() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('fullview/fullview.html')
    });
  }

  showSettingsModal() {
    this.renderSettingsContent();
    document.getElementById('settingsModal').style.display = 'flex';
  }

  hideSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
  }

  renderSettingsContent() {
    const settingsContent = document.getElementById('settingsContent');
    settingsContent.innerHTML = `
      <!-- Shortcuts Section -->
      <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="far fa-keyboard" style="font-size: 16px;"></i>
            <span style="color: #f97316; font-size: 14px; font-weight: 600;">Shortcut</span>
            <input type="text" id="shortcutInput" style="padding: 4px 8px; border: 1px solid #334155; border-radius: 4px; background: #0f0f23; color: #14b8a6; font-size: 13px; width: 100px; text-align: center;" placeholder="Ctrl+Shift+P" readonly>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="recordShortcut" style="background: none; border: 1px solid #334155; color: #dc2626; padding: 6px; border-radius: 4px; font-size: 14px; cursor: pointer;" title="Record New"><i class="fas fa-record-vinyl"></i></button>
            <button id="resetShortcut" style="background: none; border: 1px solid #334155; color: #e2e8f0; padding: 6px; border-radius: 4px; font-size: 14px; cursor: pointer;" title="Reset"><i class="fas fa-undo"></i></button>
          </div>
        </div>
        <p style="margin: 0; font-size: 12px; color: #94a3b8; padding-left: 24px;">Click record button, then press your desired key combination</p>
      </div>
      
      <!-- Backup Section -->
      <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="far fa-hdd" style="font-size: 16px;"></i>
            <span style="color: #f97316; font-size: 14px; font-weight: 600;">Backup & Restore</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="exportData" style="background: none; border: 1px solid #334155; color: #e2e8f0; padding: 6px; border-radius: 4px; font-size: 14px; cursor: pointer;" title="Export"><i class="fas fa-upload"></i></button>
            <input type="file" id="importFile" accept=".json" style="display: none;">
            <button id="importData" style="background: none; border: 1px solid #334155; color: #e2e8f0; padding: 6px; border-radius: 4px; font-size: 14px; cursor: pointer;" title="Import"><i class="fas fa-download"></i></button>
          </div>
        </div>
        <p style="margin: 0; font-size: 12px; color: #94a3b8; padding-left: 24px;">Export prompts to JSON file for backup, or import from another device</p>
      </div>
      
      <!-- Cleanup Section -->
      <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-broom" style="font-size: 16px;"></i>
            <span style="color: #f97316; font-size: 14px; font-weight: 600;">Variable Cleanup</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="cleanupBrackets" style="background: none; border: 1px solid #334155; color: #e2e8f0; padding: 6px 12px; border-radius: 4px; font-size: 13px; cursor: pointer;" title="Fix Variables">Fix All</button>
          </div>
        </div>
        <p style="margin: 0; font-size: 12px; color: #94a3b8; padding-left: 24px;">Convert {{variable}} and [single] to {variable}. Preserves [opt1/opt2/opt3] choices</p>
      </div>
      
      <!-- URL Management Section -->
      <div style="margin-bottom: 20px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fas fa-globe" style="font-size: 16px;"></i>
            <span style="color: #f97316; font-size: 14px; font-weight: 600;">Supported URLs</span>
            <span id="urlCount" style="color: #94a3b8; font-size: 12px;">(${this.customUrls.length} URLs)</span>
          </div>
          <div style="display: flex; gap: 6px;">
            <button id="editUrls" style="background: none; border: 1px solid #334155; color: #e2e8f0; padding: 6px; border-radius: 4px; font-size: 14px; cursor: pointer;" title="Edit URLs"><i class="far fa-edit"></i></button>
          </div>
        </div>
        <div id="urlManager" style="display: none;">
          <div id="urlList" style="max-height: 120px; overflow-y: auto; margin-bottom: 8px;">
            <!-- URLs will be populated here -->
          </div>
          <div style="display: flex; gap: 6px; margin-bottom: 8px;">
            <button id="addUrl" style="background: #ea580c; color: white; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer;"><i class="fas fa-plus"></i> Add URL</button>
            <button id="closeUrlManager" style="background: #374151; color: #d1d5db; border: 1px solid #4b5563; border-radius: 4px; padding: 6px 12px; font-size: 12px; cursor: pointer;">Done</button>
          </div>
        </div>
        <p style="margin: 0; font-size: 12px; color: #94a3b8; padding-left: 24px;">URLs where the prompt picker will be available</p>
      </div>
    `;

    // Update shortcut display
    document.getElementById('shortcutInput').value = this.currentShortcut;

    // Setup event listeners after content is rendered
    this.setupSettingsEventListeners();
  }

  hideAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.style.display = 'none';
    });
    this.editingPromptId = null;
  }

  truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Draft Data Management
  async loadDraftData() {
    try {
      const result = await chrome.storage.local.get(['promptDraftDataSidebar']);
      this.draftData = result.promptDraftDataSidebar || null;
    } catch (error) {
      console.error('Failed to load sidebar draft data:', error);
    }
  }

  async saveDraftData() {
    try {
      const content = document.getElementById('promptContent')?.value || '';
      const title = document.getElementById('promptTitle')?.value || '';
      const category = document.getElementById('promptCategory')?.value || 'general';
      
      if (!content.trim() && !title.trim()) {
        await this.clearDraftData();
        return;
      }
      
      this.draftData = { content, title, category };
      await chrome.storage.local.set({promptDraftDataSidebar: this.draftData});
    } catch (error) {
      console.error('Failed to save sidebar draft data:', error);
    }
  }

  async clearDraftData() {
    try {
      this.draftData = null;
      await chrome.storage.local.remove(['promptDraftDataSidebar']);
    } catch (error) {
      console.error('Failed to clear sidebar draft data:', error);
    }
  }

  // Settings functionality (copied from popup.js)
  async exportData() {
    try {
      const data = {
        prompts: this.prompts,
        categories: this.categories,
        exportedAt: new Date().toISOString(),
        version: '1.1'
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promptdx-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showNotification('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed. Please try again.', 'error');
    }
  }

  async importData(event) {
    // Import functionality implementation...
    // (Similar to popup.js implementation)
    this.showNotification('Import functionality coming soon!', 'info');
  }

  // Additional methods for settings functionality...
  startRecordingShortcut() {
    this.showNotification('Recording shortcut functionality coming soon!', 'info');
  }

  resetShortcut() {
    this.showNotification('Reset shortcut functionality coming soon!', 'info');
  }

  async cleanupAllVariableFormats() {
    this.showNotification('Variable cleanup functionality coming soon!', 'info');
  }

  showUrlManager() {
    this.showNotification('URL management functionality coming soon!', 'info');
  }

  addCustomUrl() {
    this.showNotification('Add URL functionality coming soon!', 'info');
  }

  hideUrlManager() {
    const urlManager = document.getElementById('urlManager');
    if (urlManager) {
      urlManager.style.display = 'none';
    }
  }
}

// Initialize when DOM is ready
let sidebarManager;
document.addEventListener('DOMContentLoaded', () => {
  sidebarManager = new SidebarManager();
});