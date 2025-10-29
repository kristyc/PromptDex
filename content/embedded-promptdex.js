// PromptDex - Embedded Content Script
// This script runs directly on ChatGPT/Claude pages and provides a floating prompt picker

class EmbeddedPromptDex {
  constructor() {
    this.prompts = [];
    this.isVisible = false;
    this.platform = this.detectPlatform();
    
    console.log('🚀 PromptDex embedded script starting...');
    console.log('📍 Current URL:', window.location.href);
    console.log('🎯 Detected platform:', this.platform);
    
    this.init();
  }

  async init() {
    console.log('🔄 Initializing PromptDex...');
    
    await this.loadPrompts();
    console.log('📚 Loaded', this.prompts.length, 'prompts');
    
    this.createFloatingPicker();
    console.log('🎨 Created floating picker');
    
    this.setupKeyboardShortcuts();
    console.log('⌨️ Set up keyboard shortcuts');
    
    this.setupContextMenu();
    console.log('🖱️ Set up context menu');
    
    console.log('✅ PromptDex ready! Press Ctrl+Shift+P to open');
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
      
      <div style="padding: 12px; border-top: 1px solid #334155; font-size: 11px; color: #64748b; text-align: center;">
        Press Ctrl+Shift+P to toggle • Right-click to save text
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

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.isVisible && !this.container.contains(e.target)) {
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
      // Ctrl+Shift+P to toggle picker
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.togglePicker();
      }
      
      // Escape to close picker
      if (e.key === 'Escape' && this.isVisible) {
        this.hidePicker();
      }
    });
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

    const hasVariables = /\{\{[^}]+\}\}/.test(prompt.content);
    let finalPrompt = prompt.content;

    if (hasVariables) {
      // Extract all unique variables from the prompt
      const variables = [...new Set(prompt.content.match(/\{\{([^}]+)\}\}/g))];
      const variableList = variables.map(v => v.replace(/[{}]/g, '')).join(', ');
      
      finalPrompt = `I'd like you to help me with this prompt. As you work through it, please ask me for the values of these variables one by one: ${variableList}

Please ask for each variable value before proceeding with the prompt:

${prompt.content}`;
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
    const content = prompt('Enter prompt content:');
    if (!content || !content.trim()) return;

    const title = prompt('Enter prompt title:') || this.generateTitle(content);
    const category = prompt('Enter category (general, writing, coding, analysis, communication, creative, business, education):') || 'general';
    
    this.addPrompt(title.trim(), content.trim(), category.trim());
  }

  editPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;

    const newContent = prompt('Edit prompt content:', prompt.content);
    if (newContent === null) return;

    const newTitle = prompt('Edit prompt title:', prompt.title);
    if (newTitle === null) return;

    const newCategory = prompt('Edit category (general, writing, coding, analysis, communication, creative, business, education):', prompt.category) || prompt.category;

    const promptIndex = this.prompts.findIndex(p => p.id === promptId);
    this.prompts[promptIndex] = {
      ...prompt,
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory.trim(),
      updatedAt: new Date().toISOString()
    };

    this.savePrompts();
    this.renderPrompts();
    this.showNotification('Prompt updated!', 'success');
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
    return /\{\{[^}]+\}\}/.test(content);
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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new EmbeddedPromptDex());
} else {
  new EmbeddedPromptDex();
}