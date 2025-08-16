# 🐚 JSH - JavaScript Shell ✨

A next-generation shell with JavaScript pipe functionality, built with [Ink](https://github.com/vadimdemedes/ink) (React for CLI) and TypeScript.

## 🌟 Features

### 🚀 **JavaScript Pipe Engine** - Core Feature
- 📊 **JSON Processing** - `curl api.github.com/users/octocat | js 'JSON.parse($)' | js '({name: $.name, repos: $.public_repos})'`
- 🔄 **Array Operations** - `ls -la | js '$.split("\n")' | js '$.filter(line => line.includes("json"))'`
- 📦 **NPM Package Support** - `echo "hello world" | npm:chalk red | npm:figlet`
- ⚡ **Async Processing** - `cat urls.txt | js '$.split("\n")' | js 'Promise.all($.map(url => fetch(url).then(r => r.json())))'`

### 🎨 **Interactive Shell Experience**
- 🎨 **Interactive UI** - Built with React components using Ink
- ⚡ **Shell-Like Experience** - Enter creates new prompts like real shells
- 📚 **Command History** - Navigate through previous commands with arrow keys
- 💭 **ZSH-Style Autosuggestions** - Gray text suggestions with fuzzy matching
- 🎯 **Tab Completion** - Interactive completion menu with visual selection
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
Experience JavaScript pipes and autosuggestions! Try:
- `echo '{"name":"world"}' | js 'JSON.parse($)' | js '"Hello " + $.name'`
- `ls | js '$.split("\n").filter(f => f.includes("src"))'`
- Type `npm i` and see autosuggestions
- Use Tab for completion and → to accept suggestions

### Running Tests
```bash
npm test
```

## 📖 Built-in Commands

### 🚀 **JavaScript Commands**
- `js 'expression'` - Execute JavaScript with piped input as `$`
- `npm:package method` - Use NPM packages in pipelines

### 🛠️ **Shell Commands**
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
- `Enter` - Execute command and show new prompt (like real shells!)
- `Enter` (empty) - Show new prompt line
- `↑/↓` - Navigate command history
- `→` - Accept autosuggestion (when suggestion is visible)
- `Ctrl+C` - Interrupt current command / Clear input
- `Ctrl+D` - Exit shell (in PTY mode)

### ZSH-Style Tab Completion 🎯
- `Tab` - Show completions / Select next completion
- `Shift+Tab` - Select previous completion  
- `↑/↓` - Navigate through completions (when menu is active)
- `Enter` - Confirm selected completion
- `Esc` - Cancel completion and restore original input
- Any character input - Cancel completion and continue typing

**Smart Completion Behavior:**
- Preserves your typed input and appends the completion
- Example: typing `cd /tm` + Tab → `cd /tmp/` (preserves "cd /tm", adds "p/")
- No more annoying full replacement of your input!

## 🏗️ Architecture

- **Components** (`src/components/`) - React/Ink UI components
- **Modules** (`src/modules/`) - Core shell functionality
- **Types** (`src/types/`) - TypeScript type definitions
- **Tests** (`src/__tests__/`) - Test suite

### Core Modules

- `JSPipeEngine` - JavaScript execution engine with VM contexts
- `AutoSuggestion` - Fuzzy matching and command suggestions
- `CommandExecutor` - External command execution
- `BuiltinCommands` - Built-in shell commands
- `PipelineManager` - Command pipeline processing
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

JSH works on:
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