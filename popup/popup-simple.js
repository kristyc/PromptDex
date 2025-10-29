class SimplePopupManager {
  constructor() {
    this.prompts = [];
    this.currentCategory = 'all';
    this.init();
  }
  
  async init() {
    await this.loadPrompts();
    this.setupEventListeners();
    this.renderCategories();
    this.renderPrompts();
  }
  
  setupEventListeners() {
    document.getElementById('addPromptBtn').addEventListener('click', () => this.handleAddPrompt());
    document.getElementById('searchBox').addEventListener('input', (e) => this.handleSearch(e.target.value));
    
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
  
  async loadPrompts() {
    try {
      const stored = localStorage.getItem('promptdex_prompts');
      this.prompts = stored ? JSON.parse(stored) : [];
      console.log('Loaded prompts:', this.prompts.length);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      this.prompts = [];
    }
  }
  
  async savePrompts() {
    try {
      localStorage.setItem('promptdex_prompts', JSON.stringify(this.prompts));
      console.log('Saved prompts:', this.prompts.length);
      return true;
    } catch (error) {
      console.error('Failed to save prompts:', error);
      return false;
    }
  }
  
  async handleAddPrompt() {
    try {
      console.log('Starting handleAddPrompt');
      
      const title = prompt('Enter prompt title:');
      if (!title) {
        console.log('No title provided');
        return;
      }
      
      const content = prompt('Enter prompt content (use {{variable}} for variables):');
      if (!content) {
        console.log('No content provided');
        return;
      }
      
      const newPrompt = {
        id: Date.now().toString(),
        title: title.trim(),
        content: content.trim(),
        category: this.categorizePrompt(content),
        createdAt: new Date().toISOString()
      };
      
      console.log('Created prompt:', newPrompt);
      
      // Add to array
      this.prompts.push(newPrompt);
      console.log('Added to array, total prompts:', this.prompts.length);
      
      // Save to localStorage
      const saved = await this.savePrompts();
      console.log('Save result:', saved);
      
      if (saved) {
        this.renderCategories();
        this.renderPrompts();
        this.showNotification('Prompt saved successfully!', 'success');
      } else {
        // Remove from array if save failed
        this.prompts.pop();
        this.showNotification('Failed to save prompt', 'error');
      }
      
    } catch (error) {
      console.error('Error in handleAddPrompt:', error);
      this.showNotification('Error: ' + error.message, 'error');
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
      ${type === 'success' ? 'background: #059669;' : 
        type === 'error' ? 'background: #dc2626;' : 
        'background: #6366f1;'}
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
}

document.addEventListener('DOMContentLoaded', () => {
  new SimplePopupManager();
});