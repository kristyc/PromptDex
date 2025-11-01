class SidebarManager {
  constructor() {
    this.prompts = [];
    this.categories = ['general', 'writing', 'coding', 'analysis', 'communication', 'creative', 'business', 'education'];
    this.currentCategory = 'all';
    this.currentSearch = '';
    this.editingPromptId = null;
    this.draftData = null;
    this.defaultLLM = 'https://chatgpt.com';
    this.showTip = true;
    this.hasUserSetLLM = false;
    this.compactView = false;

    this.init();
  }

  async init() {
    await this.loadData();
    await this.loadDraftData();
    await this.loadDefaultLLM();
    await this.loadTipVisibility();
    await this.loadCompactView();
    await this.checkForRightClickPrompt();
    this.renderSettingsContent(); // Ensure import file element exists for onboarding
    this.setupEventListeners();
    this.setupStorageListener();
    this.renderCategories();
    this.renderPrompts();
    this.updateTipVisibility();
    this.applyCompactView();
  }

  setupStorageListener() {
    // Listen for changes from full view or other sources
    chrome.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local') {
        if (changes.localPrompts) {
          this.prompts = changes.localPrompts.newValue || [];
          this.renderCategories();
          this.renderPrompts();
        }
        if (changes.customCategories) {
          this.categories = changes.customCategories.newValue || ['general', 'writing', 'coding', 'analysis', 'communication', 'creative', 'business', 'education'];
          this.renderCategories();
        }
      }
    });
  }

  async loadData() {
    try {
      const result = await chrome.storage.local.get(['localPrompts', 'customCategories']);
      this.prompts = result.localPrompts || [];
      if (result.customCategories) {
        this.categories = result.customCategories;
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    }
  }


  async loadDefaultLLM() {
    try {
      const result = await chrome.storage.local.get(['defaultLLM']);
      this.defaultLLM = result.defaultLLM || 'https://chatgpt.com';
    } catch (error) {
      console.error('Failed to load default LLM:', error);
      this.defaultLLM = 'https://chatgpt.com';
    }
  }

  async saveDefaultLLM() {
    try {
      await chrome.storage.local.set({defaultLLM: this.defaultLLM});
    } catch (error) {
      console.error('Failed to save default LLM:', error);
    }
  }

  async loadTipVisibility() {
    try {
      const result = await chrome.storage.local.get(['showTip', 'hasUserSetLLM']);
      this.showTip = result.showTip !== false; // Default to true
      this.hasUserSetLLM = result.hasUserSetLLM || false;
    } catch (error) {
      console.error('Failed to load tip visibility:', error);
      this.showTip = true;
      this.hasUserSetLLM = false;
    }
  }

  async saveTipVisibility() {
    try {
      await chrome.storage.local.set({showTip: this.showTip});
    } catch (error) {
      console.error('Failed to save tip visibility:', error);
    }
  }

  updateTipVisibility() {
    const tipElement = document.getElementById('shortcutTip');
    if (tipElement) {
      tipElement.style.display = this.showTip ? 'block' : 'none';
    }
  }

  async loadCompactView() {
    try {
      const result = await chrome.storage.local.get(['compactView']);
      this.compactView = result.compactView || false;
    } catch (error) {
      console.error('Failed to load compact view setting:', error);
      this.compactView = false;
    }
  }

  async saveCompactView() {
    try {
      await chrome.storage.local.set({compactView: this.compactView});
    } catch (error) {
      console.error('Failed to save compact view setting:', error);
    }
  }

  applyCompactView() {
    if (this.compactView) {
      document.body.classList.add('compact-view');
    } else {
      document.body.classList.remove('compact-view');
    }
  }

  async toggleCompactView() {
    this.compactView = !this.compactView;
    await this.saveCompactView();
    this.applyCompactView();
  }

  async dismissTip() {
    this.showTip = false;
    await this.saveTipVisibility();
    this.updateTipVisibility();
    this.showNotification('Tip dismissed', 'success');
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
    const addPromptBtn = document.getElementById('addPromptBtn');
    const addPromptBtnHeader = document.getElementById('addPromptBtnHeader');
    const fullViewBtn = document.getElementById('fullViewBtn');
    const expandBtn = document.getElementById('expandBtn');
    const backupBtn = document.getElementById('backupBtn');
    const settingsBtn = document.getElementById('settingsBtn');

    if (addPromptBtn) addPromptBtn.addEventListener('click', () => this.showAddPromptModal());
    if (addPromptBtnHeader) addPromptBtnHeader.addEventListener('click', () => this.showAddPromptModal());
    if (fullViewBtn) fullViewBtn.addEventListener('click', () => this.openFullView());
    if (expandBtn) expandBtn.addEventListener('click', () => this.openFullView());
    if (backupBtn) backupBtn.addEventListener('click', () => this.exportData());
    if (settingsBtn) settingsBtn.addEventListener('click', () => this.showSettingsModal());

    // Tip dismiss
    const dismissTip = document.getElementById('dismissTip');
    if (dismissTip) dismissTip.addEventListener('click', () => this.dismissTip());

    // Search
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
      searchBox.addEventListener('input', (e) => {
        this.currentSearch = e.target.value;
        this.renderPrompts();
      });
    }

    // Category dropdown (for compact view)
    const categoryDropdown = document.getElementById('categoryDropdown');
    if (categoryDropdown) {
      categoryDropdown.addEventListener('change', (e) => {
        this.filterByCategory(e.target.value);
      });
    }

    // Modal events
    const cancelPrompt = document.getElementById('cancelPrompt');
    const savePrompt = document.getElementById('savePrompt');
    const deletePromptFromModal = document.getElementById('deletePromptFromModal');
    const editCategories = document.getElementById('editCategories');
    const closeCategoryModal = document.getElementById('closeCategoryModal');
    const addCategory = document.getElementById('addCategory');
    const closeSettings = document.getElementById('closeSettings');

    if (cancelPrompt) cancelPrompt.addEventListener('click', () => this.hideAddPromptModal());
    if (savePrompt) savePrompt.addEventListener('click', () => this.savePrompt());
    if (deletePromptFromModal) {
      deletePromptFromModal.addEventListener('click', () => {
        if (this.editingPromptId) {
          this.deletePrompt(this.editingPromptId);
          this.hideAddPromptModal();
        }
      });
    }
    if (editCategories) editCategories.addEventListener('click', () => this.showCategoryModal());
    if (closeCategoryModal) closeCategoryModal.addEventListener('click', () => this.hideCategoryModal());
    if (addCategory) addCategory.addEventListener('click', () => this.addCategory());
    if (closeSettings) closeSettings.addEventListener('click', () => this.hideSettingsModal());

    // Settings modal events (will be added when settings are loaded)
    this.setupSettingsEventListeners();

    // Auto-predict title when content changes and save draft
    const promptContent = document.getElementById('promptContent');
    const promptTitle = document.getElementById('promptTitle');
    const promptCategory = document.getElementById('promptCategory');

    if (promptContent) {
      promptContent.addEventListener('input', () => {
        const titleElement = document.getElementById('promptTitle');
        if (titleElement && !titleElement.value.trim()) {
          this.predictTitle();
        }
        this.saveDraftData();
      });
    }

    if (promptTitle) promptTitle.addEventListener('input', () => this.saveDraftData());
    if (promptCategory) promptCategory.addEventListener('change', () => this.saveDraftData());

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

      // Close all 3-dot menu dropdowns when clicking outside
      if (!e.target.closest('.prompt-menu')) {
        document.querySelectorAll('.prompt-menu-dropdown').forEach(dropdown => {
          dropdown.classList.remove('show');
        });
      }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideAllModals();
      }
    });

    // Onboarding event listeners (delegated)
    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('llm-option-btn')) {
        const selectedLLM = e.target.dataset.llm;
        this.defaultLLM = selectedLLM;
        this.hasUserSetLLM = true;
        await this.saveDefaultLLM();
        await chrome.storage.local.set({hasUserSetLLM: true});
        this.showNotification('LLM preference saved!', 'success');
        this.renderPrompts(); // Re-render to show next step and proper USE buttons
      }

      if (e.target.id === 'onboardingAddBtn') {
        this.showAddPromptModal();
      }

      if (e.target.id === 'onboardingImportBtn') {
        const importFile = document.getElementById('importFile');
        if (importFile) {
          importFile.click();
        }
      }
    });
  }

  setupSettingsEventListeners() {
    // These will be set up after settings content is loaded
    setTimeout(() => {
      const defaultLLMSelect = document.getElementById('defaultLLMSelect');
      const customUrlInput = document.getElementById('customUrlInput');
      const customLLMUrl = document.getElementById('customLLMUrl');
      const saveCustomUrl = document.getElementById('saveCustomUrl');
      const viewLayoutRadios = document.querySelectorAll('.view-layout-radio');
      const exportBtn = document.getElementById('exportData');
      const importBtn = document.getElementById('importData');
      const importFile = document.getElementById('importFile');

      if (defaultLLMSelect) {
        defaultLLMSelect.addEventListener('change', (e) => {
          const selectedValue = e.target.value;

          if (selectedValue === 'custom') {
            // Show custom URL input
            if (customUrlInput) customUrlInput.style.display = 'block';
            if (customLLMUrl) customLLMUrl.focus();
          } else {
            // Hide custom URL input and save the selection
            if (customUrlInput) customUrlInput.style.display = 'none';
            this.defaultLLM = selectedValue;
            this.saveDefaultLLM();
            this.renderPrompts(); // Re-render to show/hide USE buttons
            this.showNotification('Default AI updated!', 'success');
          }
        });
      }

      if (saveCustomUrl) {
        saveCustomUrl.addEventListener('click', async () => {
          const customUrl = customLLMUrl ? customLLMUrl.value.trim() : '';

          if (!customUrl) {
            this.showNotification('Please enter a valid URL', 'error');
            return;
          }

          // Basic URL validation
          try {
            new URL(customUrl);
            this.defaultLLM = customUrl;
            await this.saveDefaultLLM();
            this.renderPrompts();
            this.showNotification('Custom AI URL saved!', 'success');
          } catch (error) {
            this.showNotification('Invalid URL format', 'error');
          }
        });
      }

      // View layout radio buttons
      viewLayoutRadios.forEach(radio => {
        radio.addEventListener('change', async (e) => {
          this.compactView = e.target.value === 'compact';
          await this.saveCompactView();
          this.applyCompactView();
          await this.renderSettingsContent(); // Re-render to update UI
          this.setupSettingsEventListeners(); // Re-attach listeners
          this.showNotification(this.compactView ? 'Compact view enabled' : 'Default view enabled', 'success');
        });
      });
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportData());
        // Hover effect
        exportBtn.addEventListener('mouseenter', () => {
          exportBtn.style.background = '#14b8a6';
          exportBtn.style.color = '#ffffff';
          exportBtn.style.borderColor = '#14b8a6';
        });
        exportBtn.addEventListener('mouseleave', () => {
          exportBtn.style.background = '#1e293b';
          exportBtn.style.color = '#e2e8f0';
          exportBtn.style.borderColor = '#334155';
        });
      }
      if (importBtn) {
        importBtn.addEventListener('click', () => importFile.click());
        // Hover effect
        importBtn.addEventListener('mouseenter', () => {
          importBtn.style.background = '#14b8a6';
          importBtn.style.color = '#ffffff';
          importBtn.style.borderColor = '#14b8a6';
        });
        importBtn.addEventListener('mouseleave', () => {
          importBtn.style.background = '#1e293b';
          importBtn.style.color = '#e2e8f0';
          importBtn.style.borderColor = '#334155';
        });
      }
      if (importFile) importFile.addEventListener('change', (e) => this.importData(e));
    }, 100);
  }

  renderCategories() {
    const categoriesContainer = document.getElementById('categories');
    const categoryDropdown = document.getElementById('categoryDropdown');
    const usedCategories = [...new Set(this.prompts.map(p => p.category))];

    // Render category pills for normal view
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

    // Render category dropdown for compact view
    if (categoryDropdown) {
      const totalCount = this.prompts.length;
      categoryDropdown.innerHTML = `<option value="all">All Categories (${totalCount})</option>`;

      usedCategories.forEach(category => {
        const count = this.prompts.filter(p => p.category === category).length;
        const option = document.createElement('option');
        option.value = category;
        option.textContent = `${category.charAt(0).toUpperCase() + category.slice(1)} (${count})`;
        categoryDropdown.appendChild(option);
      });
      categoryDropdown.value = this.currentCategory;
    }
  }

  filterByCategory(category) {
    this.currentCategory = category;
    this.renderCategories();
    this.renderPrompts();
  }

  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return this.escapeHtml(text);
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark style="background: #f59e0b; color: #000; padding: 1px 2px; border-radius: 2px;">$1</mark>');
  }

  renderPrompts() {
    const promptsList = document.getElementById('promptsList');
    let filteredPrompts = this.prompts;

    // Hide/show UI elements based on whether user has prompts
    this.updateUIVisibility();

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
      if (this.prompts.length === 0) {
        // Show onboarding flow
        promptsList.innerHTML = this.renderOnboarding();
      } else {
        // Show no matches found
        promptsList.innerHTML = `
          <div class="empty-state">
            <h3>No matches found</h3>
            <p>Try different search terms or categories</p>
          </div>
        `;
      }
      return;
    }

    promptsList.innerHTML = filteredPrompts.map(prompt => `
      <div class="prompt-item" data-prompt-id="${prompt.id}">
        <button class="prompt-action-btn delete delete-top-right" data-action="delete" data-prompt-id="${prompt.id}" title="Delete prompt" type="button">
          <i class="far fa-trash-alt"></i>
        </button>
        <div class="prompt-title">${this.highlightSearchTerm(prompt.title, this.currentSearch)}</div>
        <div class="prompt-preview">${this.highlightSearchTerm(this.truncate(prompt.content, 100), this.currentSearch)}</div>
        <div class="prompt-meta">
          <span class="prompt-category" data-category="${prompt.category}" style="background: ${this.getCategoryColor(prompt.category)}; color: #000000;">
            ${prompt.category}
          </span>
          <div class="prompt-actions">
            ${this.defaultLLM !== 'none' ? `
              <button class="prompt-action-btn use" data-action="use" data-prompt-id="${prompt.id}" type="button">
                <i class="fas fa-play"></i> <span class="use-text">USE</span>
              </button>
            ` : ''}
            <button class="prompt-action-btn copy" data-action="copy" data-prompt-id="${prompt.id}" title="Copy to clipboard" type="button">
              <i class="far fa-copy"></i>
            </button>
            <button class="prompt-action-btn edit" data-action="edit" data-prompt-id="${prompt.id}" type="button">
              <i class="far fa-edit"></i>
            </button>
            <div class="prompt-menu">
              <button class="prompt-menu-btn" data-prompt-id="${prompt.id}" title="More actions" type="button">
                <i class="fas fa-ellipsis-v"></i>
              </button>
              <div class="prompt-menu-dropdown">
                <button class="prompt-menu-item" data-action="edit" data-prompt-id="${prompt.id}" type="button">
                  <i class="far fa-edit"></i>
                  <span>Edit</span>
                </button>
                <button class="prompt-menu-item delete-item" data-action="delete" data-prompt-id="${prompt.id}" type="button">
                  <i class="far fa-trash-alt"></i>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    // Attach event listeners after rendering - same as fullview.js
    this.attachPromptEventListeners();
  }

  attachPromptEventListeners() {
    // Action button clicks - EXACT same pattern as fullview.js
    document.querySelectorAll('.prompt-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = e.target.dataset.action;
        const promptId = e.target.dataset.promptId;

        switch (action) {
          case 'use':
            this.usePrompt(promptId);
            break;
          case 'copy':
            this.copyPrompt(promptId);
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

    // 3-dot menu button clicks
    document.querySelectorAll('.prompt-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = btn.nextElementSibling;

        // Close all dropdowns first
        document.querySelectorAll('.prompt-menu-dropdown').forEach(d => {
          d.classList.remove('show');
        });

        // Toggle this one
        if (dropdown) {
          dropdown.classList.add('show');
        }
      });
    });

    // Menu item clicks
    document.querySelectorAll('.prompt-menu-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.dataset.action;
        const promptId = item.dataset.promptId;

        // Close all dropdowns
        document.querySelectorAll('.prompt-menu-dropdown').forEach(d => {
          d.classList.remove('show');
        });

        switch (action) {
          case 'edit':
            this.editPrompt(promptId);
            break;
          case 'delete':
            this.deletePrompt(promptId);
            break;
        }
      });
    });

    // Prompt item clicks
    document.querySelectorAll('.prompt-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.prompt-action-btn') && !e.target.closest('.prompt-actions') && !e.target.closest('.prompt-menu')) {
          const promptId = item.dataset.promptId;
          if (this.defaultLLM === 'none') {
            this.copyPrompt(promptId);
          } else {
            this.usePrompt(promptId);
          }
        }
      });
    });

    // Empty state button
    const emptyStateAddBtn2 = document.getElementById('emptyStateAddBtn2');
    if (emptyStateAddBtn2) {
      emptyStateAddBtn2.addEventListener('click', () => this.showAddPromptModal());
    }
  }

  getCategoryColor(category) {
    const categoryColors = {
      'general': '#a78bfa', // light purple - good contrast with black
      'writing': '#22d3ee', // bright cyan - excellent contrast
      'coding': '#34d399', // bright emerald - excellent contrast
      'analysis': '#fbbf24', // bright amber/yellow - excellent contrast
      'communication': '#fb923c', // bright orange - excellent contrast
      'creative': '#f472b6', // bright pink - excellent contrast
      'business': '#60a5fa', // bright blue - excellent contrast
      'education': '#a3e635' // bright lime - excellent contrast
    };
    return categoryColors[category] || '#fbbf24'; // default bright amber (not gray)
  }

  async usePrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    try {
      // If user selected "none" as default LLM, just copy to clipboard
      if (this.defaultLLM === 'none') {
        await this.copyToClipboard(prompt.content);
        this.showNotification('Prompt copied to clipboard! Paste it anywhere.', 'success');
        return;
      }

      // Always open default LLM in new tab and insert prompt
      this.showNotification('Opening your preferred LLM...', 'success');
      const newTab = await chrome.tabs.create({ url: this.defaultLLM });

      // Set up one-time listener for when this specific tab finishes loading
      const tabUpdateListener = (tabId, changeInfo, tab) => {
        if (tabId === newTab.id && changeInfo.status === 'complete') {
          // Remove listener immediately to prevent memory leaks
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);

          // Show waiting message
          this.showNotification('Waiting to add prompt...', 'info');

          // Give dynamic content more time to load
          setTimeout(async () => {
            try {
              // First check if content script is available
              const pingResponse = await chrome.tabs.sendMessage(newTab.id, {action: 'ping'});
              
              if (pingResponse && pingResponse.success) {
                // Content script is available, try to insert prompt
                const injectResponse = await chrome.tabs.sendMessage(newTab.id, {
                  action: 'injectPrompt',
                  prompt: prompt
                });
                
                if (injectResponse && injectResponse.success) {
                  this.showNotification('Prompt added successfully!', 'success');
                } else {
                  // Injection failed, copy to clipboard
                  await this.copyToClipboard(prompt.content);
                  this.showNotification('Prompt copied to clipboard! Paste it into the chat.', 'navigate');
                }
              } else {
                // Content script not available, copy to clipboard
                await this.copyToClipboard(prompt.content);
                this.showNotification('Prompt copied to clipboard! Paste it into the chat.', 'navigate');
              }
            } catch (error) {
              // Content script not available or other error, copy to clipboard
              console.log('Auto-insertion failed, copying to clipboard:', error.message);
              await this.copyToClipboard(prompt.content);
              this.showNotification('Prompt copied to clipboard! Paste it into the chat.', 'navigate');
            }
          }, 3000); // Increased to 3 seconds for better reliability
        }
      };
      
      // Add the listener
      chrome.tabs.onUpdated.addListener(tabUpdateListener);
      
      // Safety timeout to remove listener if something goes wrong
      setTimeout(() => {
        try {
          chrome.tabs.onUpdated.removeListener(tabUpdateListener);
        } catch (e) {
          // Listener might already be removed, that's ok
        }
      }, 15000); // 15 second safety timeout
      
    } catch (error) {
      console.error('Error using prompt:', error);
      // Fallback: copy to clipboard
      await this.copyToClipboard(prompt.content);
      this.showNotification('Prompt copied to clipboard! You can now paste it anywhere.', 'success');
    }
  }

  async copyPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    const success = await this.copyToClipboard(prompt.content);
    if (success) {
      this.showNotification('Prompt copied to clipboard!', 'success');
    } else {
      this.showNotification('Failed to copy prompt', 'error');
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
    // Remove any existing notification first
    const existingNotification = document.querySelector('.promptdex-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'promptdex-notification';
    notification.style.cssText = `
      position: fixed;
      left: 16px;
      right: 16px;
      bottom: 16px;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      font-size: 13px;
      z-index: 10000;
      backdrop-filter: blur(10px);
      transition: opacity 0.3s ease, transform 0.3s ease;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
      ${type === 'success' ? 'background: rgba(20, 184, 166, 0.95);' :
        type === 'error' ? 'background: rgba(220, 38, 38, 0.95);' :
        type === 'navigate' ? 'background: rgba(20, 184, 166, 0.95);' :
        'background: rgba(249, 115, 22, 0.95);'}
    `;
    notification.textContent = message;

    // Append to body for fixed positioning at bottom
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(10px)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  showAddPromptModal() {
    this.editingPromptId = null;

    const modalTitle = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deletePromptFromModal');
    const promptContent = document.getElementById('promptContent');
    const promptTitle = document.getElementById('promptTitle');
    const promptCategory = document.getElementById('promptCategory');
    const addPromptModal = document.getElementById('addPromptModal');

    if (modalTitle) modalTitle.textContent = 'Add New Prompt';
    if (deleteBtn) deleteBtn.style.display = 'none';

    // Load draft data if available
    if (this.draftData) {
      if (promptContent) promptContent.value = this.draftData.content || '';
      if (promptTitle) promptTitle.value = this.draftData.title || '';
      if (promptCategory) promptCategory.value = this.draftData.category || 'general';
    } else {
      if (promptContent) promptContent.value = '';
      if (promptTitle) promptTitle.value = '';
      if (promptCategory) promptCategory.value = 'general';
    }

    this.populateCategorySelect();
    if (addPromptModal) addPromptModal.style.display = 'flex';

    setTimeout(() => {
      const content = document.getElementById('promptContent');
      if (content) content.focus();
    }, 100);
  }

  editPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    this.editingPromptId = promptId;

    const modalTitle = document.getElementById('modalTitle');
    const deleteBtn = document.getElementById('deletePromptFromModal');
    const promptContent = document.getElementById('promptContent');
    const promptTitle = document.getElementById('promptTitle');
    const promptCategory = document.getElementById('promptCategory');
    const addPromptModal = document.getElementById('addPromptModal');

    if (modalTitle) modalTitle.textContent = 'Edit Prompt';
    if (deleteBtn) deleteBtn.style.display = 'flex';

    if (promptContent) promptContent.value = prompt.content;
    if (promptTitle) promptTitle.value = prompt.title;
    if (promptCategory) promptCategory.value = prompt.category;

    this.populateCategorySelect();
    if (addPromptModal) addPromptModal.style.display = 'flex';

    setTimeout(() => {
      const content = document.getElementById('promptContent');
      if (content) content.focus();
    }, 100);
  }

  async deletePrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    const promptTitle = prompt.title.length > 30 ? prompt.title.substring(0, 30) + '...' : prompt.title;
    if (!confirm(`Are you sure you want to delete "${promptTitle}"?\n\nThis action cannot be undone.`)) return;

    this.prompts = this.prompts.filter(p => p.id !== promptId);
    await this.savePrompts();
    this.renderCategories();
    this.renderPrompts();
    this.showNotification('Prompt deleted successfully', 'success');
  }

  async savePrompt() {
    const promptContent = document.getElementById('promptContent');
    const promptTitle = document.getElementById('promptTitle');
    const promptCategory = document.getElementById('promptCategory');

    if (!promptContent || !promptTitle || !promptCategory) {
      this.showNotification('Error: Could not find prompt form elements', 'error');
      return;
    }

    const content = promptContent.value.trim();
    const title = promptTitle.value.trim();
    const category = promptCategory.value;

    if (!content) {
      this.showNotification('Please write your prompt content before saving', 'error');
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
    if (!select) return;

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
    const promptContent = document.getElementById('promptContent');
    const promptTitle = document.getElementById('promptTitle');

    if (!promptContent || !promptTitle) return;

    const content = promptContent.value.trim();

    // Only predict if there's enough content (at least 10 characters or a space)
    if (content && (content.length >= 10 || content.includes(' '))) {
      // Use first sentence instead of just first 6 words
      let title = content.split(/[.!?]/)[0].trim();
      title = title.replace(/^(please|can you|could you|help me|i need|i want|write|create|generate)/i, '');
      title = title.replace(/{[^}]+}/g, '[variable]');
      title = title.trim();
      title = title.charAt(0).toUpperCase() + title.slice(1);

      if (title.length > 60) {
        title = title.substring(0, 57) + '...';
      }

      promptTitle.value = title || 'Custom Prompt';
    }
  }

  hideAddPromptModal() {
    const addPromptModal = document.getElementById('addPromptModal');
    if (addPromptModal) addPromptModal.style.display = 'none';
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
    categoryList.innerHTML = this.categories.map((category, index) => {
      const promptCount = this.prompts.filter(p => p.category === category).length;
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: linear-gradient(135deg, rgba(15, 15, 35, 0.8), rgba(30, 41, 59, 0.6)); border: 1px solid #334155; border-radius: 10px; margin-bottom: 8px; transition: all 0.2s ease; position: relative; overflow: hidden;" class="category-item" onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(20, 184, 166, 0.2)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
          <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${this.getCategoryColor(category)}; flex-shrink: 0;"></div>
            <div style="flex: 1;">
              <div style="color: #e2e8f0; font-weight: 600; font-size: 13px;">${category.charAt(0).toUpperCase() + category.slice(1)}</div>
              <div style="color: #94a3b8; font-size: 11px;">${promptCount} prompt${promptCount === 1 ? '' : 's'}</div>
            </div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button class="edit-category-btn" data-category="${category}" style="background: rgba(245, 158, 11, 0.8); color: white; border: none; padding: 6px 8px; border-radius: 6px; font-size: 10px; cursor: pointer; transition: all 0.2s;" title="Edit category" onmouseover="this.style.background='rgba(245, 158, 11, 1)'" onmouseout="this.style.background='rgba(245, 158, 11, 0.8)'">
              <i class="far fa-edit"></i>
            </button>
            <button class="delete-category-btn" data-category="${category}" style="background: rgba(220, 38, 38, 0.8); color: white; border: none; padding: 6px 8px; border-radius: 6px; font-size: 10px; cursor: pointer; transition: all 0.2s;" title="Delete category" onmouseover="this.style.background='rgba(220, 38, 38, 1)'" onmouseout="this.style.background='rgba(220, 38, 38, 0.8)'">
              <i class="far fa-trash-alt"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');
    
    // Add event listeners to action buttons
    document.querySelectorAll('.delete-category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.deleteCategory(btn.dataset.category);
      });
    });
    
    document.querySelectorAll('.edit-category-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.editCategory(btn.dataset.category);
      });
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
    await chrome.storage.local.set({customCategories: this.categories});
    
    document.getElementById('newCategoryName').value = '';
    this.renderCategoryList();
    this.populateCategorySelect();
    this.showNotification('Category added!', 'success');
  }

  async editCategory(categoryName) {
    const newName = prompt(`Edit category name:`, categoryName);
    if (!newName || newName.trim() === '') return;

    const newCategoryName = newName.trim().toLowerCase();
    if (newCategoryName === categoryName) return;

    if (this.categories.includes(newCategoryName)) {
      this.showNotification('That category name is already being used. Try a different one.', 'error');
      return;
    }

    // Update category in list
    const categoryIndex = this.categories.indexOf(categoryName);
    this.categories[categoryIndex] = newCategoryName;

    // Update all prompts with this category
    this.prompts.forEach(prompt => {
      if (prompt.category === categoryName) {
        prompt.category = newCategoryName;
      }
    });

    await chrome.storage.local.set({customCategories: this.categories});
    await this.savePrompts();
    this.renderCategoryList();
    this.populateCategorySelect();
    this.renderCategories();
    this.renderPrompts();
    this.showNotification('Category updated successfully!', 'success');
  }

  async deleteCategory(categoryName) {
    const promptsInCategory = this.prompts.filter(p => p.category === categoryName).length;
    const message = promptsInCategory > 0 
      ? `Delete the "${categoryName}" category?\n\n${promptsInCategory} prompt${promptsInCategory === 1 ? '' : 's'} will be moved to "general" category.`
      : `Delete the "${categoryName}" category?`;
    
    if (!confirm(message)) {
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

  async showSettingsModal() {
    await this.renderSettingsContent();
    document.getElementById('settingsModal').style.display = 'flex';
  }

  hideSettingsModal() {
    document.getElementById('settingsModal').style.display = 'none';
  }

  async renderSettingsContent() {
    const version = await this.getVersion();
    const settingsContent = document.getElementById('settingsContent');
    settingsContent.innerHTML = `
      <!-- Default LLM Section -->
      <div style="margin-bottom: 24px;">
        <div style="margin-bottom: 10px;">
          <span style="color: #f97316; font-size: 14px; font-weight: 600;">Default AI</span>
        </div>
        <div style="padding-left: 24px;">
          <select id="defaultLLMSelect" style="width: 100%; padding: 8px 12px; border: 1px solid #334155; border-radius: 6px; background: #0f0f23; color: #e2e8f0; font-size: 13px; font-weight: 500; cursor: pointer;">
            <option value="none">None (copy & paste)</option>
            <option value="https://chatgpt.com">ChatGPT</option>
            <option value="https://claude.ai">Claude</option>
            <option value="https://gemini.google.com">Gemini</option>
            <option value="https://www.perplexity.ai">Perplexity</option>
            <option value="https://chat.deepseek.com">DeepSeek</option>
            <option value="https://grok.x.ai">Grok</option>
            <option value="https://www.meta.ai">Meta AI</option>
            <option value="custom">Custom URL</option>
          </select>
          <div id="customUrlInput" style="display: none; margin-top: 10px;">
            <input type="url" id="customLLMUrl" placeholder="Enter custom AI URL (e.g., https://example.com)" style="width: 100%; padding: 8px 12px; border: 1px solid #334155; border-radius: 6px; background: #0f0f23; color: #e2e8f0; font-size: 12px; box-sizing: border-box;">
            <button id="saveCustomUrl" style="margin-top: 8px; background: #14b8a6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600;">Save Custom URL</button>
          </div>
          <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">Clicking prompts will open the LLM automatically (or choose None to only copy the prompt).</p>
        </div>
      </div>

      <!-- View Layout Section -->
      <div style="margin-bottom: 24px;">
        <div style="margin-bottom: 10px;">
          <span style="color: #f97316; font-size: 14px; font-weight: 600;">View Layout</span>
        </div>
        <div style="display: flex; gap: 10px; padding-left: 24px;">
          <label style="flex: 1; cursor: pointer;">
            <input type="radio" name="viewLayout" value="default" ${!this.compactView ? 'checked' : ''} style="display: none;" class="view-layout-radio">
            <div class="view-layout-option ${!this.compactView ? 'active' : ''}" data-view="default" style="padding: 14px 12px; border: 2px solid ${!this.compactView ? '#14b8a6' : '#334155'}; border-radius: 8px; background: ${!this.compactView ? 'rgba(20, 184, 166, 0.1)' : 'rgba(30, 41, 59, 0.6)'}; text-align: center; transition: all 0.2s;">
              <i class="fas fa-th-large" style="font-size: 20px; color: ${!this.compactView ? '#14b8a6' : '#94a3b8'}; margin-bottom: 6px; display: block;"></i>
              <div style="font-size: 13px; font-weight: 600; color: ${!this.compactView ? '#14b8a6' : '#94a3b8'};">Default</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Card view</div>
            </div>
          </label>
          <label style="flex: 1; cursor: pointer;">
            <input type="radio" name="viewLayout" value="compact" ${this.compactView ? 'checked' : ''} style="display: none;" class="view-layout-radio">
            <div class="view-layout-option ${this.compactView ? 'active' : ''}" data-view="compact" style="padding: 14px 12px; border: 2px solid ${this.compactView ? '#14b8a6' : '#334155'}; border-radius: 8px; background: ${this.compactView ? 'rgba(20, 184, 166, 0.1)' : 'rgba(30, 41, 59, 0.6)'}; text-align: center; transition: all 0.2s;">
              <i class="fas fa-list" style="font-size: 20px; color: ${this.compactView ? '#14b8a6' : '#94a3b8'}; margin-bottom: 6px; display: block;"></i>
              <div style="font-size: 13px; font-weight: 600; color: ${this.compactView ? '#14b8a6' : '#94a3b8'};">Compact</div>
              <div style="font-size: 10px; color: #64748b; margin-top: 3px;">List view</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Backup Section -->
      <div style="margin-bottom: 24px;">
        <div style="margin-bottom: 10px;">
          <span style="color: #f97316; font-size: 14px; font-weight: 600;">Backup & Restore</span>
        </div>
        <div style="padding-left: 24px;">
          <div style="display: flex; gap: 8px;">
            <button id="exportData" class="backup-btn" style="flex: 1; background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 10px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;" title="Export">
              <i class="fas fa-upload"></i>
              <span>Export</span>
            </button>
            <input type="file" id="importFile" accept=".json" style="display: none;">
            <button id="importData" class="backup-btn" style="flex: 1; background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 10px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;" title="Import">
              <i class="fas fa-download"></i>
              <span>Import</span>
            </button>
          </div>
          <p style="margin: 8px 0 0 0; font-size: 11px; color: #64748b; line-height: 1.4;">Export to JSON for backup or import from another device.</p>
        </div>
      </div>
      
    `;

    // Update default LLM selection
    const defaultLLMSelect = document.getElementById('defaultLLMSelect');
    const customUrlInput = document.getElementById('customUrlInput');
    const customLLMUrl = document.getElementById('customLLMUrl');

    // Check if current defaultLLM is a custom URL
    const predefinedLLMs = ['none', 'https://chatgpt.com', 'https://claude.ai', 'https://gemini.google.com', 'https://www.perplexity.ai', 'https://chat.deepseek.com', 'https://grok.x.ai', 'https://www.meta.ai'];

    if (predefinedLLMs.includes(this.defaultLLM)) {
      defaultLLMSelect.value = this.defaultLLM;
    } else if (this.defaultLLM) {
      defaultLLMSelect.value = 'custom';
      customUrlInput.style.display = 'block';
      customLLMUrl.value = this.defaultLLM;
    } else {
      defaultLLMSelect.value = 'none';
    }
    
    // Update version display in header
    const versionDisplay = document.getElementById('versionDisplay');
    if (versionDisplay) {
      versionDisplay.textContent = `v${version}`;
    }

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

  async getVersion() {
    try {
      const manifest = chrome.runtime.getManifest();
      return manifest.version;
    } catch (error) {
      console.error('Failed to get version:', error);
      return '2.0.0'; // fallback version
    }
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
      const version = await this.getVersion();
      const data = {
        prompts: this.prompts,
        categories: this.categories,
        exportedAt: new Date().toISOString(),
        version: version
      };
      
      const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promptdex-backup-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showNotification('Data exported successfully!', 'success');
    } catch (error) {
      console.error('Export failed:', error);
      this.showNotification('Export failed. Please try again.', 'error');
    }
  }

  async importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (!data.prompts || !Array.isArray(data.prompts)) {
        this.showNotification('Invalid backup file. Please select a valid PromptDex backup.', 'error');
        return;
      }

      const importCount = data.prompts.length;
      if (!confirm(`Import ${importCount} prompt${importCount === 1 ? '' : 's'}?\n\nThis will add to your existing prompts.`)) {
        return;
      }

      // Add imported prompts
      data.prompts.forEach(prompt => {
        if (prompt.title && prompt.content) {
          this.prompts.push({
            ...prompt,
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
          });
        }
      });

      // Import categories if they exist
      if (data.categories && Array.isArray(data.categories)) {
        data.categories.forEach(category => {
          if (!this.categories.includes(category)) {
            this.categories.push(category);
          }
        });
        await chrome.storage.local.set({customCategories: this.categories});
      }

      await this.savePrompts();
      this.renderCategories();
      this.renderPrompts();
      this.populateCategorySelect();
      
      this.showNotification(`Successfully imported ${importCount} prompts!`, 'success');
    } catch (error) {
      console.error('Import failed:', error);
      this.showNotification('Import failed. Please check the file format and try again.', 'error');
    }
    
    // Reset file input
    event.target.value = '';
  }

  // Additional methods for settings functionality...

  async cleanupAllVariableFormats() {
    let updatedCount = 0;
    
    this.prompts.forEach(prompt => {
      const originalContent = prompt.content;
      let cleanedContent = originalContent;
      
      // Convert {{variable}} to {variable}
      cleanedContent = cleanedContent.replace(/\{\{([^}]+)\}\}/g, '{$1}');
      
      // Convert <variable> to {variable} but preserve HTML tags
      cleanedContent = cleanedContent.replace(/<([a-zA-Z_][a-zA-Z0-9_]*)>/g, (match, varName) => {
        // Skip if it looks like an HTML tag
        if (['div', 'span', 'p', 'a', 'img', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'b', 'i'].includes(varName.toLowerCase())) {
          return match;
        }
        return `{${varName}}`;
      });
      
      // Convert single word brackets [variable] to {variable} but preserve choice brackets [opt1/opt2/opt3]
      cleanedContent = cleanedContent.replace(/\[([a-zA-Z_][a-zA-Z0-9_]*)\]/g, (match, content) => {
        // If it contains slashes, it's a choice bracket - keep it
        if (content.includes('/')) {
          return match;
        }
        return `{${content}}`;
      });
      
      if (cleanedContent !== originalContent) {
        prompt.content = cleanedContent;
        updatedCount++;
      }
    });
    
    if (updatedCount > 0) {
      await this.savePrompts();
      this.renderPrompts();
      this.showNotification(`Updated ${updatedCount} prompt${updatedCount === 1 ? '' : 's'} with standardized variable format!`, 'success');
    } else {
      this.showNotification('All prompts already use the correct {variable} format.', 'info');
    }
  }

  updateUIVisibility() {
    const hasPrompts = this.prompts.length > 0;

    // Hide/show elements based on whether user has prompts
    const searchBox = document.getElementById('searchBox');
    const categories = document.getElementById('categories');
    const expandBtn = document.getElementById('expandBtn');
    const backupBtn = document.getElementById('backupBtn');

    if (searchBox) searchBox.style.display = hasPrompts ? 'block' : 'none';
    if (categories) categories.style.display = hasPrompts ? 'flex' : 'none';
    if (expandBtn) expandBtn.style.display = hasPrompts ? 'block' : 'none';
    if (backupBtn) backupBtn.style.display = hasPrompts ? 'block' : 'none';

    // Note: addPromptBtnHeader in header is always visible via CSS
    // Note: quick-actions buttons (addPromptBtn, fullViewBtn) are hidden via CSS
  }

  renderOnboarding() {
    const hasSetLLM = this.defaultLLM !== 'https://chatgpt.com' || this.hasUserSetLLM;
    
    if (!hasSetLLM) {
      // Step 1: LLM Selection
      return `
        <div class="onboarding-state" style="text-align: center; padding: 60px 20px;">
          <h2 style="color: #f1f5f9; font-size: 24px; margin: 0 0 8px 0; font-weight: 700;">What's your preferred LLM?</h2>
          <p style="color: #94a3b8; margin: 0 0 24px 0; font-size: 14px;">Choose your default AI assistant</p>
          
          <div style="display: flex; flex-direction: column; gap: 12px; max-width: 300px; margin: 0 auto;">
            <button class="llm-option-btn" data-llm="none" style="padding: 16px; border: 2px solid #334155; border-radius: 12px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.4)); color: #e2e8f0; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 600;" onmouseover="this.style.borderColor='#6b7280'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#334155'; this.style.transform='translateY(0)'">
              <i class="fas fa-copy" style="color: #6b7280;"></i>
              None (copy & paste)
            </button>
            <button class="llm-option-btn" data-llm="https://chatgpt.com" style="padding: 16px; border: 2px solid #334155; border-radius: 12px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.4)); color: #e2e8f0; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 600;" onmouseover="this.style.borderColor='#10b981'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#334155'; this.style.transform='translateY(0)'">
              <i class="fas fa-robot" style="color: #10b981;"></i>
              ChatGPT
            </button>
            <button class="llm-option-btn" data-llm="https://claude.ai" style="padding: 16px; border: 2px solid #334155; border-radius: 12px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.4)); color: #e2e8f0; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 600;" onmouseover="this.style.borderColor='#8b5cf6'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#334155'; this.style.transform='translateY(0)'">
              <i class="fas fa-brain" style="color: #8b5cf6;"></i>
              Claude
            </button>
            <button class="llm-option-btn" data-llm="https://gemini.google.com" style="padding: 16px; border: 2px solid #334155; border-radius: 12px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.4)); color: #e2e8f0; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 600;" onmouseover="this.style.borderColor='#06b6d4'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#334155'; this.style.transform='translateY(0)'">
              <i class="fas fa-gem" style="color: #06b6d4;"></i>
              Gemini
            </button>
            <button class="llm-option-btn" data-llm="https://www.perplexity.ai" style="padding: 16px; border: 2px solid #334155; border-radius: 12px; background: linear-gradient(135deg, rgba(30, 41, 59, 0.8), rgba(51, 65, 85, 0.4)); color: #e2e8f0; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 12px; font-weight: 600;" onmouseover="this.style.borderColor='#f59e0b'; this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='#334155'; this.style.transform='translateY(0)'">
              <i class="fas fa-search" style="color: #f59e0b;"></i>
              Perplexity
            </button>
          </div>
        </div>
      `;
    } else {
      // Step 2: Prompt Creation
      return `
        <div class="onboarding-state" style="text-align: center; padding: 60px 20px;">
          <h2 style="color: #f1f5f9; font-size: 24px; margin: 0 0 8px 0; font-weight: 700;">Now add a prompt</h2>
          <p style="color: #94a3b8; margin: 0 0 32px 0; font-size: 14px; line-height: 1.5;">Click Add or Highlight any text on a webpage & right click to save as a prompt</p>
          
          <button class="quick-action-btn" id="onboardingAddBtn" style="background: linear-gradient(135deg, #14b8a6, #0d9488); color: white; border: none; padding: 16px 32px; border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(20, 184, 166, 0.4); transition: all 0.2s;">
            <i class="fas fa-plus" style="margin-right: 8px;"></i> Add Your First Prompt
          </button>
          
          <p style="color: #64748b; margin: 16px 0 0 0; font-size: 12px;">
            <a href="#" id="onboardingImportBtn" style="color: #64748b; text-decoration: underline; cursor: pointer; font-size: 14px; font-weight: 500;">Or import a backup</a>
          </p>
        </div>
      `;
    }
  }
}

// Initialize when DOM is ready
let sidebarManager;
document.addEventListener('DOMContentLoaded', () => {
  sidebarManager = new SidebarManager();
});