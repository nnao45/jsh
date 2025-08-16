export interface ShellState {
  currentDirectory: string;
  history: string[];
  historyIndex: number;
  currentInput: string;
  cursorPosition: number;
  isRunningCommand: boolean;
  isRunningInteractive: boolean;
  output: OutputLine[];
  tabCompletion: TabCompletionState;
  historySearch: {
    isActive: boolean;
    query: string;
    matchedCommand: string;
    originalInput: string;
  };
  autoSuggestion: {
    isVisible: boolean;
    suggestion: string;
    confidence: number;
    source: 'history' | 'completion';
  };
}

export interface TabCompletionState {
  isActive: boolean;
  completions: string[];
  selectedIndex: number;
  originalInput: string;
  cursorPosition: number;
  baseInput: string;        // 補完されない部分（入力済み部分）
  completionStart: number;  // 補完開始位置
}

export interface OutputLine {
  id: string;
  content: string;
  type: 'command' | 'output' | 'error' | 'info' | 'prompt';
  timestamp: Date;
  directory?: string;
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

export interface InteractiveCommandOptions extends CommandOptions {
  onExit?: () => void;
  onSuspendUI?: () => void;
  onRestoreUI?: () => void;
}

export interface PipelineOptions extends CommandOptions {
  // Extended options for pipeline execution
}

export type RedirectionType = '>' | '>>' | '<';

export type ChainOperator = '&&' | '||' | ';';

export interface CommandChain {
  operator?: ChainOperator;
  pipeline: string;  // The pipeline command string
}