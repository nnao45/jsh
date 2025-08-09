# 🐚 InkSh - Next-Generation Interactive Shell ✨

A modern, interactive shell built with [Ink](https://github.com/vadimdemedes/ink) (React for CLI) and TypeScript.

## 🌟 Features

- 🎨 **Interactive UI** - Built with React components using Ink
- 📚 **Command History** - Navigate through previous commands with arrow keys
- 🎯 **Tab Completion** - Smart completion for commands and file paths
- 💼 **Job Control** - Background/foreground job management
- 🔌 **PTY Support** - Full pseudoterminal integration
- 🛠️ **Built-in Commands** - Essential shell commands included
- 🏗️ **Modular Architecture** - Clean, extensible codebase
- 🌈 **Emoji Support** - Colorful and engaging interface

## 🚀 Quick Start

### Installation
```bash
npm install
npm run build
```

### Development
```bash
npm run dev
```

### Try the Demo
```bash
npm run demo
```
Experience ZSH-style tab completion! Try typing:
- `h` + Tab (help command)
- `ls` + Tab (list files)
- `src/` + Tab (browse directories)

### Running Tests
```bash
npm test
```

## 📖 Built-in Commands

- `help` - Show available commands
- `cd [directory]` - Change directory
- `pwd` - Print working directory
- `ls [options]` - List directory contents
- `mkdir [-p] directory` - Create directories
- `history` - Show command history
- `clear` - Clear screen
- `jobs` - List active jobs
- `kill [-SIGNAL] job_id` - Terminate jobs
- `bg [job_id]` - Resume job in background
- `fg [job_id]` - Resume job in foreground
- `pty [shell]` - Start interactive PTY mode
- `pty-list` - List PTY sessions
- `pty-kill session_id` - Kill PTY session
- `pty-switch session_id` - Switch PTY session
- `exit [code]` - Exit shell

## 🎮 Key Bindings

### Basic Navigation
- `↑/↓` - Navigate command history
- `Ctrl+C` - Interrupt current command
- `Ctrl+D` - Exit shell (in PTY mode)

### ZSH-Style Tab Completion 🎯
- `Tab` - Show completions / Select next completion
- `Shift+Tab` - Select previous completion  
- `↑/↓` - Navigate through completions (when menu is active)
- `Enter` - Confirm selected completion
- `Esc` - Cancel completion and restore original input
- Any character input - Cancel completion and continue typing

## 🏗️ Architecture

- **Components** (`src/components/`) - React/Ink UI components
- **Modules** (`src/modules/`) - Core shell functionality
- **Types** (`src/types/`) - TypeScript type definitions
- **Tests** (`src/__tests__/`) - Test suite

### Core Modules

- `CommandExecutor` - External command execution
- `BuiltinCommands` - Built-in shell commands
- `ProcessManager` - Job control and process management
- `PtyManager` - Pseudoterminal session management
- `TabCompletion` - Command and path completion

## 🛠️ Development

### Scripts
- `npm run build` - Compile TypeScript
- `npm run dev` - Development mode
- `npm test` - Run tests
- `npm run lint` - Lint code
- `npm run format` - Format code

### Technologies
- **Ink** - React for CLI applications
- **TypeScript** - Type-safe development
- **Vitest** - Fast testing framework
- **Node-pty** - Pseudoterminal bindings
- **Execa** - Process execution
- **ShellJS** - Cross-platform shell commands

## 🌐 Cross-Platform

InkSh works on:
- 🐧 Linux
- 🍎 macOS
- 🪟 Windows (with some limitations)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🙏 Acknowledgments

- [Ink](https://github.com/vadimdemedes/ink) - React renderer for CLI
- [Node-pty](https://github.com/microsoft/node-pty) - Pseudoterminal bindings
- [Execa](https://github.com/sindresorhus/execa) - Better child processes

---

**Made with ❤️ and lots of ☕**