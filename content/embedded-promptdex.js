// PromptDex - Embedded Content Script
// This script runs directly on ChatGPT/Claude pages and provides a floating prompt picker

class EmbeddedPromptDex {
  constructor() {
    this.prompts = [];
    this.isVisible = false;
    this.platform = this.detectPlatform();
    this.currentShortcut = 'Ctrl+Shift+P';
    
    console.log('🚀 PromptDex embedded script starting...');
    console.log('📍 Current URL:', window.location.href);
    console.log('🎯 Detected platform:', this.platform);
    
    this.init();
  }

  async init() {
    console.log('🔄 Initializing PromptDex...');
    console.log('🌐 Current URL:', window.location.href);
    console.log('🎯 Detected platform:', this.platform);
    
    await this.loadPrompts();
    console.log('📚 Loaded', this.prompts.length, 'prompts');
    
    await this.loadShortcut();
    console.log('⌨️ Loaded shortcut:', this.currentShortcut);
    
    this.createFloatingPicker();
    console.log('🎨 Created floating picker');
    
    this.setupKeyboardShortcuts();
    console.log('⌨️ Set up keyboard shortcuts');
    
    this.setupContextMenu();
    console.log('🖱️ Set up context menu');
    
    console.log(`✅ PromptDex ready! Press ${this.currentShortcut} to open`);
    console.log('🔍 Extension should be working. Try the keyboard shortcut now.');
  }

