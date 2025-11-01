// Simplified PromptDex Background Script
// Only handles context menu for saving selected text

class SimpleBackground {
  constructor() {
    this.isVivaldi = this.detectVivaldi();
    this.init();
  }

  detectVivaldi() {
    try {
      // Check if we can detect Vivaldi from background context
      // In Vivaldi, chrome.action.openPopup often fails from background scripts
      return navigator.userAgent.includes('Vivaldi') || 
             (typeof window !== 'undefined' && window.vivaldi !== undefined);
    } catch (error) {
      // In service worker context, navigator might not be available
      return false;
    }
  }

  init() {
    this.setupContextMenus();
    this.setupSidePanel();
    this.setupKeyboardShortcuts();
    this.setupMessageHandlers();
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

  setupSidePanel() {
    try {
      console.log('Setting up side panel...');
      
      // First, ensure the side panel exists and is enabled
      chrome.sidePanel.setOptions({
        path: 'sidebar/sidebar.html',
        enabled: true
      }).then(() => {
        console.log('Side panel options set successfully');
        
        // Then set up the behavior to open on action click
        return chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
      }).then(() => {
        console.log('Side panel behavior set successfully');
      }).catch((error) => {
        console.error('Error in side panel setup:', error);
      });

      // Handle action clicks (backup in case setPanelBehavior doesn't work)
      chrome.action.onClicked.addListener(async (tab) => {
        try {
          console.log('Extension icon clicked, opening side panel for window:', tab.windowId);
          await chrome.sidePanel.open({ windowId: tab.windowId });
          console.log('Side panel opened successfully');
        } catch (error) {
          console.error('Error opening side panel:', error);
          // Fallback: show notification
          this.showNotification('Unable to open sidebar. Please try reloading the extension.', 'error');
        }
      });

      console.log('Side panel setup complete');
    } catch (error) {
      console.error('Error setting up side panel:', error);
    }
  }

  setupKeyboardShortcuts() {
    try {
      console.log('Setting up keyboard shortcuts...');
      
      chrome.commands.onCommand.addListener(async (command) => {
        console.log('Keyboard command received:', command);
        
        if (command === 'open-prompt-picker') {
          // Get the current active tab
          const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
          
          if (tab) {
            try {
              // Send message to content script to open prompt picker
              await chrome.tabs.sendMessage(tab.id, {
                action: 'openPromptPicker'
              });
              console.log('Prompt picker opened via keyboard shortcut');
            } catch (error) {
              console.log('Content script not available, opening sidebar instead');
              // Fallback: open sidebar if content script not available
              try {
                await chrome.sidePanel.open({ windowId: tab.windowId });
                this.showNotification('Prompt picker opened in sidebar', 'info');
              } catch (sidebarError) {
                console.error('Failed to open sidebar:', sidebarError);
                this.showNotification('Unable to open prompt picker. Try reloading the page.', 'error');
              }
            }
          }
        }
      });
      
      console.log('Keyboard shortcuts setup complete');
    } catch (error) {
      console.error('Error setting up keyboard shortcuts:', error);
    }
  }

  setupMessageHandlers() {
    try {
      console.log('Setting up message handlers...');
      
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('Background received message:', request);
        
        if (request.action === 'loadPrompts') {
          this.handleLoadPrompts(sendResponse);
          return true; // Keep message channel open for async response
        }
        
        return false;
      });
      
      console.log('Message handlers setup complete');
    } catch (error) {
      console.error('Error setting up message handlers:', error);
    }
  }

  async handleLoadPrompts(sendResponse) {
    try {
      // Load prompts from storage
      const result = await chrome.storage.local.get(['localPrompts']);
      const prompts = result.localPrompts || [];
      
      console.log('Loaded prompts for picker:', prompts.length);
      sendResponse({
        success: true,
        prompts: prompts
      });
    } catch (error) {
      console.error('Failed to load prompts:', error);
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }

  async handleSaveSelectedText(selectedText, tab) {
    try {
      console.log('Preparing selected text for prompt creation:', selectedText);
      
      // Convert old variable formats automatically
      const convertedContent = this.convertVariableFormats(selectedText.trim());
      
      // Generate auto-filled values
      const suggestedTitle = this.generateTitleFromText(convertedContent);
      const suggestedCategory = this.categorizePrompt(convertedContent);
      
      // Store the data for the popup to use
      const promptData = {
        content: convertedContent,
        title: suggestedTitle,
        category: suggestedCategory,
        fromRightClick: true
      };
      
      // Store in chrome.storage so sidebar can access it
      await chrome.storage.local.set({pendingRightClickPrompt: promptData});
      
      // Try to open the sidebar with the prepared data
      try {
        await chrome.sidePanel.open({ windowId: tab.windowId });
        console.log('Successfully opened sidebar with prepared prompt data');
        this.showNotification('✅ Text saved! Sidebar opened with your prompt.', 'success');
      } catch (error) {
        console.log('Sidebar opening failed:', error.message);
        // Fallback notification
        this.showNotification('✅ Text saved! Click the PromptDex icon to open sidebar and add it as a prompt.', 'info');
      }
      
      console.log('Prepared right-click prompt data for popup');
    } catch (error) {
      console.error('Failed to prepare selected text:', error);
      this.showNotification('Failed to prepare prompt', 'error');
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
      
      // Replace variables with [variable] for cleaner titles
      title = title.replace(/{[^}]+}/g, '[variable]');
      
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

  convertVariableFormats(content) {
    try {
      // Check for old variable formats and convert automatically
      let convertedContent = content;
      let hasConversions = false;
      
      // Convert {{variable}} to {variable}
      if (/\{\{[^}]+\}\}/.test(convertedContent)) {
        convertedContent = convertedContent.replace(/\{\{([^}]+)\}\}/g, '{$1}');
        hasConversions = true;
      }
      
      // Convert var[variable] to {variable}
      if (/var\[[^\]]+\]/gi.test(convertedContent)) {
        convertedContent = convertedContent.replace(/var\[([^\]]+)\]/gi, '{$1}');
        hasConversions = true;
      }
      
      // Convert <variable> to {variable}
      if (/<[^>]+>/.test(convertedContent)) {
        convertedContent = convertedContent.replace(/<([^>]+)>/g, '{$1}');
        hasConversions = true;
      }
      
      // Convert [variable] to {variable} only if it contains a single value
      if (/\[[^\]]+\]/.test(convertedContent)) {
        convertedContent = convertedContent.replace(/\[([^\]]+)\]/g, (match, content) => {
          // Check if content contains multiple values (comma, slash, pipe, or)
          const hasMultipleValues = /[,\/\|]|(\s+or\s+)|(\s+and\s+)/.test(content.trim());
          
          if (!hasMultipleValues && /^[a-zA-Z_][a-zA-Z0-9_\s]*$/.test(content.trim())) {
            // Single variable - convert to {variable}
            hasConversions = true;
            return `{${content.trim()}}`;
          } else {
            // Multiple values or complex content - leave as [options]
            return match;
          }
        });
      }
      
      if (hasConversions) {
        console.log('Converted variable formats in right-click saved text');
      }
      
      return convertedContent;
    } catch (error) {
      console.error('Error converting variable formats:', error);
      return content;
    }
  }
}

console.log('PromptDex background script starting...');
new SimpleBackground();
console.log('PromptDex background script initialized');