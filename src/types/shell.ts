export interface ShellState {
  currentDirectory: string;
  history: string[];
  historyIndex: number;
  currentInput: string;
  isRunningCommand: boolean;
  output: OutputLine[];
  tabCompletion: TabCompletionState;
}

export interface TabCompletionState {
  isActive: boolean;
  completions: string[];
  selectedIndex: number;
  originalInput: string;
  cursorPosition: number;
}

export interface OutputLine {
  id: string;
  content: string;
  type: 'command' | 'output' | 'error' | 'info';
  timestamp: Date;
}

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ShellCommand {
  name: string;
  execute: (args: string[], options: CommandOptions) => Promise<CommandResult>;
  description: string;
  usage?: string;
}

export interface CommandOptions {
  currentDirectory: string;
  env: Record<string, string>;
}