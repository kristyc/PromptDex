# PromptDex

Your personal prompt library - save, organize, and deploy AI prompts instantly.

## Features

- 💾 **Local storage** - Fast, reliable prompt storage with JSON backup/restore
- 🗂️ **Custom categories** - Create and manage your own organization system
- 🔤 **Variable support** - Use `{{variable}}` syntax for dynamic prompts
- ⌨️ **Floating picker** - Press `Ctrl+Shift+P` on AI platforms for instant access
- 🎯 **Smart injection** - AI asks for variables naturally during execution
- 📱 **Cross-platform** - Works on ChatGPT and Claude
- 🖱️ **Right-click save** - Highlight text anywhere and save as prompt
- 📤 **Backup & restore** - Export/import your prompts as JSON files

## Quick Start

1. **Install Extension** - Load in Chrome developer mode
2. **Start Saving Prompts** - Right-click selected text or use "Add Prompt"
3. **Use on AI Sites** - Press `Ctrl+Shift+P` on ChatGPT/Claude
4. **Backup Regularly** - Use Settings → Export to save your prompts

## Setup Instructions

### 1. Install Extension
1. Download or clone this repository
2. Go to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `promptdex` folder

### 2. Start Using PromptDex

**Save Prompts:**
- Right-click any selected text → "Save to PromptDex"
- Click "Add Prompt" in the extension popup
- Assign custom categories and use variables like `{{topic}}`

**Use Prompts:**
- On ChatGPT or Claude, press `Ctrl+Shift+P`
- Select your prompt from the floating dark-themed picker
- AI will naturally ask for any `{{variables}}` needed

**Manage & Backup:**
- Click ⚙️ Settings to export/import your prompt library
- Edit categories with the ✏️ icon beside the dropdown
- Search and filter prompts by category

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

### ⚙️ Easy Management
- Intuitive category management with visual editor
- Custom categories with add/edit/delete functionality
- Smart orphan handling when categories are deleted
- One-click backup and restore via JSON files

### 🖱️ Right-Click Integration
- Highlight any text on any webpage
- Right-click → "Save to PromptDex"
- Auto-generates smart titles
- Manual category assignment
- Instant desktop notifications

### 🚀 Smart Prompt Injection
- Natural variable handling via floating picker
- AI asks for variables conversationally
- Works seamlessly on ChatGPT and Claude
- Embedded directly in AI pages for reliability

### 📁 Flexible Organization
- **Custom Categories**: Create unlimited categories to fit your workflow
- **Built-in Categories**: Writing, Coding, Analysis, Communication, Creative, Business, Education
- **Category Management**: Full CRUD operations with visual editor
- **Smart Migration**: Deleted categories move prompts to "uncategorised"

## File Structure

```
promptdex/
├── manifest.json           # Extension manifest
├── popup/
│   ├── popup.html          # Main interface with settings
│   └── popup.js            # UI logic & category management
├── background/
│   └── simple-background.js # Context menus only
├── content/
│   └── embedded-promptdex.js # Floating picker integration
├── lib/
│   └── config.js           # Shared platform configuration
├── icons/                  # Extension icons
└── README.md               # This file
```

## Privacy & Security

- **Local storage**: All data stored locally in browser extension storage
- **No cloud dependencies**: Zero external services or APIs required
- **JSON backups**: Export/import your data anytime for portability
- **Open source**: Full code transparency and audit-friendly

## Development

The extension uses:
- **Manifest V3** for modern Chrome compatibility
- **Chrome Storage API** for reliable local persistence
- **Direct page embedding** for robust AI platform integration
- **Context menus** for right-click functionality
- **JSON export/import** for data portability

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