  detectPlatform() {
    const url = window.location.href;
    if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) return 'chatgpt';
    if (url.includes('claude.ai')) return 'claude';
    return 'unknown';
  }

  async loadPrompts() {
    try {
      const result = await chrome.storage.local.get(['localPrompts']);
      this.prompts = result.localPrompts || [];
    } catch (error) {
      console.error('Failed to load prompts:', error);
      this.prompts = [];
    }
  }

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

  async savePrompts() {
    try {
      await chrome.storage.local.set({localPrompts: this.prompts});
      return true;
    } catch (error) {
      console.error('Failed to save prompts:', error);
      return false;
    }
  }

  createFloatingPicker() {
    // Create main container
    this.container = document.createElement('div');
    this.container.id = 'promptdex-floating-picker';
    this.container.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      max-height: 500px;
      background: #1a1a2e;
      border: 1px solid #334155;
      border-radius: 12px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #e2e8f0;
      display: none;
      flex-direction: column;
      backdrop-filter: blur(10px);
    `;

    this.container.innerHTML = `
      <div style="padding: 16px; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
        <h3 style="margin: 0; font-size: 16px; font-weight: 600; background: linear-gradient(135deg, #f97316, #14b8a6); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
          PromptDex
        </h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          <button id="promptdex-add-btn" style="background: #ea580c; color: white; border: none; padding: 4px 8px; border-radius: 4px; font-size: 12px; cursor: pointer; font-weight: 600;">
            ➕ Add
          </button>
          <button id="promptdex-close-btn" style="background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 18px; padding: 0; width: 24px; height: 24px;">
            ×
          </button>
        </div>
      </div>
      
      <div style="padding: 12px;">
        <input type="text" id="promptdex-search" placeholder="Search prompts..." style="
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #334155;
          border-radius: 6px;
          background: #0f0f23;
          color: #e2e8f0;
          font-size: 13px;
          box-sizing: border-box;
        ">
      </div>
      
      <div id="promptdex-prompts-list" style="
        flex: 1;
        overflow-y: auto;
        padding: 0 12px 12px 12px;
        max-height: 350px;
      "></div>
      
      <div style="padding: 12px; border-top: 1px solid #334155; font-size: 11px; color: #ffffff; text-align: center;">
        Press ${this.currentShortcut} to toggle • Right-click to save text
      </div>
    `;

    document.body.appendChild(this.container);
    this.setupPickerEvents();
    this.renderPrompts();
  }

  setupPickerEvents() {
    // Close button
    this.container.querySelector('#promptdex-close-btn').addEventListener('click', () => {
      this.hidePicker();
    });

    // Add button
    this.container.querySelector('#promptdex-add-btn').addEventListener('click', () => {
      this.showAddPromptDialog();
    });

    // Search
    this.container.querySelector('#promptdex-search').addEventListener('input', (e) => {
      this.renderPrompts(e.target.value);
    });

    // Click outside to close (but not when editing)
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.container.contains(e.target) && !this.container.querySelector('#promptdex-edit-form')) {
        this.hidePicker();
      }
    });

    // Prevent picker from closing when clicking inside
    this.container.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Check for custom shortcut
      if (this.matchesShortcut(e)) {
        e.preventDefault();
        console.log('🎯 Keyboard shortcut detected, toggling picker');
        this.togglePicker();
      }
      
      // Escape to close picker
      if (e.key === 'Escape' && this.isVisible) {
        this.hidePicker();
      }
    });
  }

  matchesShortcut(e) {
    const parts = this.currentShortcut.split('+');
    const requiredKeys = parts.map(p => p.toLowerCase());
    
    const pressedKeys = [];
    if (e.ctrlKey) pressedKeys.push('ctrl');
    if (e.altKey) pressedKeys.push('alt');
    if (e.shiftKey) pressedKeys.push('shift');
    if (e.metaKey) pressedKeys.push('meta');
    
    const mainKey = e.key.toLowerCase();
    
    // Only add main key if it's not a modifier
    if (!['control', 'alt', 'shift', 'meta'].includes(mainKey)) {
      pressedKeys.push(mainKey);
    }
    
    return requiredKeys.every(key => pressedKeys.includes(key)) && 
           pressedKeys.length === requiredKeys.length;
  }

  setupContextMenu() {
    // Add context menu for selected text (will be handled by background script)
    document.addEventListener('contextmenu', (e) => {
      const selectedText = window.getSelection().toString().trim();
      if (selectedText) {
        // Store selected text for potential saving
        this.lastSelectedText = selectedText;
      }
    });
  }

  togglePicker() {
    if (this.isVisible) {
      this.hidePicker();
    } else {
      this.showPicker();
    }
  }

  showPicker() {
    this.container.style.display = 'flex';
    this.isVisible = true;
    
    // Focus search box
    setTimeout(() => {
      this.container.querySelector('#promptdex-search').focus();
    }, 100);
  }

  hidePicker() {
    this.container.style.display = 'none';
    this.isVisible = false;
  }

  renderPrompts(searchTerm = '') {
    const promptsList = this.container.querySelector('#promptdex-prompts-list');
    let filteredPrompts = this.prompts;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filteredPrompts = this.prompts.filter(p => 
        p.title.toLowerCase().includes(term) || 
        p.content.toLowerCase().includes(term)
      );
    }

    if (filteredPrompts.length === 0) {
      promptsList.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #64748b;">
          <div style="font-size: 14px; margin-bottom: 8px;">
            ${this.prompts.length === 0 ? 'No prompts yet' : 'No matches found'}
          </div>
          <div style="font-size: 12px;">
            ${this.prompts.length === 0 ? 'Click + Add to create your first prompt' : 'Try different search terms'}
          </div>
        </div>
      `;
      return;
    }

    promptsList.innerHTML = filteredPrompts.map(prompt => `
      <div class="promptdex-prompt-item" data-prompt-id="${prompt.id}" style="
        padding: 12px;
        border: 1px solid #334155;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background: #1e293b;
        position: relative;
      ">
        <button class="promptdex-edit-btn" data-prompt-id="${prompt.id}" style="position: absolute; top: 8px; right: 8px; background: #ea580c; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 12px; cursor: pointer; z-index: 2;">✏️</button>
        <div style="font-weight: 600; margin-bottom: 4px; font-size: 14px; color: #f1f5f9; padding-right: 32px;">
          ${this.escapeHtml(prompt.title)}
        </div>
        <div style="font-size: 12px; color: #94a3b8; line-height: 1.4; margin-bottom: 6px; padding-right: 32px;">
          ${this.escapeHtml(this.truncate(prompt.content, 80))}
          ${this.hasVariables(prompt.content) ? '<span style="color: #f97316; font-weight: 600; margin-left: 4px;">📝 Has variables</span>' : ''}
        </div>
        <button class="promptdex-delete-btn" data-prompt-id="${prompt.id}" style="position: absolute; bottom: 8px; right: 8px; background: #ea580c; color: white; border: none; padding: 4px; border-radius: 4px; font-size: 12px; cursor: pointer; z-index: 2;">🗑️</button>
      </div>
    `).join('');

    // Add event listeners to prompt items and buttons
    promptsList.querySelectorAll('.promptdex-prompt-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('promptdex-edit-btn') && !e.target.classList.contains('promptdex-delete-btn')) {
          this.usePrompt(e.currentTarget.dataset.promptId);
        }
      });
      
      item.addEventListener('mouseenter', () => {
        item.style.background = '#334155';
        item.style.borderColor = '#14b8a6';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.background = '#1e293b';
        item.style.borderColor = '#334155';
      });
    });

    // Edit buttons
    promptsList.querySelectorAll('.promptdex-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.editPrompt(e.target.dataset.promptId);
      });
    });

    // Delete buttons
    promptsList.querySelectorAll('.promptdex-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deletePrompt(e.target.dataset.promptId);
      });
    });
  }

  async usePrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    console.log('Using prompt:', prompt.title);
    
    const success = await this.injectPrompt(prompt);
    if (success) {
      this.hidePicker();
      this.showNotification('Prompt injected!', 'success');
    } else {
      this.showNotification('Failed to inject prompt', 'error');
    }
  }

  async injectPrompt(prompt) {
    const textInput = this.findTextInput();
    if (!textInput) {
      console.error('Could not find text input');
      return false;
    }

    const hasVariables = /\{[^}]+\}/.test(prompt.content);
    const hasMultipleChoice = /\[[^\]]+\]/.test(prompt.content);
    let finalPrompt = prompt.content;

    if (hasVariables || hasMultipleChoice) {
      // Extract variables and multiple choice options
      const variables = prompt.content.match(/\{([^}]+)\}/g) || [];
      const multipleChoiceOptions = prompt.content.match(/\[[^\]]+\]/g) || [];
      
      let instructions = "I'd like you to help me with this prompt. ";
      
      if (variables.length > 0) {
        const variableList = variables.map(v => v.replace(/[{}]/g, '')).join(', ');
        instructions += `Please ask me for the values of these variables: ${variableList}. `;
      }
      
      if (multipleChoiceOptions.length > 0) {
        instructions += `For options in brackets [like this], present them as numbered multiple choice where I can respond with just the number (1, 2, 3, etc.). `;
      }
      
      instructions += `Ask for each value before proceeding with the prompt:

${prompt.content}`;
      
      finalPrompt = instructions;
    }

    return await this.insertText(textInput, finalPrompt);
  }

  findTextInput() {
    // ChatGPT selectors
    let input = document.querySelector('textarea[placeholder*="Message"]') ||
                document.querySelector('textarea[data-id*="root"]') ||
                document.querySelector('#prompt-textarea') ||
                document.querySelector('textarea[placeholder*="message"]');

    // Claude selectors
    if (!input) {
      input = document.querySelector('div[contenteditable="true"]') ||
              document.querySelector('[data-testid="chat-input"]') ||
              document.querySelector('div.ProseMirror');
    }

    return input;
  }

  async insertText(input, text) {
    try {
      input.focus();

      if (input.tagName === 'TEXTAREA') {
        // For textarea (ChatGPT)
        input.value = text;
        input.dispatchEvent(new Event('input', {bubbles: true}));
        input.dispatchEvent(new Event('change', {bubbles: true}));
        input.setSelectionRange(text.length, text.length);
      } else {
        // For contenteditable div (Claude)
        input.innerHTML = '';
        input.textContent = text;
        
        // Place cursor at end
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(input);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        input.dispatchEvent(new Event('input', {bubbles: true}));
      }

      return true;
    } catch (error) {
      console.error('Failed to inject text:', error);
      return false;
    }
  }

  showAddPromptDialog() {
    this.showEditDialog(null);
  }

  editPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    this.showEditDialog(prompt);
  }

  async deletePrompt(promptId) {
    if (!confirm('Delete this prompt?')) return;

    this.prompts = this.prompts.filter(p => p.id !== promptId);
    await this.savePrompts();
    this.renderPrompts();
    this.showNotification('Prompt deleted!', 'success');
  }

  async addPrompt(title, content, category = 'general') {
    const newPrompt = {
      id: Date.now().toString(),
      title: title,
      content: content,
      category: category,
      createdAt: new Date().toISOString()
    };

    this.prompts.push(newPrompt);
    const saved = await this.savePrompts();
    
    if (saved) {
      this.renderPrompts();
      this.showNotification('Prompt saved!', 'success');
    } else {
      this.prompts.pop(); // Remove if save failed
      this.showNotification('Failed to save prompt', 'error');
    }
  }

  generateTitle(content) {
    const words = content.trim().split(/\s+/).slice(0, 6);
    let title = words.join(' ');
    title = title.replace(/^(please|can you|could you|help me|i need|i want|write|create)/i, '');
    title = title.trim();
    title = title.charAt(0).toUpperCase() + title.slice(1);
    return title.length > 50 ? title.substring(0, 47) + '...' : title || 'Custom Prompt';
  }

  categorizePrompt(content) {
    const lowerContent = content.toLowerCase();
    if (lowerContent.includes('write') || lowerContent.includes('blog')) return 'writing';
    if (lowerContent.includes('code') || lowerContent.includes('debug')) return 'coding';
    if (lowerContent.includes('analyze') || lowerContent.includes('data')) return 'analysis';
    if (lowerContent.includes('email') || lowerContent.includes('message')) return 'communication';
    return 'general';
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      font-size: 13px;
      z-index: 1000000;
      backdrop-filter: blur(10px);
      ${type === 'success' ? 'background: rgba(20, 184, 166, 0.9);' : 
        type === 'error' ? 'background: rgba(220, 38, 38, 0.9);' : 
        'background: rgba(249, 115, 22, 0.9);'}
    `;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-10px)';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  hasVariables(content) {
    return /\{[^}]+\}/.test(content) || /\[[^\]]+\]/.test(content);
  }

  truncate(text, length) {
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  showEditDialog(prompt = null) {
    // Hide the main picker content
    const promptsList = this.container.querySelector('#promptdex-prompts-list');
    const searchBox = this.container.querySelector('#promptdex-search');
    promptsList.style.display = 'none';
    searchBox.style.display = 'none';

    // Create edit form
    const editForm = document.createElement('div');
    editForm.id = 'promptdex-edit-form';
    editForm.style.cssText = `
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      height: 350px;
    `;

    const isEditing = prompt !== null;
    const title = isEditing ? prompt.title : '';
    const content = isEditing ? prompt.content : '';
    const category = isEditing ? prompt.category : 'general';

    editForm.innerHTML = `
      <h4 style="margin: 0; color: #f1f5f9; font-size: 14px;">${isEditing ? 'Edit Prompt' : 'Add New Prompt'}</h4>
      
      <textarea id="edit-content" placeholder="Enter prompt content..." style="
        flex: 1;
        padding: 8px;
        border: 1px solid #334155;
        border-radius: 6px;
        background: #0f0f23;
        color: #e2e8f0;
        font-family: inherit;
        font-size: 12px;
        resize: none;
        outline: none;
      ">${content}</textarea>
      
      <input type="text" id="edit-title" placeholder="Enter prompt title..." value="${title}" style="
        padding: 8px;
        border: 1px solid #334155;
        border-radius: 6px;
        background: #0f0f23;
        color: #e2e8f0;
        font-family: inherit;
        font-size: 12px;
        outline: none;
      ">
      
      <select id="edit-category" style="
        padding: 8px;
        border: 1px solid #334155;
        border-radius: 6px;
        background: #0f0f23;
        color: #e2e8f0;
        font-family: inherit;
        font-size: 12px;
        outline: none;
      ">
        <option value="general" ${category === 'general' ? 'selected' : ''}>General</option>
        <option value="writing" ${category === 'writing' ? 'selected' : ''}>Writing</option>
        <option value="coding" ${category === 'coding' ? 'selected' : ''}>Coding</option>
        <option value="analysis" ${category === 'analysis' ? 'selected' : ''}>Analysis</option>
        <option value="communication" ${category === 'communication' ? 'selected' : ''}>Communication</option>
        <option value="creative" ${category === 'creative' ? 'selected' : ''}>Creative</option>
        <option value="business" ${category === 'business' ? 'selected' : ''}>Business</option>
        <option value="education" ${category === 'education' ? 'selected' : ''}>Education</option>
      </select>
      
      <div style="display: flex; gap: 8px;">
        <button id="edit-save" style="
          flex: 1;
          padding: 8px;
          background: #ea580c;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        ">${isEditing ? 'Update' : 'Save'}</button>
        <button id="edit-cancel" style="
          flex: 1;
          padding: 8px;
          background: #374151;
          color: #d1d5db;
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
        ">Cancel</button>
      </div>
    `;

    // Replace the prompts list with edit form
    this.container.appendChild(editForm);

    // Add event listeners
    editForm.querySelector('#edit-save').addEventListener('click', () => {
      this.saveEditedPrompt(prompt);
    });

    editForm.querySelector('#edit-cancel').addEventListener('click', () => {
      this.hideEditDialog();
    });

    // Focus on content textarea
    setTimeout(() => {
      editForm.querySelector('#edit-content').focus();
    }, 100);
  }

  async saveEditedPrompt(originalPrompt) {
    const content = this.container.querySelector('#edit-content').value.trim();
    const title = this.container.querySelector('#edit-title').value.trim();
    const category = this.container.querySelector('#edit-category').value;

    if (!content) {
      this.showNotification('Please enter content', 'error');
      return;
    }

    const finalTitle = title || this.generateTitle(content);

    if (originalPrompt) {
      // Update existing prompt
      const promptIndex = this.prompts.findIndex(p => p.id === originalPrompt.id);
      this.prompts[promptIndex] = {
        ...originalPrompt,
        title: finalTitle,
        content: content,
        category: category,
        updatedAt: new Date().toISOString()
      };
      this.showNotification('Prompt updated!', 'success');
    } else {
      // Create new prompt
      await this.addPrompt(finalTitle, content, category);
    }

    this.hideEditDialog();
  }

  hideEditDialog() {
    // Remove edit form
    const editForm = this.container.querySelector('#promptdex-edit-form');
    if (editForm) {
      editForm.remove();
    }

    // Show main picker content
    const promptsList = this.container.querySelector('#promptdex-prompts-list');
    const searchBox = this.container.querySelector('#promptdex-search');
    promptsList.style.display = 'block';
    searchBox.style.display = 'block';

    // Re-render prompts
    this.renderPrompts();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new EmbeddedPromptDex());
} else {
  new EmbeddedPromptDex();
}