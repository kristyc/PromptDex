class BackgroundManager {
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
      if (command === 'open-prompt-picker') {
        this.handleOpenPromptPicker();
      }
    });
  }
  
  setupMessageListeners() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Will respond asynchronously
    });
  }
  
  setupContextMenus() {
    // Remove existing context menu items to avoid duplicates
    chrome.contextMenus.removeAll(() => {
      // Create the context menu after clearing existing ones
      chrome.contextMenus.create({
        id: 'save-as-prompt',
        title: 'Save to PromptDex',
        contexts: ['selection']
      }, () => {
        // Check for errors
        if (chrome.runtime.lastError) {
          console.error('Context menu creation error:', chrome.runtime.lastError);
        }
      });
    });
    
    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'save-as-prompt') {
        this.handleSaveSelectedText(info.selectionText, tab);
      }
    });
  }
  
  async handleSaveSelectedText(selectedText, tab) {
    try {
      // Check storage type and settings
      const settings = await chrome.storage.local.get(['clientId', 'storageType']);
      const storageType = settings.storageType || 'local';
      
      // For Google Drive, check if setup is completed
      if (storageType === 'gdrive' && !settings.clientId) {
        // Open popup to guide user through setup
        chrome.action.openPopup();
        return;
      }
      
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
      
      let success = false;
      
      if (storageType === 'local') {
        // Save to localStorage
        success = await this.saveToLocalStorage(newPrompt);
      } else if (storageType === 'gdrive') {
        // Save to Google Drive
        success = await this.savePrompt(newPrompt, settings.clientId);
      }
      
      if (success) {
        this.showNotification('Text saved as prompt!', 'success');
      } else {
        this.showNotification('Failed to save prompt', 'error');
      }
    } catch (error) {
      console.error('Failed to save selected text:', error);
      this.showNotification('Failed to save prompt', 'error');
    }
  }
  
  generateTitleFromText(text) {
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
  
  showNotification(message, type) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDgiIGhlaWdodD0iNDgiIHZpZXdCb3g9IjAgMCA0OCA0OCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjQ4IiBoZWlnaHQ9IjQ4IiByeD0iMTIiIGZpbGw9IiM2MzY2ZjEiLz4KPHN2ZyB4PSIxMiIgeT0iMTIiIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIj4KPHA+PC9wPgo8L3N2Zz4KPC9zdmc+',
      title: 'PromptDex',
      message: message
    });
  }
  
  async handleOpenPromptPicker() {
    try {
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
      switch (request.action) {
        case 'checkAuth':
          const authStatus = await this.checkAuth(request.clientId);
          sendResponse(authStatus);
          break;
          
        case 'authenticate':
          const authResult = await this.authenticate(request.clientId);
          sendResponse(authResult);
          break;
          
        case 'disconnect':
          const disconnectResult = await this.disconnect();
          sendResponse(disconnectResult);
          break;
          
        case 'testConnection':
          const testResult = await this.testConnection(request.clientId);
          sendResponse(testResult);
          break;
          
        case 'loadPrompts':
          const prompts = await this.loadPrompts(request.clientId);
          sendResponse({success: true, prompts});
          break;
          
        case 'savePrompt':
          const saved = await this.savePrompt(request.prompt, request.clientId);
          sendResponse({success: saved});
          break;
          
        default:
          sendResponse({success: false, error: 'Unknown action'});
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({success: false, error: error.message});
    }
  }
  
  async checkAuth(clientId) {
    if (!clientId) {
      return {success: false, authenticated: false, error: 'No client ID provided'};
    }
    
    try {
      const token = await this.getAuthToken(false, clientId);
      return {success: true, authenticated: !!token};
    } catch (error) {
      console.error('Auth check error:', error);
      return {success: false, authenticated: false, error: error.message};
    }
  }
  
  async authenticate(clientId) {
    if (!clientId) {
      return {success: false, error: 'No client ID provided'};
    }
    
    try {
      const token = await this.getAuthToken(true, clientId);
      return {success: !!token, token};
    } catch (error) {
      console.error('Authentication error:', error);
      return {success: false, error: error.message};
    }
  }
  
  async disconnect() {
    try {
      // Get current token to revoke it
      const token = await chrome.identity.getAuthToken({interactive: false});
      if (token) {
        await chrome.identity.removeCachedAuthToken({token});
        // Also revoke the token server-side
        try {
          await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`, {
            method: 'POST'
          });
        } catch (revokeError) {
          console.warn('Failed to revoke token server-side:', revokeError);
        }
      }
      return {success: true};
    } catch (error) {
      console.error('Disconnect error:', error);
      return {success: false, error: error.message};
    }
  }
  
  async testConnection(clientId) {
    if (!clientId) {
      return {success: false, error: 'No client ID provided'};
    }
    
    try {
      // Test the connection by trying to get a token and make a simple API call
      const token = await this.getAuthToken(true, clientId);
      if (!token) {
        return {success: false, error: 'Failed to get auth token'};
      }
      
      // Test with a simple API call to verify the token works
      const response = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        return {success: true, user: data.user};
      } else {
        return {success: false, error: `API test failed: ${response.status} ${response.statusText}`};
      }
    } catch (error) {
      console.error('Test connection error:', error);
      return {success: false, error: error.message};
    }
  }
  
  async getAuthToken(interactive = false, clientId = null) {
    try {
      // If we have a clientId, we need to use the OAuth flow with Chrome Identity API
      if (clientId) {
        // Chrome Identity API doesn't support dynamic client IDs in manifest v3
        // We need to use the OAuth flow manually
        return await this.getTokenWithCustomClientId(interactive, clientId);
      } else {
        // Fallback to the old method (won't work without manifest oauth2 config)
        return await chrome.identity.getAuthToken({interactive});
      }
    } catch (error) {
      console.error('Auth token error:', error);
      return null;
    }
  }
  
  async getTokenWithCustomClientId(interactive, clientId) {
    if (!interactive) {
      // For non-interactive mode, check if we have a stored token
      const result = await chrome.storage.local.get(['accessToken', 'tokenExpiry']);
      if (result.accessToken && result.tokenExpiry && Date.now() < result.tokenExpiry) {
        return result.accessToken;
      }
      return null;
    }
    
    // For interactive mode, we need to redirect to OAuth
    const redirectUri = chrome.identity.getRedirectURL();
    const scope = 'https://www.googleapis.com/auth/drive.appdata';
    
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${clientId}&` +
      `response_type=token&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=${encodeURIComponent(scope)}`;
    
    try {
      const responseUrl = await chrome.identity.launchWebAuthFlow({
        url: authUrl,
        interactive: true
      });
      
      // Parse the token from the response URL
      const urlParams = new URL(responseUrl).hash.substring(1);
      const params = new URLSearchParams(urlParams);
      const accessToken = params.get('access_token');
      const expiresIn = parseInt(params.get('expires_in')) || 3600;
      
      if (accessToken) {
        // Store the token
        await chrome.storage.local.set({
          accessToken: accessToken,
          tokenExpiry: Date.now() + (expiresIn * 1000)
        });
        return accessToken;
      }
      
      throw new Error('No access token received');
    } catch (error) {
      console.error('OAuth flow error:', error);
      throw error;
    }
  }
  
  async loadPrompts(clientId) {
    try {
      const token = await this.getAuthToken(false, clientId);
      if (!token) return [];
      
      const fileContent = await this.getGDriveFile(token);
      return fileContent ? JSON.parse(fileContent) : [];
    } catch (error) {
      console.error('Failed to load prompts:', error);
      return [];
    }
  }
  
  async savePrompt(prompt, clientId) {
    try {
      const token = await this.getAuthToken(false, clientId);
      if (!token) return false;
      
      const prompts = await this.loadPrompts(clientId);
      const existingIndex = prompts.findIndex(p => p.id === prompt.id);
      
      if (existingIndex >= 0) {
        prompts[existingIndex] = prompt;
      } else {
        prompts.push(prompt);
      }
      
      return await this.saveGDriveFile(token, JSON.stringify(prompts, null, 2));
    } catch (error) {
      console.error('Failed to save prompt:', error);
      return false;
    }
  }
  
  async getGDriveFile(token) {
    try {
      // First, search for existing file
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='ai-prompts.json'&spaces=appDataFolder`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const searchData = await searchResponse.json();
      
      if (searchData.files && searchData.files.length > 0) {
        // File exists, download content
        const fileId = searchData.files[0].id;
        const downloadResponse = await fetch(
          `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        return await downloadResponse.text();
      }
      
      return null;
    } catch (error) {
      console.error('Failed to get GDrive file:', error);
      return null;
    }
  }
  
  async saveGDriveFile(token, content) {
    try {
      // Check if file exists
      const searchResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=name='ai-prompts.json'&spaces=appDataFolder`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      const searchData = await searchResponse.json();
      const fileExists = searchData.files && searchData.files.length > 0;
      
      if (fileExists) {
        // Update existing file
        const fileId = searchData.files[0].id;
        const response = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
          {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            body: content
          }
        );
        
        return response.ok;
      } else {
        // Create new file
        const metadata = {
          name: 'ai-prompts.json',
          parents: ['appDataFolder']
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', new Blob([content], {type: 'application/json'}));
        
        const response = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`
            },
            body: form
          }
        );
        
        return response.ok;
      }
    } catch (error) {
      console.error('Failed to save GDrive file:', error);
      return false;
    }
  }
  
  async saveToLocalStorage(newPrompt) {
    try {
      // Get existing prompts from localStorage via content script
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      
      // Use chrome.storage.local as a proxy for localStorage since background script can't access localStorage directly
      const result = await chrome.storage.local.get(['localPrompts']);
      const prompts = result.localPrompts || [];
      
      // Add new prompt
      prompts.push(newPrompt);
      
      // Save back to storage
      await chrome.storage.local.set({localPrompts: prompts});
      
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

new BackgroundManager();