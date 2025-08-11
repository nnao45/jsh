import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { ShellState, OutputLine, CommandResult, InteractiveCommandOptions } from '../types/shell.js';
import { CommandExecutor } from '../modules/CommandExecutor.js';
import { BuiltinCommands } from '../modules/BuiltinCommands.js';
import { TabCompletion } from '../modules/TabCompletion.js';
import { OutputRenderer } from './OutputRenderer.js';
import { InputPrompt } from './InputPrompt.js';
import { CompletionMenu } from './CompletionMenu.js';
import { generatePromptLine } from '../utils/pathUtils.js';

const initialState: ShellState = {
  currentDirectory: process.cwd(),
  history: [],
  historyIndex: -1,
  currentInput: '',
  isRunningCommand: false,
  isRunningInteractive: false,
  output: [],
  tabCompletion: {
    isActive: false,
    completions: [],
    selectedIndex: 0,
    originalInput: '',
    cursorPosition: 0,
    baseInput: '',
    completionStart: 0,
  },
};

export const Shell: React.FC = () => {
  const [state, setState] = useState<ShellState>(initialState);
  const { exit } = useApp();
  const commandExecutor = new CommandExecutor();
  const builtinCommands = new BuiltinCommands(setState);
  
  // UI suspension methods for interactive commands
  const suspendUI = useCallback(() => {
    setState(prev => ({ ...prev, isRunningInteractive: true }));
  }, []);

  const restoreUI = useCallback(() => {
    setState(prev => ({ ...prev, isRunningInteractive: false }));
  }, []);
  
  // タブ補完システムの初期化 🎯
  const tabCompletion = useMemo(() => {
    const builtinCommandNames = builtinCommands.getCommands().map(cmd => cmd.name);
    return new TabCompletion(builtinCommandNames);
  }, [builtinCommands]);

  const addOutput = useCallback((content: string, type: OutputLine['type'] = 'output', directory?: string) => {
    setState(prev => ({
      ...prev,
      output: [
        ...prev.output,
        {
          id: Date.now().toString(),
          content,
          type,
          timestamp: new Date(),
          directory,
        }
      ]
    }));
  }, []);

  const executeCommand = useCallback(async (input: string) => {
    if (!input.trim()) {
      // 空のコマンドでも新しいプロンプトを表示 🆕
      const promptLine = generatePromptLine(state.currentDirectory);
      addOutput(promptLine, 'prompt', state.currentDirectory);
      return;
    }

    // 現在のプロンプトを出力履歴に追加 📝
    const promptLine = generatePromptLine(state.currentDirectory);
    addOutput(promptLine + input, 'command', state.currentDirectory);

    // コマンドをhistoryに追加 📚
    setState(prev => ({
      ...prev,
      history: [...prev.history, input],
      historyIndex: -1,
      isRunningCommand: true,
      currentInput: '',
      tabCompletion: { ...initialState.tabCompletion }, // 補完もリセット
    }));

    try {
      const [command, ...args] = input.trim().split(/\s+/);
      
      // ビルトインコマンドをチェック 🔍
      if (command && builtinCommands.hasCommand(command)) {
        const result = await builtinCommands.execute(command, args);
        if (result.stdout) addOutput(result.stdout, 'output');
        if (result.stderr) addOutput(result.stderr, 'error');
        
        // ビルトインコマンド実行後、ディレクトリが変更されている可能性があるのでチェック 🔍
        const newCwd = process.cwd();
        if (newCwd !== state.currentDirectory) {
          setState(prev => ({ ...prev, currentDirectory: newCwd }));
        }
      } else {
        // 外部コマンドを実行 ⚡
        const options: InteractiveCommandOptions = {
          currentDirectory: state.currentDirectory,
          env: process.env as Record<string, string>,
          onSuspendUI: suspendUI,
          onRestoreUI: restoreUI,
          onExit: () => {
            setState(prev => ({ ...prev, isRunningCommand: false }));
          },
        };
        const result = await commandExecutor.execute(input, options);
        
        if (result.stdout) addOutput(result.stdout, 'output');
        if (result.stderr) addOutput(result.stderr, 'error');
        
        // 外部コマンド実行後、ディレクトリが変更されている可能性があるのでチェック 🔍
        const newCwd = process.cwd();
        if (newCwd !== state.currentDirectory) {
          setState(prev => ({ ...prev, currentDirectory: newCwd }));
        }
      }
    } catch (error) {
      addOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }

    setState(prev => ({
      ...prev,
      isRunningCommand: false,
    }));

    // 実行完了後、新しいプロンプトを表示 ✨
    setTimeout(() => {
      setState(prev => {
        // 最新のprocess.cwd()を使用してプロンプトを生成 📍
        const currentCwd = process.cwd();
        const newPromptLine = generatePromptLine(currentCwd);
        const newOutput = [...prev.output, {
          id: Date.now().toString(),
          content: newPromptLine,
          type: 'prompt' as const,
          timestamp: new Date(),
          directory: currentCwd,
        }];
        
        return { 
          ...prev, 
          output: newOutput,
          currentDirectory: currentCwd, // 状態も同期
        };
      });
    }, 10); // 短い遅延で確実に最後に追加
  }, [state.currentDirectory, addOutput, builtinCommands, commandExecutor, suspendUI, restoreUI]);


  // 新しいタブ補完処理 🎯
  const handleTabCompletion = useCallback(async () => {
    if (!state.currentInput.trim()) return;

    // 既に補完モードがアクティブな場合は次の候補に移動
    if (state.tabCompletion.isActive) {
      setState(prev => {
        const newIndex = (prev.tabCompletion.selectedIndex + 1) % prev.tabCompletion.completions.length;
        return {
          ...prev,
          tabCompletion: {
            ...prev.tabCompletion,
            selectedIndex: newIndex,
          },
          currentInput: prev.tabCompletion.baseInput + prev.tabCompletion.completions[newIndex],
        };
      });
      return;
    }

    try {
      const result = await tabCompletion.complete(state.currentInput);
      
      if (result.completions.length === 0) {
        // 候補なし - 何もしない 🤷‍♂️
        return;
      } else if (result.completions.length === 1) {
        // 単一の候補 - 直接補完 ✨
        const completion = result.completions[0];
        if (completion) {
          setState(prev => ({ 
            ...prev, 
            currentInput: result.baseInput + completion,
            tabCompletion: { ...initialState.tabCompletion }
          }));
        }
      } else {
        // 複数の候補 - 補完メニューを表示 📋
        setState(prev => ({
          ...prev,
          tabCompletion: {
            isActive: true,
            completions: result.completions, // 補完部分だけを保存
            selectedIndex: 0,
            originalInput: prev.currentInput,
            cursorPosition: prev.currentInput.length,
            baseInput: result.baseInput,
            completionStart: result.completionStart,
          },
          currentInput: result.baseInput + result.completions[0] || prev.currentInput,
        }));
      }
    } catch (error) {
      console.error('Tab completion error:', error);
    }
  }, [state.currentInput, state.tabCompletion.isActive, tabCompletion]);

  // Shift+Tabで前の候補に移動 ⬅️
  const handleShiftTab = useCallback(() => {
    if (!state.tabCompletion.isActive) return;

    setState(prev => {
      const newIndex = prev.tabCompletion.selectedIndex === 0 
        ? prev.tabCompletion.completions.length - 1
        : prev.tabCompletion.selectedIndex - 1;
      
      return {
        ...prev,
        tabCompletion: {
          ...prev.tabCompletion,
          selectedIndex: newIndex,
        },
        currentInput: prev.tabCompletion.baseInput + prev.tabCompletion.completions[newIndex],
      };
    });
  }, [state.tabCompletion.isActive]);

  // 補完キャンセル処理 ❌
  const cancelCompletion = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentInput: prev.tabCompletion.originalInput,
      tabCompletion: { ...initialState.tabCompletion },
    }));
  }, []);

  const handleInput = useCallback((input: string, key: any) => {
    if (state.isRunningCommand || state.isRunningInteractive) return;

    // 補完メニューがアクティブな場合の特別処理 🎯
    if (state.tabCompletion.isActive) {
      if (key.return) {
        // 選択した候補を確定 ✅
        setState(prev => ({
          ...prev,
          tabCompletion: { ...initialState.tabCompletion },
        }));
        return;
      } else if (key.escape) {
        // 補完をキャンセル ❌
        cancelCompletion();
        return;
      } else if (key.tab && key.shift) {
        // Shift+Tab で前の候補 ⬅️
        handleShiftTab();
        return;
      } else if (key.tab) {
        // Tab で次の候補 ➡️
        handleTabCompletion();
        return;
      } else if (key.upArrow || key.downArrow) {
        // 矢印キーで候補選択 🔄
        const direction = key.upArrow ? -1 : 1;
        setState(prev => {
          const newIndex = key.upArrow 
            ? (prev.tabCompletion.selectedIndex === 0 
                ? prev.tabCompletion.completions.length - 1 
                : prev.tabCompletion.selectedIndex - 1)
            : (prev.tabCompletion.selectedIndex + 1) % prev.tabCompletion.completions.length;
          
          return {
            ...prev,
            tabCompletion: {
              ...prev.tabCompletion,
              selectedIndex: newIndex,
            },
            currentInput: prev.tabCompletion.baseInput + prev.tabCompletion.completions[newIndex],
          };
        });
        return;
      } else if (!key.ctrl && !key.meta && input && input !== '\t') {
        // 通常の文字入力で補完をキャンセル ⌨️
        cancelCompletion();
        setState(prev => ({
          ...prev,
          currentInput: prev.currentInput + input,
        }));
        return;
      }
    }

    // 通常の入力処理 ⌨️
    if (key.return) {
      executeCommand(state.currentInput);
      // 補完状態もリセット
      setState(prev => ({
        ...prev,
        tabCompletion: { ...initialState.tabCompletion },
      }));
    } else if (key.tab && key.shift) {
      // Shift+Tab (補完非アクティブ時は何もしない)
      return;
    } else if (key.tab) {
      // タブ補完実行 🎯
      handleTabCompletion();
    } else if (key.upArrow) {
      // 履歴を上に ⬆️
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        setState(prev => ({
          ...prev,
          historyIndex: newIndex,
          currentInput: prev.history[prev.history.length - 1 - newIndex] || '',
          tabCompletion: { ...initialState.tabCompletion }, // 履歴移動時は補完リセット
        }));
      }
    } else if (key.downArrow) {
      // 履歴を下に ⬇️
      if (state.historyIndex > -1) {
        const newIndex = state.historyIndex - 1;
        setState(prev => ({
          ...prev,
          historyIndex: newIndex,
          currentInput: newIndex === -1 ? '' : (prev.history[prev.history.length - 1 - newIndex] || ''),
          tabCompletion: { ...initialState.tabCompletion }, // 履歴移動時は補完リセット
        }));
      }
    } else if (key.ctrl && input === 'c') {
      // Ctrl+C でプロセス中断 ❌
      const processManager = builtinCommands.getProcessManager();
      const currentJob = processManager.getCurrentForegroundJob();
      
      if (currentJob && state.isRunningCommand) {
        // フォアグラウンドジョブを中断
        processManager.interruptForegroundJob();
        setState(prev => ({ ...prev, isRunningCommand: false }));
        addOutput('^C', 'info');
      } else if (state.isRunningCommand) {
        setState(prev => ({ ...prev, isRunningCommand: false }));
        addOutput('^C', 'info');
      } else {
        // 入力をクリア
        setState(prev => ({ ...prev, currentInput: '' }));
      }
    } else if (key.backspace || key.delete) {
      // バックスペース処理 ⌫
      setState(prev => ({
        ...prev,
        currentInput: prev.currentInput.slice(0, -1),
        tabCompletion: { ...initialState.tabCompletion }, // バックスペース時は補完リセット
        historyIndex: -1, // 履歴インデックスもリセット
      }));
    } else if (input && !key.ctrl && !key.meta) {
      // 通常の文字入力 ✏️
      setState(prev => ({
        ...prev,
        currentInput: prev.currentInput + input,
        // 文字入力時は補完と履歴インデックスをリセット
        tabCompletion: { ...initialState.tabCompletion },
        historyIndex: -1,
      }));
    }
  }, [state, executeCommand, addOutput, handleTabCompletion, handleShiftTab, cancelCompletion]);

  useInput(handleInput, { isActive: true });

  // 初回プロンプトを追加 🚀
  useEffect(() => {
    if (state.output.length === 0) {
      const currentCwd = process.cwd();
      const initialPrompt = generatePromptLine(currentCwd);
      addOutput(initialPrompt, 'prompt', currentCwd);
      // 状態も初期化時に同期
      setState(prev => ({ ...prev, currentDirectory: currentCwd }));
    }
  }, []);

  // Don't render the shell UI when running interactive commands
  if (state.isRunningInteractive) {
    return null;
  }

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          🐚 InkSh - Next-Gen Interactive Shell ✨
        </Text>
      </Box>
      
      <OutputRenderer output={state.output} />
      
      {/* 現在のプロンプトと入力を同じ行に表示 */}
      <InputPrompt
        currentDirectory={process.cwd()}
        input={state.currentInput}
        isRunning={state.isRunningCommand}
      />

      <CompletionMenu tabCompletion={state.tabCompletion} />
    </Box>
  );
};