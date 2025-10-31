class ContentManager {
  constructor() {
    console.log('PromptDex content script initializing...');
    this.platform = this.detectPlatform();
    console.log('Detected platform:', this.platform);
    this.lastFocusedElement = null; // Track the last focused input element
    this.init();
    console.log('PromptDex content script ready');
  }
  
  init() {
    this.setupMessageListener();
    this.setupPromptPicker();
    this.setupFocusTracking();
  }
  
  detectPlatform() {
    const url = window.location.href;
    
    // Fallback if config not loaded
    if (typeof PROMPTDEX_CONFIG === 'undefined') {
      console.warn('PROMPTDEX_CONFIG not loaded, using fallback detection');
      if (url.includes('chat.openai.com') || url.includes('chatgpt.com')) return 'chatgpt';
      if (url.includes('claude.ai')) return 'claude';
      return 'unknown';
    }
    
    return PROMPTDEX_CONFIG.detectPlatform(url);
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });
  }
  
  setupPromptPicker() {
    // Create floating prompt picker (hidden by default)
    this.createPromptPicker();
  }

  setupFocusTracking() {
    // Track focus on input fields to know where to inject prompts
    document.addEventListener('focusin', (e) => {
      if (this.isInputField(e.target)) {
        this.lastFocusedElement = e.target;
        console.log('Tracking focused element:', e.target);
      }
    });

    // Setup keyboard shortcut listener (Ctrl+Shift+P)
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'P') {
        e.preventDefault();
        this.showPromptPicker();
      }
    });
  }

  isInputField(element) {
    // Check if element is an input field we can inject text into
    const tagName = element.tagName.toLowerCase();
    const type = element.type?.toLowerCase();
    
    return (
      // Standard input fields
      (tagName === 'input' && ['text', 'search', 'url', 'email'].includes(type)) ||
      // Textareas
      tagName === 'textarea' ||
      // Contenteditable elements
      element.contentEditable === 'true' ||
      // Common chat input selectors
      element.matches('div[role="textbox"]') ||
      element.matches('[data-testid*="input"]') ||
      element.matches('[data-testid*="textbox"]')
    );
  }

  detectFocusedField() {
    // First check if we have a tracked focused element that's still valid
    if (this.lastFocusedElement && 
        document.contains(this.lastFocusedElement) && 
        this.isInputField(this.lastFocusedElement)) {
      return this.lastFocusedElement;
    }

    // Fall back to checking currently focused element
    const activeElement = document.activeElement;
    if (activeElement && this.isInputField(activeElement)) {
      return activeElement;
    }

    // Last resort: find any visible input field
    const inputSelectors = [
      'input[type="text"]:not([style*="display: none"]):not([style*="display:none"])',
      'input[type="search"]:not([style*="display: none"]):not([style*="display:none"])',
      'textarea:not([style*="display: none"]):not([style*="display:none"])',
      'div[contenteditable="true"]:not([style*="display: none"]):not([style*="display:none"])',
      '[role="textbox"]:not([style*="display: none"]):not([style*="display:none"])'
    ];

    for (const selector of inputSelectors) {
      const element = document.querySelector(selector);
      if (element && this.isInputField(element)) {
        return element;
      }
    }

    return null;
  }
  
  createPromptPicker() {
    const picker = document.createElement('div');
    picker.id = 'ai-prompt-picker';
    picker.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 500px;
      max-height: 600px;
      background: white;
      border: 1px solid #e1e5e9;
      border-radius: 12px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      z-index: 10000;
      display: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;
    
    picker.innerHTML = `
      <div style="padding: 20px; border-bottom: 1px solid #e1e5e9;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600;">Select Prompt</h3>
          <button id="close-picker" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #6b7280;">&times;</button>
        </div>
        <input id="picker-search" type="text" placeholder="Search prompts..." style="
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          box-sizing: border-box;
        ">
      </div>
      <div id="picker-prompts" style="
        max-height: 400px;
        overflow-y: auto;
        padding: 12px;
      "></div>
    `;
    
    document.body.appendChild(picker);
    
    // Event listeners
    picker.querySelector('#close-picker').addEventListener('click', () => this.hidePromptPicker());
    picker.querySelector('#picker-search').addEventListener('input', (e) => this.filterPrompts(e.target.value));
    picker.addEventListener('click', (e) => {
      if (e.target.classList.contains('picker-prompt-item')) {
        this.selectPrompt(e.target.dataset.promptId);
      }
    });
    
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (!picker.contains(e.target) && picker.style.display === 'block') {
        this.hidePromptPicker();
      }
    });
  }
  
  async handleMessage(request, sender, sendResponse) {
    try {
      console.log('Content script received message:', request);
      
      switch (request.action) {
        case 'ping':
          sendResponse({success: true, message: 'pong'});
          break;
          
        case 'openPromptPicker':
          await this.showPromptPicker();
          sendResponse({success: true});
          break;
          
        case 'injectPrompt':
          console.log('Injecting prompt:', request.prompt);
          await this.injectPrompt(request.prompt);
          sendResponse({success: true});
          break;
          
        default:
          console.log('Unknown action:', request.action);
          sendResponse({success: false, error: 'Unknown action'});
      }
    } catch (error) {
      console.error('Content script error:', error);
      sendResponse({success: false, error: error.message});
    }
  }
  
  async showPromptPicker() {
    try {
      // Load prompts from background
      const response = await chrome.runtime.sendMessage({action: 'loadPrompts'});
      
      if (response.success) {
        this.prompts = response.prompts || [];
        this.renderPrompts();
        document.getElementById('ai-prompt-picker').style.display = 'block';
        document.getElementById('picker-search').focus();
      }
    } catch (error) {
      console.error('Failed to show prompt picker:', error);
    }
  }
  
  hidePromptPicker() {
    document.getElementById('ai-prompt-picker').style.display = 'none';
  }
  
  renderPrompts(filter = '') {
    const promptsContainer = document.getElementById('picker-prompts');
    let filteredPrompts = this.prompts;
    
    if (filter) {
      const searchTerm = filter.toLowerCase();
      filteredPrompts = this.prompts.filter(p => 
        p.title.toLowerCase().includes(searchTerm) || 
        p.content.toLowerCase().includes(searchTerm)
      );
    }
    
    if (filteredPrompts.length === 0) {
      promptsContainer.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #6b7280;">
          <h4 style="margin: 0 0 8px 0;">No prompts found</h4>
          <p style="margin: 0; font-size: 14px;">Try adjusting your search terms.</p>
        </div>
      `;
      return;
    }
    
    promptsContainer.innerHTML = filteredPrompts.map(prompt => `
      <div class="picker-prompt-item" data-prompt-id="${prompt.id}" style="
        padding: 12px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
      " onmouseover="this.style.background='#f9fafb'; this.style.borderColor='#3b82f6';" 
         onmouseout="this.style.background='white'; this.style.borderColor='#e5e7eb';">
        <div style="font-weight: 600; margin-bottom: 4px; color: #1f2937;">${this.escapeHtml(prompt.title)}</div>
        <div style="font-size: 12px; color: #6b7280; line-height: 1.4; margin-bottom: 6px;">${this.escapeHtml(this.truncate(prompt.content, 100))}</div>
        <span style="
          background: #f3f4f6;
          color: #374151;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 500;
        ">${prompt.category}</span>
      </div>
    `).join('');
  }
  
  filterPrompts(searchTerm) {
    this.renderPrompts(searchTerm);
  }
  
  async selectPrompt(promptId) {
    const prompt = this.prompts.find(p => p.id === promptId);
    if (!prompt) return;
    
    this.hidePromptPicker();
    await this.injectPrompt(prompt);
  }
  
  async injectPrompt(prompt) {
    const hasVariables = /\{\{[^}]+\}\}/.test(prompt.content);
    
    let finalPrompt;
    if (hasVariables) {
      // Create instruction for AI to handle variables
      finalPrompt = this.createVariablePrompt(prompt.content);
    } else {
      finalPrompt = prompt.content;
    }
    
    // Try to inject into focused field first
    const injectedIntoFocusedField = await this.injectIntoFocusedField(finalPrompt);
    
    // If focused field injection failed, fall back to platform-specific injection
    if (!injectedIntoFocusedField) {
      console.log('Focused field injection failed, falling back to platform-specific injection');
      await this.insertIntoChat(finalPrompt);
    }
  }
  
  createVariablePrompt(originalPrompt) {
    return `I'd like you to help me with this prompt. As you work through it, please ask me for any values in double braces like {{variable}} before continuing:

${originalPrompt}`;
  }

  async injectIntoFocusedField(text) {
    const focusedField = this.detectFocusedField();
    
    if (!focusedField) {
      console.log('No focused field found for injection');
      return false;
    }

    console.log('Injecting into focused field:', focusedField);
    
    try {
      // Focus the field
      focusedField.focus();
      
      // Handle different types of input fields
      if (focusedField.tagName.toLowerCase() === 'textarea' || 
          focusedField.tagName.toLowerCase() === 'input') {
        // Standard input/textarea
        const currentValue = focusedField.value || '';
        const newValue = currentValue + (currentValue ? '\n\n' : '') + text;
        
        focusedField.value = newValue;
        
        // Position cursor at end
        focusedField.setSelectionRange(newValue.length, newValue.length);
        
        // Trigger events to notify the page
        focusedField.dispatchEvent(new Event('input', {bubbles: true}));
        focusedField.dispatchEvent(new Event('change', {bubbles: true}));
      } else if (focusedField.contentEditable === 'true' || 
                 focusedField.getAttribute('role') === 'textbox') {
        // Contenteditable div
        const currentText = focusedField.textContent || '';
        const newText = currentText + (currentText ? '\n\n' : '') + text;
        
        focusedField.textContent = newText;
        
        // Position cursor at end
        const range = document.createRange();
        const selection = window.getSelection();
        range.selectNodeContents(focusedField);
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Trigger events
        focusedField.dispatchEvent(new Event('input', {bubbles: true}));
        focusedField.dispatchEvent(new Event('change', {bubbles: true}));
      }
      
      console.log('Successfully injected text into focused field');
      return true;
    } catch (error) {
      console.error('Failed to inject into focused field:', error);
      return false;
    }
  }
  
  async insertIntoChat(text) {
    const textInput = this.findTextInput();
    if (!textInput) {
      console.error('Could not find text input');
      return;
    }
    
    // Different approaches for different platforms
    if (this.platform === 'chatgpt') {
      await this.insertIntoChatGPT(textInput, text);
    } else if (this.platform === 'claude') {
      await this.insertIntoClaude(textInput, text);
    }
  }
  
  findTextInput() {
    // ChatGPT selectors
    let input = document.querySelector('textarea[placeholder*="Message"]') ||
                document.querySelector('textarea[data-id*="root"]') ||
                document.querySelector('#prompt-textarea') ||
                document.querySelector('textarea');
    
    // Claude selectors
    if (!input) {
      input = document.querySelector('div[contenteditable="true"]') ||
              document.querySelector('[data-testid="chat-input"]');
    }
    
    return input;
  }
  
  async insertIntoChatGPT(input, text) {
    // Set focus
    input.focus();
    
    // Clear existing content
    input.value = '';
    
    // Insert text
    input.value = text;
    
    // Trigger input events
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
    
    // Auto-focus and position cursor at end
    input.setSelectionRange(text.length, text.length);
  }
  
  async insertIntoClaude(input, text) {
    // Set focus
    input.focus();
    
    if (input.tagName === 'DIV') {
      // Contenteditable div
      input.innerHTML = '';
      input.textContent = text;
      
      // Place cursor at end
      const range = document.createRange();
      const selection = window.getSelection();
      range.selectNodeContents(input);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    } else {
      // Textarea
      input.value = text;
      input.setSelectionRange(text.length, text.length);
    }
    
    // Trigger events
    input.dispatchEvent(new Event('input', {bubbles: true}));
    input.dispatchEvent(new Event('change', {bubbles: true}));
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
  document.addEventListener('DOMContentLoaded', () => new ContentManager());
} else {
  new ContentManager();
}