const fs = require('fs');
const path = require('path');
const config = require('../lib/config.js');

// Base manifest template
const manifestTemplate = {
  "manifest_version": 3,
  "name": "PromptDex",
  "version": "1.0.0",
  "description": "Your personal prompt library - save, organize, and deploy AI prompts instantly",
  
  "permissions": [
    "storage",
    "activeTab",
    "contextMenus",
    "notifications"
  ],
  
  "host_permissions": [], // Will be populated from config
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "action": {
    "default_popup": "popup/popup.html",
    "default_title": "PromptDex",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "background": {
    "service_worker": "background/background.js"
  },
  
  "content_scripts": [
    {
      "matches": [], // Will be populated from config
      "js": ["lib/config.js", "content/content.js"],
      "run_at": "document_idle"
    }
  ],
  
  "commands": {
    "open-prompt-picker": {
      "suggested_key": {
        "default": "Ctrl+Shift+P"
      },
      "description": "Open prompt picker"
    }
  },
  
  "web_accessible_resources": [
    {
      "resources": ["lib/*"],
      "matches": [] // Will be populated from config
    }
  ]
};

// Populate domains from config
const domains = config.getAllDomains();
manifestTemplate.host_permissions = domains;
manifestTemplate.content_scripts[0].matches = domains;
manifestTemplate.web_accessible_resources[0].matches = domains;

// Write manifest.json
const manifestPath = path.join(__dirname, '..', 'manifest.json');
fs.writeFileSync(manifestPath, JSON.stringify(manifestTemplate, null, 2));

console.log('✅ Generated manifest.json with domains:', domains);
console.log('📁 Manifest written to:', manifestPath);