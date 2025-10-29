class ContentManager {
  constructor() {
    console.log('PromptDex content script initializing...');
    this.platform = this.detectPlatform();
    console.log('Detected platform:', this.platform);
    this.init();
    console.log('PromptDex content script ready');
  }
  
  init() {
    this.setupMessageListener();
    this.setupPromptPicker();
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
    
    await this.insertIntoChat(finalPrompt);
  }
  
  createVariablePrompt(originalPrompt) {
    return `I'd like you to help me with this prompt. As you work through it, please ask me for any values in double braces like {{variable}} before continuing:

${originalPrompt}`;
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