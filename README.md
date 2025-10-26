# PromptDex

Your personal prompt library - save, organize, and deploy AI prompts instantly.

## Features

- 🔗 **Google Drive sync** - Store prompts securely in your Google Drive
- 🏷️ **Auto-categorization** - Automatically categorize prompts by content
- 🔤 **Variable support** - Use `{{variable}}` syntax for dynamic prompts
- ⌨️ **Keyboard shortcuts** - Press `Ctrl+Shift+P` on AI platforms
- 🎯 **Smart injection** - AI asks for variables naturally during execution
- 📱 **Cross-platform** - Works on ChatGPT and Claude
- 🖱️ **Right-click save** - Highlight text anywhere and save as prompt
- 🧙‍♂️ **Setup wizard** - Non-techie friendly guided setup

## Quick Start

1. **Install Extension** - Load in Chrome developer mode
2. **Follow Setup Wizard** - Click ⚙️ and follow 4 simple steps
3. **Start Saving Prompts** - Right-click selected text or use "Add Prompt"
4. **Use on AI Sites** - Press `Ctrl+Shift+P` on ChatGPT/Claude

## Setup Instructions

### 1. Install Extension
1. Download or clone this repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `promptdex` folder

### 2. Complete Setup Wizard
The extension includes a guided setup wizard that takes you through:

1. **Create Google Project** - Direct link to Google Cloud Console
2. **Enable Drive API** - One-click enable for your project  
3. **Create OAuth Credentials** - Step-by-step credential creation
4. **Enter Client ID** - Paste and test your credentials

Each step includes direct links to the exact pages you need!

### 3. Start Using PromptDex

**Save Prompts:**
- Right-click any selected text → "Save to PromptDex"
- Click "Add Prompt" in the extension popup
- Both methods auto-categorize and sync to Google Drive

**Use Prompts:**
- On ChatGPT or Claude, press `Ctrl+Shift+P`
- Select your prompt from the dark-themed picker
- AI will naturally ask for any `{{variables}}` needed

## Example Prompts

```
Write a {{length}} blog post about {{topic}} for {{audience}}. 
Make the tone {{tone}} and include 3 actionable tips.
```

```
Debug this {{language}} code: {{code}}. 
Explain what's wrong and provide the corrected version.
```

```
Create a {{type}} for {{project_name}} that covers {{requirements}}. 
Format it professionally for {{stakeholder_type}}.
```

## Features in Detail

### 🎨 Beautiful Dark UI
- Modern dark theme with gradient accents
- Smooth animations and hover effects
- Professional status indicators
- Clean, intuitive interface

### 🧙‍♂️ Non-Techie Friendly
- Step-by-step setup wizard with direct links
- Copy buttons for complex URLs
- Progress tracking with visual indicators
- Helpful tooltips and guidance

### 🖱️ Right-Click Integration
- Highlight any text on any webpage
- Right-click → "Save to PromptDex"
- Auto-generates smart titles
- Auto-categorizes content
- Instant desktop notifications

### 🚀 Smart Prompt Injection
- Natural variable handling
- AI asks for variables conversationally
- Works seamlessly on ChatGPT and Claude
- Keyboard shortcut for quick access

### 📁 Auto-Organization
- **Writing**: Blog posts, articles, emails
- **Coding**: Debug, functions, code review  
- **Analysis**: Data analysis, research
- **Communication**: Messages, letters
- **General**: Everything else

## File Structure

```
promptdex/
├── manifest.json           # Extension manifest
├── popup/
│   ├── popup.html          # Main interface
│   └── popup.js            # UI logic & setup wizard
├── background/
│   └── background.js       # Service worker & context menus
├── content/
│   └── content.js          # ChatGPT/Claude integration
└── README.md               # This file
```

## Privacy & Security

- **Your data stays yours**: Prompts stored in your personal Google Drive
- **App data folder**: Hidden from normal Drive browsing
- **No third-party servers**: Direct Google Drive integration
- **Open source**: Full code transparency

## Development

The extension uses:
- **Manifest V3** for modern Chrome compatibility
- **Chrome Identity API** for secure Google authentication
- **Google Drive API** for cloud storage
- **Content scripts** for seamless AI platform integration
- **Context menus** for right-click functionality

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to use and modify as needed.

---

**PromptDex** - Your AI prompts, organized and ready when you need them. 🚀