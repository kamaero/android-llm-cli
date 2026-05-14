# Android LLM CLI

> Professional terminal-based LLM interface optimized for Android/Termux with advanced UX features

[![npm version](https://badge.fury.io/js/android-llm-cli.svg)](https://www.npmjs.com/package/android-llm-cli)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A sophisticated command-line interface for interacting with Large Language Models, specifically designed and optimized for Android devices running Termux. Features a modern terminal UI with responsive design, animations, and mobile-first optimizations.

![Demo](https://via.placeholder.com/800x400/1e1e1e/00ff00?text=Android+LLM+CLI+Demo)

## ✨ Features

### 🎯 **Core Functionality**
- **Multi-Provider Support** - Claude (Anthropic), GPT (OpenAI), and more
- **Intelligent Streaming** - Smooth text rendering with batching system
- **Tool Integration** - File operations, web search, code execution
- **Session Management** - Persistent conversations with analytics

### 📱 **Mobile Optimized**
- **Termux Ready** - Zero-gap layout optimized for virtual keyboards
- **Responsive Design** - Adapts to different terminal sizes (40-160+ columns)
- **Touch-Friendly** - Keyboard shortcuts designed for mobile workflows
- **Battery Efficient** - Optimized rendering to reduce CPU usage

### 🎨 **Advanced UX**
- **5 Display Modes** - Normal, Reading, Compact, Debug, Focus
- **Live Analytics** - Real-time cost, token, and performance monitoring
- **Smart Search** - Full-text search with regex support
- **Rich Animations** - Typewriter effects, progress indicators, transitions
- **Context Menus** - Quick actions and export functionality

### 🛠 **Developer Features**
- **TypeScript** - Full type safety and intellisense
- **Extensible** - Plugin architecture for custom tools
- **Testing** - Comprehensive test suite with CI/CD
- **Themes** - 5 built-in themes (Default, Nord, Dracula, Monokai, Cyberpunk)

## 📦 Installation

### **Global Installation (Recommended)**
```bash
npm install -g android-llm-cli
```

### **Termux (Android) Setup**
```bash
# Update Termux packages
pkg update && pkg upgrade

# Install Node.js
pkg install nodejs-lts

# Install the CLI
npm install -g android-llm-cli

# Run setup wizard
a-llmcli setup
```

### **Local Installation**
```bash
npm install android-llm-cli
npx android-llm-cli
```

## 🚀 Quick Start

### **1. Initial Setup**
```bash
# Interactive configuration wizard
a-llmcli setup
```

### **2. Basic Usage**
```bash
# Start chatting
a-llmcli

# Use specific mode
a-llmcli --mode agent

# Mock mode (no API keys needed)
a-llmcli --mock
```

### **3. Configuration**
The CLI will create a config file at:
- **Linux/Mac:** `~/.config/android-llm-cli/config.yaml`
- **Termux:** `~/.config/android-llm-cli/config.yaml`

Example config:
```yaml
provider: anthropic
model: claude-3-sonnet-20240229
mode: chat
security: normal
apiKeys:
  anthropic: "your-api-key"
```

## ⌨️ Keyboard Shortcuts

### **Global Shortcuts**
| Shortcut | Action |
|----------|--------|
| `Ctrl+F` | Search messages |
| `Ctrl+D` | Toggle detailed status |
| `Ctrl+Space` | Open quick actions |
| `Ctrl+H` | Help system |
| `1-5` | Switch display modes |

### **Input Shortcuts**
| Shortcut | Action |
|----------|--------|
| `↑/↓` | Navigate command history |
| `Tab` | Autocomplete slash commands |
| `Shift+Enter` | Multi-line input |
| `Enter` | Send message |

### **Display Modes**
| Key | Mode | Description |
|-----|------|-------------|
| `1` | Normal | Standard view with all features |
| `2` | Reading | Clean view focused on content |
| `3` | Compact | Compressed view for small screens |
| `4` | Debug | Full details for debugging |
| `5` | Focus | Distraction-free writing |

## 🔧 Advanced Usage

### **Slash Commands**
```bash
/help          # Show help system
/search query  # Web search
/clear         # Clear conversation
/model         # Change AI model
/theme         # Switch themes
/security      # Security settings
```

### **Export Options**
- **Markdown** - For documentation
- **JSON** - For data processing
- **Text** - For simple sharing

### **Cost Monitoring**
Real-time cost estimation with alerts:
- Token usage tracking
- Provider-specific pricing
- Session analytics
- Budget warnings

## 📱 Termux Optimization

### **Storage Setup**
```bash
# Allow storage access
termux-setup-storage

# Create config directory
mkdir -p ~/.config/android-llm-cli
```

### **Performance Tips**
- Use **Compact mode** (`3`) for small screens
- Enable **Focus mode** (`5`) for better battery life
- Use **Reading mode** (`2`) for long conversations

### **Virtual Keyboard**
The UI is optimized for Termux virtual keyboard with:
- Minimal bottom padding
- Quick access shortcuts
- Touch-friendly interface

## 🔒 Security Features

### **Security Modes**
- **Normal** - Standard safety checks
- **Hardcore** - Maximum security, all tools require confirmation

### **Sensitive Data Protection**
- API keys encrypted at rest
- No data logging by default
- Secure tool execution sandboxing

## 🎨 Customization

### **Themes**
```bash
# Switch theme via command
a-llmcli --theme nord

# Or use interactive selector
/theme
```

Available themes:
- **Default** - Clean blue/gray
- **Nord** - Arctic color palette
- **Dracula** - Dark purple theme
- **Monokai** - Sublime Text colors
- **Cyberpunk** - Neon green/pink

## 🔍 Troubleshooting

### **Common Issues**

**Screen flickering during streaming:**
```bash
# Already fixed in v1.0.0+
npm update -g android-llm-cli
```

**Permission errors:**
```bash
# Check Node.js permissions
npm config get prefix
npm config set prefix ~/.local
```

**API key issues:**
```bash
# Reconfigure
a-llmcli setup
```

### **Debug Mode**
```bash
# Enable debug output
a-llmcli --debug
```

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### **Development Setup**
```bash
git clone https://github.com/kamaero/android-llm-cli.git
cd android-llm-cli
npm install
npm run dev
```

## 📄 License

MIT © [Kam Aero](https://github.com/kamaero)

## 🌟 Acknowledgments

Built with:
- [Ink](https://github.com/vadimdemedes/ink) - React for CLI
- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Claude AI integration
- [OpenAI SDK](https://github.com/openai/openai-node) - GPT integration

Special thanks to the Termux community for inspiration and testing.

---

**Ready to experience AI in your terminal? Install now and start chatting!** 🚀

```bash
npm install -g android-llm-cli
a-llmcli setup
```