class SimpleBackgroundManager {
  constructor() {
    this.init();
  }
  
  init() {
    this.setupCommandListeners();
    this.setupMessageListeners();
    this.setupContextMenus();
  }
  
  setupCommandListeners() {
    chrome.commands.onCommand.addListener((command) => {
      console.log('Command received:', command);
      if (command === 'open-prompt-picker') {
        this.handleOpenPromptPicker();
      }
    });
  }
  
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('Message received:', request);
      this.handleMessage(request, sender, sendResponse);
      return true; // Will respond asynchronously
    });
  }
  
  setupContextMenus() {
    try {
      // Remove existing context menu items to avoid duplicates
      chrome.contextMenus.removeAll(() => {
        console.log('Cleared existing context menus');
        
        // Create the context menu after clearing existing ones
        chrome.contextMenus.create({
          id: 'save-as-prompt',
          title: 'Save to PromptDex',
          contexts: ['selection']
        }, () => {
          // Check for errors
          if (chrome.runtime.lastError) {
            console.error('Context menu creation error:', chrome.runtime.lastError);
          } else {
            console.log('Context menu created successfully');
          }
        });
      });
      
      chrome.contextMenus.onClicked.addListener((info, tab) => {
        console.log('Context menu clicked:', info.menuItemId);
        if (info.menuItemId === 'save-as-prompt') {
          this.handleSaveSelectedText(info.selectionText, tab);
        }
      });
    } catch (error) {
      console.error('Error setting up context menus:', error);
    }
  }
  
  async handleSaveSelectedText(selectedText, tab) {
    try {
      console.log('Saving selected text:', selectedText);
      
      // Generate a title from the selected text
      const title = this.generateTitleFromText(selectedText);
      
      const newPrompt = {
        id: Date.now().toString(),
        title: title,
        content: selectedText.trim(),
        category: this.categorizePrompt(selectedText),
        createdAt: new Date().toISOString(),
        source: `Saved from ${tab.url}`
      };
      
      console.log('Created prompt:', newPrompt);
      
      const success = await this.saveToLocalStorage(newPrompt);
      
      if (success) {
        this.showNotification('Text saved as prompt!', 'success');
        console.log('Successfully saved prompt');
      } else {
        this.showNotification('Failed to save prompt', 'error');
        console.error('Failed to save prompt');
      }
    } catch (error) {
      console.error('Failed to save selected text:', error);
      this.showNotification('Failed to save prompt', 'error');
    }
  }
  
  generateTitleFromText(text) {
    try {
      // Extract first meaningful words as title
      const words = text.trim().split(/\s+/).slice(0, 6);
      let title = words.join(' ');
      
      // Remove common prompt starters
      title = title.replace(/^(please|can you|could you|help me|i need|i want)/i, '');
      title = title.trim();
      
      // Capitalize first letter
      title = title.charAt(0).toUpperCase() + title.slice(1);
      
      // Ensure it's not too long
      if (title.length > 50) {
        title = title.substring(0, 47) + '...';
      }
      
      return title || 'Custom Prompt';
    } catch (error) {
      console.error('Error generating title:', error);
      return 'Custom Prompt';
    }
  }
  
  categorizePrompt(content) {
    try {
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
    } catch (error) {
      console.error('Error categorizing prompt:', error);
      return 'general';
    }
  }
  
  showNotification(message, type) {
    try {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iMTIiIGZpbGw9IiM2MzY2ZjEiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHA+PC9wPgo8L3N2Zz4KPC9zdmc+',
        title: 'PromptDex',
        message: message
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }
  
  async handleOpenPromptPicker() {
    try {
      console.log('Opening prompt picker');
      const tabs = await chrome.tabs.query({active: true, currentWindow: true});
      const activeTab = tabs[0];
      
      if (this.isAITab(activeTab.url)) {
        await chrome.tabs.sendMessage(activeTab.id, {
          action: 'openPromptPicker'
        });
      } else {
        // Show popup if not on AI tab
        chrome.action.openPopup();
      }
    } catch (error) {
      console.error('Failed to handle shortcut:', error);
      // Fallback to popup
      chrome.action.openPopup();
    }
  }
  
  async handleMessage(request, sender, sendResponse) {
    try {
      console.log('Handling message:', request.action);
      
      switch (request.action) {
        case 'ping':
          sendResponse({success: true, message: 'pong'});
          break;
          
        default:
          console.log('Unknown action:', request.action);
          sendResponse({success: false, error: 'Unknown action'});
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({success: false, error: error.message});
    }
  }
  
  async saveToLocalStorage(newPrompt) {
    try {
      console.log('Saving to localStorage via chrome.storage.local');
      
      // Get existing prompts
      const result = await chrome.storage.local.get(['localPrompts']);
      const prompts = result.localPrompts || [];
      
      console.log('Current prompts count:', prompts.length);
      
      // Add new prompt
      prompts.push(newPrompt);
      
      console.log('New prompts count:', prompts.length);
      
      // Save back to storage
      await chrome.storage.local.set({localPrompts: prompts});
      
      console.log('Successfully saved to chrome.storage.local');
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }

  isAITab(url) {
    return url && (
      url.includes('chat.openai.com') || 
      url.includes('claude.ai')
    );
  }
}

console.log('Background script starting...');
new SimpleBackgroundManager();
console.log('Background script initialized');