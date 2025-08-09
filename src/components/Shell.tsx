import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput } from 'ink';
import { ShellState, OutputLine, CommandResult } from '../types/shell.js';
import { CommandExecutor } from '../modules/CommandExecutor.js';
import { BuiltinCommands } from '../modules/BuiltinCommands.js';
import { TabCompletion } from '../modules/TabCompletion.js';
import { OutputRenderer } from './OutputRenderer.js';
import { InputPrompt } from './InputPrompt.js';
import { CompletionMenu } from './CompletionMenu.js';

const initialState: ShellState = {
  currentDirectory: process.cwd(),
  history: [],
  historyIndex: -1,
  currentInput: '',
  isRunningCommand: false,
  output: [],
  tabCompletion: {
    isActive: false,
    completions: [],
    selectedIndex: 0,
    originalInput: '',
    cursorPosition: 0,
  },
};

export const Shell: React.FC = () => {
  const [state, setState] = useState<ShellState>(initialState);
  const commandExecutor = new CommandExecutor();
  const builtinCommands = new BuiltinCommands(setState);
  
  // タブ補完システムの初期化 🎯
  const tabCompletion = useMemo(() => {
    const builtinCommandNames = builtinCommands.getCommands().map(cmd => cmd.name);
    return new TabCompletion(builtinCommandNames);
  }, [builtinCommands]);

  const addOutput = useCallback((content: string, type: OutputLine['type'] = 'output') => {
    setState(prev => ({
      ...prev,
      output: [
        ...prev.output,
        {
          id: Date.now().toString(),
          content,
          type,
          timestamp: new Date(),
        }
      ]
    }));
  }, []);

  const executeCommand = useCallback(async (input: string) => {
    if (!input.trim()) return;

    // コマンドをhistoryに追加 📚
    setState(prev => ({
      ...prev,
      history: [...prev.history, input],
      historyIndex: -1,
      isRunningCommand: true,
      currentInput: '',
    }));

    addOutput(`$ ${input}`, 'command');

    try {
      const [command, ...args] = input.trim().split(/\s+/);
      
      // ビルトインコマンドをチェック 🔍
      if (command && builtinCommands.hasCommand(command)) {
        const result = await builtinCommands.execute(command, args);
        if (result.stdout) addOutput(result.stdout, 'output');
        if (result.stderr) addOutput(result.stderr, 'error');
      } else {
        // 外部コマンドを実行 ⚡
        const result = await commandExecutor.execute(input, {
          currentDirectory: state.currentDirectory,
          env: process.env as Record<string, string>,
        });
        
        if (result.stdout) addOutput(result.stdout, 'output');
        if (result.stderr) addOutput(result.stderr, 'error');
      }
    } catch (error) {
      addOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }

    setState(prev => ({
      ...prev,
      isRunningCommand: false,
    }));
  }, [state.currentDirectory, addOutput, builtinCommands, commandExecutor]);

  // 新しいタブ補完処理 🎯
  const handleTabCompletion = useCallback(async () => {
    if (!state.currentInput.trim()) return;

    // 既に補完モードがアクティブな場合は次の候補に移動
    if (state.tabCompletion.isActive) {
      setState(prev => ({
        ...prev,
        tabCompletion: {
          ...prev.tabCompletion,
          selectedIndex: (prev.tabCompletion.selectedIndex + 1) % prev.tabCompletion.completions.length,
        },
        currentInput: prev.tabCompletion.completions[
          (prev.tabCompletion.selectedIndex + 1) % prev.tabCompletion.completions.length
        ] || prev.tabCompletion.originalInput,
      }));
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
            currentInput: completion,
            tabCompletion: { ...initialState.tabCompletion }
          }));
        }
      } else {
        // 複数の候補 - 補完メニューを表示 📋
        setState(prev => ({
          ...prev,
          tabCompletion: {
            isActive: true,
            completions: result.completions,
            selectedIndex: 0,
            originalInput: prev.currentInput,
            cursorPosition: prev.currentInput.length,
          },
          currentInput: result.completions[0] || prev.currentInput,
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
        currentInput: prev.tabCompletion.completions[newIndex] || prev.tabCompletion.originalInput,
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
    if (state.isRunningCommand) return;

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
            currentInput: prev.tabCompletion.completions[newIndex] || prev.tabCompletion.originalInput,
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
      }));
    } else if (input && !key.ctrl && !key.meta) {
      // 通常の文字入力 ✏️
      setState(prev => ({
        ...prev,
        currentInput: prev.currentInput + input,
        // 文字入力時は補完をリセット
        tabCompletion: { ...initialState.tabCompletion },
      }));
    }
  }, [state, executeCommand, addOutput, handleTabCompletion, handleShiftTab, cancelCompletion]);

  useInput(handleInput, { isActive: true });

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          🐚 InkSh - Next-Gen Interactive Shell ✨
        </Text>
      </Box>
      
      <OutputRenderer output={state.output} />
      
      <InputPrompt
        currentDirectory={state.currentDirectory}
        input={state.currentInput}
        isRunning={state.isRunningCommand}
      />

      <CompletionMenu tabCompletion={state.tabCompletion} />
    </Box>
  );
};