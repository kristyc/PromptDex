// Simplified PromptDex Background Script
// Only handles context menu for saving selected text

class SimpleBackground {
  constructor() {
    this.init();
  }

  init() {
    this.setupContextMenus();
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
      
      const success = await this.saveToStorage(newPrompt);
      
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
        iconUrl: 'icons/icon48.png',
        title: 'PromptDex',
        message: message
      });
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  async saveToStorage(newPrompt) {
    try {
      console.log('Saving to chrome.storage.local');
      
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
      console.error('Failed to save to storage:', error);
      return false;
    }
  }
}

console.log('PromptDex background script starting...');
new SimpleBackground();
console.log('PromptDex background script initialized');