// Shared configuration for PromptDex extension
const PROMPTDEX_CONFIG = {
  // Supported AI platforms and their domains
  platforms: {
    chatgpt: {
      name: 'ChatGPT',
      domains: [
        'https://chat.openai.com/*',
        'https://chatgpt.com/*'
      ],
      urls: [
        'chat.openai.com',
        'chatgpt.com'
      ]
    },
    claude: {
      name: 'Claude',
      domains: [
        'https://claude.ai/*'
      ],
      urls: [
        'claude.ai'
      ]
    }
  },

  // Get all domains for manifest permissions
  getAllDomains() {
    const domains = [];
    Object.values(this.platforms).forEach(platform => {
      domains.push(...platform.domains);
    });
    return domains;
  },

  // Get all URLs for checking if tab is AI platform
  getAllUrls() {
    const urls = [];
    Object.values(this.platforms).forEach(platform => {
      urls.push(...platform.urls);
    });
    return urls;
  },

  // Check if URL belongs to any supported platform
  isAIUrl(url) {
    if (!url) return false;
    return this.getAllUrls().some(domain => url.includes(domain));
  },

  // Detect platform from URL
  detectPlatform(url) {
    if (!url) return 'unknown';
    
    for (const [platformKey, platform] of Object.entries(this.platforms)) {
      if (platform.urls.some(domain => url.includes(domain))) {
        return platformKey;
      }
    }
    return 'unknown';
  },

  // Get human-readable platform names for error messages
  getPlatformNames() {
    return Object.values(this.platforms).map(p => p.name).join(' or ');
  },

  // Get platform URLs for error messages
  getPlatformUrls() {
    const urls = [];
    Object.values(this.platforms).forEach(platform => {
      urls.push(`${platform.name} (${platform.urls.join(' or ')})`);
    });
    return urls.join(' or ');
  },

  // Get all platform URLs as a simple string for error messages
  getAllPlatformUrls() {
    return this.getAllUrls().join(' or ');
  }
};

// Export for use in different contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PROMPTDEX_CONFIG;
}
if (typeof window !== 'undefined') {
  window.PROMPTDEX_CONFIG = PROMPTDEX_CONFIG;
}