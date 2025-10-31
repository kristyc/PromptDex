class FullViewManager {
  constructor() {
    this.prompts = [];
    this.categories = ['general', 'writing', 'coding', 'analysis', 'communication', 'creative', 'business', 'education'];
    this.selectedPrompts = new Set();
    this.currentFilter = 'all';
    this.currentSearch = '';
    this.editingPromptId = null;
    this.currentShortcut = 'Ctrl+Shift+P';
    this.isRecordingShortcut = false;
    this.draftData = null;
    this.lastSelectedCategory = 'general';
    
    this.init();
  }

  async init() {
    await this.loadData();
    await this.loadDraftData();
    await this.loadLastSelectedCategory();
    await this.loadCustomUrls();
    this.setupEventListeners();
    this.renderStats();
    this.renderCategoryFilters();
    this.renderPrompts();
    this.updateBulkActions();
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
    document.getElementById('addPromptBtn').addEventListener('click', () => this.showPromptModal());
    document.getElementById('settingsBtn').addEventListener('click', () => this.showSettingsModal());

    // Search and filters
    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.currentSearch = e.target.value;
      this.renderPrompts();
    });

    // Category filter is now handled by pills in renderCategoryFilters()

    // Selection controls
    document.getElementById('selectAllBtn').addEventListener('click', () => this.selectAll());
    document.getElementById('clearSelectionBtn').addEventListener('click', () => this.clearSelection());

    // Bulk actions
    document.getElementById('bulkCategoryBtn').addEventListener('click', () => this.applyBulkCategory());
    document.getElementById('bulkDeleteBtn').addEventListener('click', () => this.bulkDelete());

    // Modal events
    document.getElementById('savePrompt').addEventListener('click', () => this.savePrompt());
    document.getElementById('cancelPrompt').addEventListener('click', () => this.hidePromptModal());

    // Click outside modal to close
    document.getElementById('promptModal').addEventListener('click', (e) => {
      if (e.target.id === 'promptModal') {
        this.hidePromptModal();
      }
    });

    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') {
        this.hideSettingsModal();
      }
    });

    // Settings modal events
    document.getElementById('closeSettingsModal').addEventListener('click', () => this.hideSettingsModal());
    document.getElementById('exportDataModal').addEventListener('click', () => this.exportData());
    document.getElementById('importDataModal').addEventListener('click', () => document.getElementById('importFileModal').click());
    document.getElementById('importFileModal').addEventListener('change', (e) => this.importData(e));
    document.getElementById('recordShortcutModal').addEventListener('click', () => this.startRecordingShortcut());
    document.getElementById('resetShortcutModal').addEventListener('click', () => this.resetShortcut());
    document.getElementById('cleanupBracketsModal').addEventListener('click', () => this.cleanupAllVariableFormats());
    document.getElementById('editUrlsModal').addEventListener('click', () => this.toggleUrlManager());
    document.getElementById('addUrlModal').addEventListener('click', () => this.showAddUrlPrompt());
    document.getElementById('closeUrlManagerModal').addEventListener('click', () => this.hideUrlManager());

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
  }

  renderStats() {
    const totalPrompts = this.prompts.length;
    const uniqueCategories = [...new Set(this.prompts.map(p => p.category))].length;
    const variablePrompts = this.prompts.filter(p => this.hasVariables(p.content)).length;

    document.getElementById('totalPrompts').textContent = totalPrompts;
    document.getElementById('totalCategories').textContent = uniqueCategories;
    document.getElementById('variablePrompts').textContent = variablePrompts;
  }

  renderCategoryFilters() {
    const categoryPills = document.getElementById('categoryPills');
    const bulkCategorySelect = document.getElementById('bulkCategorySelect');

    // Get unique categories from prompts
    const usedCategories = [...new Set(this.prompts.map(p => p.category))];
    
    // Category filter pills
    categoryPills.innerHTML = '';
    
    // Add "All" pill
    const allPill = document.createElement('div');
    allPill.className = `category-pill ${this.currentFilter === 'all' ? 'active' : ''}`;
    allPill.dataset.category = 'all';
    allPill.textContent = 'All';
    allPill.addEventListener('click', () => this.filterByCategory('all'));
    categoryPills.appendChild(allPill);
    
    // Add category pills
    usedCategories.forEach(category => {
      const pill = document.createElement('div');
      pill.className = `category-pill ${this.currentFilter === category ? 'active' : ''}`;
      pill.dataset.category = category;
      pill.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      pill.addEventListener('click', () => this.filterByCategory(category));
      categoryPills.appendChild(pill);
    });

    // Bulk category select
    bulkCategorySelect.innerHTML = '<option value="">Change category...</option>';
    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      bulkCategorySelect.appendChild(option);
    });

    // Populate modal category dropdown
    const promptCategory = document.getElementById('promptCategory');
    promptCategory.innerHTML = '';
    this.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category.charAt(0).toUpperCase() + category.slice(1);
      promptCategory.appendChild(option);
    });
  }
  
  filterByCategory(category) {
    this.currentFilter = category;
    this.renderCategoryFilters();
    this.renderPrompts();
  }

  highlightSearchTerm(text, searchTerm) {
    if (!searchTerm) return this.escapeHtml(text);
    
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return this.escapeHtml(text).replace(regex, '<mark style="background: #f59e0b; color: #000; padding: 1px 2px; border-radius: 2px;">$1</mark>');
  }

  renderPrompts() {
    const promptsGrid = document.getElementById('promptsGrid');
    const emptyState = document.getElementById('emptyState');
    
    // Filter prompts
    let filteredPrompts = this.prompts;
    
    if (this.currentFilter !== 'all') {
      filteredPrompts = filteredPrompts.filter(p => p.category === this.currentFilter);
    }
    
    if (this.currentSearch) {
      const searchTerm = this.currentSearch.toLowerCase();
      filteredPrompts = filteredPrompts.filter(p => 
        p.title.toLowerCase().includes(searchTerm) || 
        p.content.toLowerCase().includes(searchTerm)
      );
    }

    if (filteredPrompts.length === 0) {
      promptsGrid.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    promptsGrid.style.display = 'grid';
    emptyState.style.display = 'none';

    promptsGrid.innerHTML = filteredPrompts.map(prompt => {
      const variables = this.extractVariables(prompt.content);
      const multipleChoice = this.extractMultipleChoice(prompt.content);
      const isSelected = this.selectedPrompts.has(prompt.id);

      return `
        <div class="prompt-card ${isSelected ? 'selected' : ''}" data-prompt-id="${prompt.id}">
          <div class="prompt-checkbox ${isSelected ? 'checked' : ''}" data-prompt-id="${prompt.id}"></div>
          
          <div class="prompt-header">
            <div>
              <div class="prompt-title">${this.highlightSearchTerm(prompt.title, this.currentSearch)}</div>
              <span class="prompt-category" style="background: ${this.getCategoryColor(prompt.category)}; color: #000000;">${prompt.category}</span>
            </div>
          </div>
          
          <div class="prompt-content">${this.highlightSearchTerm(prompt.content, this.currentSearch)}</div>
          
          ${variables.length > 0 || multipleChoice.length > 0 ? `
            <div class="prompt-variables">
              ${variables.map(v => `<span class="variable-tag">{${v}}</span>`).join('')}
              ${multipleChoice.map(v => `<span class="variable-tag">[${v}]</span>`).join('')}
            </div>
          ` : ''}
          
          <div class="prompt-actions">
            <button class="prompt-action-btn use" data-action="use" data-prompt-id="${prompt.id}">Use</button>
            <button class="prompt-action-btn copy" data-action="copy" data-prompt-id="${prompt.id}" title="Copy to clipboard"><i class="far fa-copy"></i></button>
            <button class="prompt-action-btn edit" data-action="edit" data-prompt-id="${prompt.id}">Edit</button>
            <button class="prompt-action-btn delete" data-action="delete" data-prompt-id="${prompt.id}">Delete</button>
          </div>
        </div>
      `;
    }).join('');

    // Add event listeners to cards
    this.attachPromptEventListeners();
  }

  attachPromptEventListeners() {
    // Checkbox clicks
    document.querySelectorAll('.prompt-checkbox').forEach(checkbox => {
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        const promptId = e.target.dataset.promptId;
        this.toggleSelection(promptId);
      });
    });

    // Action button clicks
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

    // Card clicks to toggle selection
    document.querySelectorAll('.prompt-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.prompt-action-btn')) {
          const promptId = card.dataset.promptId;
          this.toggleSelection(promptId);
        }
      });
    });
  }

  toggleSelection(promptId) {
    if (this.selectedPrompts.has(promptId)) {
      this.selectedPrompts.delete(promptId);
    } else {
      this.selectedPrompts.add(promptId);
    }
    
    this.updateCardSelection(promptId);
    this.updateBulkActions();
  }

  updateCardSelection(promptId) {
    const card = document.querySelector(`[data-prompt-id="${promptId}"]`);
    const checkbox = card.querySelector('.prompt-checkbox');
    
    if (this.selectedPrompts.has(promptId)) {
      card.classList.add('selected');
      checkbox.classList.add('checked');
    } else {
      card.classList.remove('selected');
      checkbox.classList.remove('checked');
    }
  }

  selectAll() {
    const visiblePrompts = document.querySelectorAll('.prompt-card');
    visiblePrompts.forEach(card => {
      const promptId = card.dataset.promptId;
      this.selectedPrompts.add(promptId);
      this.updateCardSelection(promptId);
    });
    this.updateBulkActions();
  }

  clearSelection() {
    this.selectedPrompts.clear();
    document.querySelectorAll('.prompt-card').forEach(card => {
      card.classList.remove('selected');
      card.querySelector('.prompt-checkbox').classList.remove('checked');
    });
    this.updateBulkActions();
  }

  updateBulkActions() {
    const bulkActions = document.getElementById('bulkActions');
    const bulkInfo = document.getElementById('bulkInfo');
    const selectedCount = this.selectedPrompts.size;
    
    if (selectedCount > 0) {
      bulkActions.classList.add('visible');
      bulkInfo.textContent = `${selectedCount} prompt${selectedCount === 1 ? '' : 's'} selected`;
    } else {
      bulkActions.classList.remove('visible');
    }
  }

  async applyBulkCategory() {
    const newCategory = document.getElementById('bulkCategorySelect').value;
    if (!newCategory) {
      this.showNotification('Please select a category', 'error');
      return;
    }

    const selectedIds = Array.from(this.selectedPrompts);
    selectedIds.forEach(id => {
      const prompt = this.prompts.find(p => p.id === id);
      if (prompt) {
        prompt.category = newCategory;
      }
    });

    const saved = await this.savePrompts();
    if (saved) {
      this.renderStats();
      this.renderCategoryFilters();
      this.renderPrompts();
      this.clearSelection();
      this.showNotification(`Updated ${selectedIds.length} prompts to ${newCategory} category`, 'success');
    } else {
      this.showNotification('Failed to update categories', 'error');
    }
  }

  async bulkDelete() {
    const selectedCount = this.selectedPrompts.size;
    if (!confirm(`Delete ${selectedCount} selected prompt${selectedCount === 1 ? '' : 's'}? This cannot be undone.`)) {
      return;
    }

    const selectedIds = Array.from(this.selectedPrompts);
    this.prompts = this.prompts.filter(p => !selectedIds.includes(p.id));

    const saved = await this.savePrompts();
    if (saved) {
      this.renderStats();
      this.renderCategoryFilters();
      this.renderPrompts();
      this.clearSelection();
      this.showNotification(`Deleted ${selectedCount} prompt${selectedCount === 1 ? '' : 's'}`, 'success');
    } else {
      this.showNotification('Failed to delete prompts', 'error');
    }
  }

  async usePrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    try {
      // Check if we're on an AI page first
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      const isAIPage = this.isAIPage(tab.url);
      
      if (isAIPage) {
        // Inject directly into the current AI tab
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'injectPrompt',
            prompt: prompt
          });
          this.showNotification('Prompt injected into chat!', 'success');
          return;
        } catch (error) {
          console.log('Injection failed, falling back to new tab');
        }
      }
      
      // Auto-navigate to default LLM and inject prompt after page loads
      const defaultLLM = await this.getDefaultLLM();
      const newTab = await chrome.tabs.create({ url: defaultLLM });
      this.showNotification('Opening AI chat and injecting prompt...', 'success');
      
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
      
    } catch (error) {
      console.error('Error using prompt:', error);
      this.showNotification(`Go to ChatGPT/Claude and press ${this.currentShortcut} to use prompts!`, 'info');
    }
  }

  isAIPage(url) {
    const aiUrls = [
      'chatgpt.com', 'chat.openai.com', 'claude.ai', 'gemini.google.com',
      'perplexity.ai', 'chat.deepseek.com', 'grok.x.ai', 'meta.ai',
      'you.com', 'poe.com', 'huggingface.co'
    ];
    return aiUrls.some(aiUrl => url.includes(aiUrl));
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

  editPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    this.editingPromptId = promptId;
    this.showPromptModal(prompt);
  }

  async deletePrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    const promptTitle = prompt.title.length > 30 ? prompt.title.substring(0, 30) + '...' : prompt.title;
    if (!confirm(`Are you sure you want to delete "${promptTitle}"?\n\nThis action cannot be undone.`)) return;

    this.prompts = this.prompts.filter(p => p.id !== promptId);
    const saved = await this.savePrompts();
    
    if (saved) {
      this.renderStats();
      this.renderCategoryFilters();
      this.renderPrompts();
      this.showNotification('Prompt deleted successfully', 'success');
    } else {
      this.showNotification('Failed to delete prompt', 'error');
    }
  }

  showPromptModal(prompt = null) {
    const modal = document.getElementById('promptModal');
    const modalTitle = document.getElementById('modalTitle');
    const saveBtn = document.getElementById('savePrompt');
    
    modal.style.display = 'flex';
    
    if (prompt) {
      modalTitle.textContent = 'Edit Prompt';
      saveBtn.textContent = 'Update Prompt';
      document.getElementById('promptContent').value = prompt.content;
      document.getElementById('promptTitle').value = prompt.title;
      document.getElementById('promptCategory').value = prompt.category;
    } else {
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

    setTimeout(() => {
      document.getElementById('promptContent').focus();
    }, 100);
  }

  hidePromptModal() {
    document.getElementById('promptModal').style.display = 'none';
    
    // Save current form data as draft if not editing
    if (!this.editingPromptId) {
      this.saveDraftData();
    }
  }

  async savePrompt() {
    const title = document.getElementById('promptTitle').value.trim();
    let content = document.getElementById('promptContent').value.trim();
    const category = document.getElementById('promptCategory').value;

    if (!content) {
      this.showNotification('Please write your prompt content before saving', 'error');
      return;
    }

    // Convert old variable formats
    content = await this.convertVariableFormats(content);

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
    }

    const saved = await this.savePrompts();
    if (saved) {
      // Remember the last selected category for new prompts
      if (!this.editingPromptId) {
        this.lastSelectedCategory = category;
        await this.saveLastSelectedCategory();
      }
      
      // Clear draft data on successful save
      await this.clearDraftData();
      
      this.hidePromptModal();
      this.renderStats();
      this.renderCategoryFilters();
      this.renderPrompts();
      this.showNotification(this.editingPromptId ? 'Prompt updated!' : 'Prompt saved!', 'success');
    } else {
      this.showNotification('Failed to save prompt', 'error');
    }
  }

  convertVariableFormats(content) {
    // Auto-convert old formats like in popup
    let convertedContent = content;
    
    // Convert {{variable}} to {variable}
    convertedContent = convertedContent.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    
    // Convert <variable> to {variable}
    convertedContent = convertedContent.replace(/<([^>]+)>/g, '{$1}');
    
    // Convert var[variable] to {variable}
    convertedContent = convertedContent.replace(/var\[([^\]]+)\]/gi, '{$1}');
    
    // Convert single-value [variable] to {variable}
    convertedContent = convertedContent.replace(/\[([^\]]+)\]/g, (match, content_inner) => {
      const hasMultipleValues = /[,\/\|]|(\s+or\s+)|(\s+and\s+)/.test(content_inner.trim());
      if (!hasMultipleValues && /^[a-zA-Z_][a-zA-Z0-9_\s]*$/.test(content_inner.trim())) {
        return `{${content_inner.trim()}}`;
      }
      return match;
    });
    
    return convertedContent;
  }

  predictTitle() {
    const content = document.getElementById('promptContent').value.trim();
    if (!content) return;

    let title = content.split(/[.!?]/)[0].trim();
    title = title.replace(/^(please|can you|could you|help me|i need|i want|write|create|generate)/i, '');
    title = title.replace(/{[^}]+}/g, '[variable]');
    title = title.trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    
    if (title.length > 60) {
      title = title.substring(0, 57) + '...';
    }

    document.getElementById('promptTitle').value = title || 'Custom Prompt';
  }

  generateTitle(content) {
    const words = content.trim().split(/\s+/).slice(0, 6);
    let title = words.join(' ');
    title = title.replace(/^(please|can you|could you|help me|i need|i want)/i, '');
    title = title.replace(/{[^}]+}/g, '[variable]');
    title = title.trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    return title.length > 50 ? title.substring(0, 47) + '...' : title || 'Custom Prompt';
  }

  hasVariables(content) {
    return /\{[^}]+\}/.test(content) || /\[[^\]]+\]/.test(content);
  }

  extractVariables(content) {
    const matches = content.match(/\{([^}]+)\}/g) || [];
    return [...new Set(matches.map(m => m.slice(1, -1)))];
  }

  extractMultipleChoice(content) {
    const matches = content.match(/\[([^\]]+)\]/g) || [];
    return [...new Set(matches.map(m => m.slice(1, -1)).filter(m => 
      /[,\/\|]|(\s+or\s+)|(\s+and\s+)/.test(m)
    ))];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showSettingsModal() {
    document.getElementById('settingsModal').style.display = 'flex';
    document.getElementById('shortcutInputModal').value = this.currentShortcut;
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
          // Check for duplicates based on title
          const titleKey = importedPrompt.title.toLowerCase().trim();
          if (!existingTitles.has(titleKey)) {
            // Ensure the prompt has a unique ID
            const newPrompt = {
              ...importedPrompt,
              id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
              importedAt: new Date().toISOString()
            };
            this.prompts.push(newPrompt);
            existingTitles.add(titleKey);
            newPromptsAdded++;
          } else {
            duplicatesSkipped++;
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
        
        await chrome.storage.local.set({customCategories: this.categories});
      }

      // Refresh the UI
      this.renderStats();
      this.renderCategoryFilters();
      this.renderPrompts();
      this.clearSelection();

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
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (data.prompts && Array.isArray(data.prompts)) {
      for (const prompt of data.prompts) {
        if (!prompt.id || !prompt.title || !prompt.content || !prompt.category) {
          return false;
        }
      }
    }

    if (data.categories && !Array.isArray(data.categories)) {
      return false;
    }

    return true;
  }

  startRecordingShortcut() {
    this.isRecordingShortcut = true;
    const recordBtn = document.getElementById('recordShortcutModal');
    const shortcutInput = document.getElementById('shortcutInputModal');
    
    recordBtn.textContent = 'Press Keys...';
    recordBtn.disabled = true;
    shortcutInput.value = 'Press your key combination...';
    shortcutInput.style.background = '#ea580c';
    
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
  }

  async finishRecordingShortcut(shortcut) {
    this.isRecordingShortcut = false;
    document.removeEventListener('keydown', this.handleShortcutRecording.bind(this), true);
    
    const recordBtn = document.getElementById('recordShortcutModal');
    const shortcutInput = document.getElementById('shortcutInputModal');
    
    recordBtn.textContent = 'Record';
    recordBtn.disabled = false;
    shortcutInput.style.background = '#1e293b';
    
    this.currentShortcut = shortcut;
    shortcutInput.value = shortcut;
    
    await chrome.storage.local.set({customShortcut: this.currentShortcut});
    this.showNotification(`Shortcut updated to ${shortcut}`, 'success');
  }

  async resetShortcut() {
    this.currentShortcut = 'Ctrl+Shift+P';
    await chrome.storage.local.set({customShortcut: this.currentShortcut});
    
    const shortcutInput = document.getElementById('shortcutInputModal');
    shortcutInput.value = this.currentShortcut;
    
    this.showNotification('Shortcut reset to default', 'success');
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
      font-size: 14px;
      z-index: 10000;
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

  convertVariableFormatsImport(content) {
    // Convert double curly braces {{variable}} to {variable}
    content = content.replace(/\{\{([^}]+)\}\}/g, '{$1}');
    
    // Convert single brackets [variable] to {variable} but preserve multiple choice [opt1/opt2/opt3]
    content = content.replace(/\[([^\]\/]+)\]/g, (match, variable) => {
      // If it contains a slash, it's a multiple choice - keep as is
      if (variable.includes('/')) {
        return match;
      }
      // Otherwise convert to curly braces
      return `{${variable}}`;
    });
    
    return content;
  }

  // URL Management
  toggleUrlManager() {
    const urlManager = document.getElementById('urlManagerModal');
    if (urlManager.style.display === 'none') {
      this.showUrlManager();
    } else {
      this.hideUrlManager();
    }
  }

  async showUrlManager() {
    await this.loadCustomUrls();
    this.renderUrlList();
    document.getElementById('urlManagerModal').style.display = 'block';
  }

  hideUrlManager() {
    document.getElementById('urlManagerModal').style.display = 'none';
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
      this.updateUrlCount();
    } catch (error) {
      console.error('Failed to load custom URLs:', error);
      this.customUrls = [];
    }
  }

  async saveCustomUrls() {
    try {
      await chrome.storage.local.set({supportedUrls: this.customUrls});
      this.updateUrlCount();
      return true;
    } catch (error) {
      console.error('Failed to save custom URLs:', error);
      return false;
    }
  }

  renderUrlList() {
    const urlList = document.getElementById('urlListModal');
    urlList.innerHTML = this.customUrls.map((url, index) => `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 8px; background: #1e293b; border: 1px solid #334155; border-radius: 4px; margin-bottom: 6px;">
        <span style="font-size: 11px; color: #e2e8f0; flex: 1; overflow: hidden; text-overflow: ellipsis;">${url}</span>
        <button onclick="fullViewManager.removeUrl(${index})" style="background: #dc2626; color: white; border: none; padding: 2px 6px; border-radius: 3px; font-size: 10px; cursor: pointer;">Remove</button>
      </div>
    `).join('');
  }

  async showAddUrlPrompt() {
    const url = prompt('Enter URL to add to supported sites:');
    if (url && url.trim()) {
      try {
        new URL(url.trim()); // Validate URL
        this.customUrls.push(url.trim());
        await this.saveCustomUrls();
        this.renderUrlList();
        this.showNotification('URL added successfully!', 'success');
      } catch (error) {
        this.showNotification('Invalid URL format', 'error');
      }
    }
  }

  async removeUrl(index) {
    this.customUrls.splice(index, 1);
    await this.saveCustomUrls();
    this.renderUrlList();
    this.showNotification('URL removed', 'success');
  }

  updateUrlCount() {
    const urlCount = document.getElementById('urlCountModal');
    if (urlCount) {
      urlCount.textContent = `(${this.customUrls.length} URLs)`;
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

  // Draft Data Management
  async loadDraftData() {
    try {
      const result = await chrome.storage.local.get(['promptDraftDataFullview']);
      this.draftData = result.promptDraftDataFullview || null;
      console.log('Loaded fullview draft data:', this.draftData);
    } catch (error) {
      console.error('Failed to load fullview draft data:', error);
      this.draftData = null;
    }
  }

  async saveDraftData() {
    try {
      // Only save if modal is open and we're not editing
      const modal = document.getElementById('promptModal');
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
        
        await chrome.storage.local.set({promptDraftDataFullview: this.draftData});
        console.log('Saved fullview draft data:', this.draftData);
      }
    } catch (error) {
      console.error('Failed to save fullview draft data:', error);
    }
  }

  async clearDraftData() {
    try {
      this.draftData = null;
      await chrome.storage.local.remove(['promptDraftDataFullview']);
      console.log('Cleared fullview draft data');
    } catch (error) {
      console.error('Failed to clear fullview draft data:', error);
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
}

// Initialize when DOM is ready
let fullViewManager;
document.addEventListener('DOMContentLoaded', () => {
  fullViewManager = new FullViewManager();
});