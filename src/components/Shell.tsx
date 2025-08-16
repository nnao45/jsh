import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { ShellState, OutputLine, CommandResult, InteractiveCommandOptions } from '../types/shell.js';
import { CommandExecutor } from '../modules/CommandExecutor.js';
import { BuiltinCommands } from '../modules/BuiltinCommands.js';
import { TabCompletion } from '../modules/TabCompletion.js';
import { AutoSuggestion } from '../modules/AutoSuggestion.js';
import { OutputRenderer } from './OutputRenderer.js';
import { InputPrompt } from './InputPrompt.js';
import { CompletionMenu } from './CompletionMenu.js';
import { generatePromptLine } from '../utils/pathUtils.js';
import { outputIdGenerator } from '../utils/idUtils.js';
import { parseCommandLine, needsComplexParsing } from '../utils/commandParser.js';

const initialState: ShellState = {
  currentDirectory: process.cwd(),
  history: [],
  historyIndex: -1,
  currentInput: '',
  cursorPosition: 0,
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
  historySearch: {
    isActive: false,
    query: '',
    matchedCommand: '',
    originalInput: '',
  },
  autoSuggestion: {
    isVisible: false,
    suggestion: '',
    confidence: 0,
    source: 'history',
  },
};

export const Shell: React.FC = () => {
  const [state, setState] = useState<ShellState>(initialState);
  const { exit } = useApp();
  const { stdout } = useStdout();
  const commandExecutor = new CommandExecutor();
  const builtinCommands = new BuiltinCommands(setState);
  
  // ターミナルサイズを監視して出力行数を制限
  const [terminalHeight, setTerminalHeight] = useState(stdout?.rows || 24);
  
  useEffect(() => {
    const updateTerminalSize = () => {
      if (stdout) {
        setTerminalHeight(stdout.rows);
      }
    };
    
    // ターミナルサイズ変更を監視
    process.stdout.on('resize', updateTerminalSize);
    
    return () => {
      process.stdout.off('resize', updateTerminalSize);
    };
  }, [stdout]);
  
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

  // 自動提案システムの初期化 💡
  const autoSuggestion = useMemo(() => {
    return new AutoSuggestion({
      minInputLength: 2,
      maxSuggestions: 1,
      enableFuzzyMatch: true,
    });
  }, []);

  // 自動提案を更新する関数 💡（デバウンス付き）
  const updateAutoSuggestion = useCallback((input: string) => {
    // 現在の提案と同じ場合は更新しない
    if (state.autoSuggestion.suggestion && input && 
        (input + state.autoSuggestion.suggestion).startsWith(input)) {
      return;
    }

    if (!input || !autoSuggestion.shouldSuggest(input)) {
      if (state.autoSuggestion.isVisible) {
        setState(prev => ({
          ...prev,
          autoSuggestion: { ...initialState.autoSuggestion },
        }));
      }
      return;
    }

    const suggestion = autoSuggestion.getSuggestion(
      input,
      state.history,
      state.currentDirectory
    );

    // 提案が変わった場合のみ更新
    const newSuggestion = suggestion?.suggestion || '';
    if (newSuggestion !== state.autoSuggestion.suggestion) {
      setState(prev => ({
        ...prev,
        autoSuggestion: {
          isVisible: !!suggestion,
          suggestion: newSuggestion,
          confidence: suggestion?.confidence || 0,
          source: suggestion?.source || 'history',
        },
      }));
    }
  }, [autoSuggestion, state.history, state.currentDirectory, state.autoSuggestion]);

  // 自動提案を受け入れる関数 ✅
  const acceptAutoSuggestion = useCallback(() => {
    if (state.autoSuggestion.isVisible && state.autoSuggestion.suggestion) {
      const newInput = state.currentInput + state.autoSuggestion.suggestion;
      
      // Record acceptance for learning
      autoSuggestion.recordFeedback(
        state.currentInput,
        state.autoSuggestion.suggestion,
        true,
        state.autoSuggestion.source
      );

      setState(prev => ({
        ...prev,
        currentInput: newInput,
        cursorPosition: newInput.length,
        autoSuggestion: { ...initialState.autoSuggestion },
      }));
    }
  }, [state.currentInput, state.autoSuggestion, autoSuggestion]);

  const addOutput = useCallback((content: string, type: OutputLine['type'] = 'output', directory?: string) => {
    // コマンド実行中の場合は、段階的な出力を避けてバッチ処理
    if (state.isRunningCommand && type === 'output') {
      return; // コマンド実行中は出力を蓄積せず、完了後に一括表示
    }
    
    setState(prev => ({
      ...prev,
      output: [
        ...prev.output,
        {
          id: outputIdGenerator.generate('output'),
          content,
          type,
          timestamp: new Date(),
          directory,
        }
      ]
    }));
  }, [state.isRunningCommand]);

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
      cursorPosition: 0,
      tabCompletion: { ...initialState.tabCompletion },
    }));

    try {
      // Use improved command parsing that respects quotes
      const { command, args } = needsComplexParsing(input) 
        ? parseCommandLine(input) 
        : { command: input.trim().split(/\s+/)[0], args: input.trim().split(/\s+/).slice(1) };
      
      // ビルトインコマンドをチェック 🔍
      if (command && builtinCommands.hasCommand(command)) {
        const result = await builtinCommands.execute(command, args);
        
        // 出力を一括で状態に追加
        const newOutputs: OutputLine[] = [];
        if (result.stdout) {
          newOutputs.push({
            id: outputIdGenerator.generate('output'),
            content: result.stdout,
            type: 'output',
            timestamp: new Date(),
            directory: state.currentDirectory,
          });
        }
        if (result.stderr) {
          newOutputs.push({
            id: outputIdGenerator.generate('output'),
            content: result.stderr,
            type: 'error',
            timestamp: new Date(),
            directory: state.currentDirectory,
          });
        }
        
        if (newOutputs.length > 0) {
          setState(prev => ({
            ...prev,
            output: [...prev.output, ...newOutputs]
          }));
        }
        
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
        
        // 出力を一括で状態に追加
        const newOutputs: OutputLine[] = [];
        if (result.stdout) {
          newOutputs.push({
            id: outputIdGenerator.generate('output'),
            content: result.stdout,
            type: 'output',
            timestamp: new Date(),
            directory: state.currentDirectory,
          });
        }
        if (result.stderr) {
          newOutputs.push({
            id: outputIdGenerator.generate('output'),
            content: result.stderr,
            type: 'error',
            timestamp: new Date(),
            directory: state.currentDirectory,
          });
        }
        
        if (newOutputs.length > 0) {
          setState(prev => ({
            ...prev,
            output: [...prev.output, ...newOutputs]
          }));
        }
        
        // 外部コマンド実行後、ディレクトリが変更されている可能性があるのでチェック 🔍
        const newCwd = process.cwd();
        if (newCwd !== state.currentDirectory) {
          setState(prev => ({ ...prev, currentDirectory: newCwd }));
        }
      }
    } catch (error) {
      addOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }

    // 実行完了後、新しいプロンプトと状態を一度に更新 ✨
    const currentCwd = process.cwd();
    const newPromptLine = generatePromptLine(currentCwd);
    
    setState(prev => ({
      ...prev,
      isRunningCommand: false,
      currentDirectory: currentCwd,
      output: [...prev.output, {
        id: outputIdGenerator.generate('prompt'),
        content: newPromptLine,
        type: 'prompt' as const,
        timestamp: new Date(),
        directory: currentCwd,
      }]
    }));
  }, [state.currentDirectory, addOutput, builtinCommands, commandExecutor, suspendUI, restoreUI]);


  // 新しいタブ補完処理 🎯
  const handleTabCompletion = useCallback(async () => {
    if (!state.currentInput.trim()) return;

    // 既に補完モードがアクティブな場合は次の候補に移動
    if (state.tabCompletion.isActive) {
      setState(prev => {
        const newIndex = (prev.tabCompletion.selectedIndex + 1) % prev.tabCompletion.completions.length;
        const newInput = prev.tabCompletion.baseInput + prev.tabCompletion.completions[newIndex];
        return {
          ...prev,
          tabCompletion: {
            ...prev.tabCompletion,
            selectedIndex: newIndex,
          },
          currentInput: newInput,
          cursorPosition: newInput.length,
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
          const newInput = result.baseInput + completion;
          setState(prev => ({ 
            ...prev, 
            currentInput: newInput,
            cursorPosition: newInput.length,
            tabCompletion: { ...initialState.tabCompletion }
          }));
        }
      } else {
        // 複数の候補 - 補完メニューを表示 📋
        const newInput = result.baseInput + (result.completions[0] || '');
        setState(prev => ({
          ...prev,
          tabCompletion: {
            isActive: true,
            completions: result.completions,
            selectedIndex: 0,
            originalInput: prev.currentInput,
            cursorPosition: prev.currentInput.length,
            baseInput: result.baseInput,
            completionStart: result.completionStart,
          },
          currentInput: newInput,
          cursorPosition: newInput.length,
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
      const newInput = prev.tabCompletion.baseInput + prev.tabCompletion.completions[newIndex];
      
      return {
        ...prev,
        tabCompletion: {
          ...prev.tabCompletion,
          selectedIndex: newIndex,
        },
        currentInput: newInput,
        cursorPosition: newInput.length,
      };
    });
  }, [state.tabCompletion.isActive]);

  // 補完キャンセル処理 ❌
  const cancelCompletion = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentInput: prev.tabCompletion.originalInput,
      cursorPosition: prev.tabCompletion.originalInput.length,
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
          const newInput = prev.tabCompletion.baseInput + prev.tabCompletion.completions[newIndex];
          
          return {
            ...prev,
            tabCompletion: {
              ...prev.tabCompletion,
              selectedIndex: newIndex,
            },
            currentInput: newInput,
            cursorPosition: newInput.length,
          };
        });
        return;
      } else if (!key.ctrl && !key.meta && input && input !== '\t') {
        // 通常の文字入力で補完をキャンセル ⌨️
        cancelCompletion();
        setState(prev => {
          const beforeCursor = prev.currentInput.slice(0, prev.cursorPosition);
          const afterCursor = prev.currentInput.slice(prev.cursorPosition);
          return {
            ...prev,
            currentInput: beforeCursor + input + afterCursor,
            cursorPosition: prev.cursorPosition + input.length,
          };
        });
        return;
      }
    }

    // 通常の入力処理 ⌨️
    if (key.return) {
      if (state.historySearch.isActive) {
        // 履歴検索モードでのEnter - 選択されたコマンドを確定
        setState(prev => ({
          ...prev,
          historySearch: { ...initialState.historySearch },
        }));
      } else {
        executeCommand(state.currentInput);
        // 補完状態もリセット
        setState(prev => ({
          ...prev,
          tabCompletion: { ...initialState.tabCompletion },
        }));
      }
    } else if (key.escape) {
      // Escapeキーで履歴検索をキャンセル
      if (state.historySearch.isActive) {
        setState(prev => ({
          ...prev,
          currentInput: prev.historySearch.originalInput,
          cursorPosition: prev.historySearch.originalInput.length,
          historySearch: { ...initialState.historySearch },
        }));
      }
    } else if (key.tab && key.shift) {
      // Shift+Tab (補完非アクティブ時は何もしない)
      return;
    } else if (key.tab) {
      // タブ補完実行 🎯
      handleTabCompletion();
    } else if (key.leftArrow) {
      // 左矢印キーでカーソルを左に移動 ⬅️
      if (state.cursorPosition > 0) {
        setState(prev => ({
          ...prev,
          cursorPosition: prev.cursorPosition - 1,
        }));
      }
    } else if (key.rightArrow) {
      // 右矢印キー - 自動提案があれば受け入れ、なければカーソル移動 ➡️
      if (state.autoSuggestion.isVisible && 
          state.autoSuggestion.suggestion && 
          state.cursorPosition === state.currentInput.length) {
        // 自動提案を受け入れ ✅
        acceptAutoSuggestion();
      } else if (state.cursorPosition < state.currentInput.length) {
        // 通常のカーソル移動 ➡️
        setState(prev => ({
          ...prev,
          cursorPosition: prev.cursorPosition + 1,
          autoSuggestion: { ...initialState.autoSuggestion }, // Hide suggestion when moving cursor
        }));
      }
    } else if (key.upArrow) {
      // 履歴を上に ⬆️
      if (state.historyIndex < state.history.length - 1) {
        const newIndex = state.historyIndex + 1;
        const newInput = state.history[state.history.length - 1 - newIndex] || '';
        setState(prev => ({
          ...prev,
          historyIndex: newIndex,
          currentInput: newInput,
          cursorPosition: newInput.length,
          tabCompletion: { ...initialState.tabCompletion },
        }));
      }
    } else if (key.downArrow) {
      // 履歴を下に ⬇️
      if (state.historyIndex > -1) {
        const newIndex = state.historyIndex - 1;
        const newInput = newIndex === -1 ? '' : (state.history[state.history.length - 1 - newIndex] || '');
        setState(prev => ({
          ...prev,
          historyIndex: newIndex,
          currentInput: newInput,
          cursorPosition: newInput.length,
          tabCompletion: { ...initialState.tabCompletion },
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
        setState(prev => ({ ...prev, currentInput: '', cursorPosition: 0 }));
      }
    } else if (key.ctrl && input === 'a') {
      // Ctrl+A で行の先頭へ移動 🏠
      setState(prev => ({ ...prev, cursorPosition: 0 }));
    } else if (key.ctrl && input === 'e') {
      // Ctrl+E で行の末尾へ移動 🏁
      setState(prev => ({ ...prev, cursorPosition: prev.currentInput.length }));
    } else if (key.ctrl && input === 'u') {
      // Ctrl+U で行の先頭まで削除 ✂️
      setState(prev => ({
        ...prev,
        currentInput: prev.currentInput.slice(prev.cursorPosition),
        cursorPosition: 0,
        tabCompletion: { ...initialState.tabCompletion },
        historyIndex: -1,
      }));
    } else if (key.ctrl && input === 'k') {
      // Ctrl+K で行の末尾まで削除 ✂️
      setState(prev => ({
        ...prev,
        currentInput: prev.currentInput.slice(0, prev.cursorPosition),
        tabCompletion: { ...initialState.tabCompletion },
        historyIndex: -1,
      }));
    } else if (key.ctrl && input === 'w') {
      // Ctrl+W で前の単語を削除 🗑️
      setState(prev => {
        const beforeCursor = prev.currentInput.slice(0, prev.cursorPosition);
        const afterCursor = prev.currentInput.slice(prev.cursorPosition);
        
        // 前の単語の境界を見つける
        const words = beforeCursor.trimEnd();
        const lastSpaceIndex = words.lastIndexOf(' ');
        const newBeforeCursor = lastSpaceIndex === -1 ? '' : words.slice(0, lastSpaceIndex + 1);
        
        return {
          ...prev,
          currentInput: newBeforeCursor + afterCursor,
          cursorPosition: newBeforeCursor.length,
          tabCompletion: { ...initialState.tabCompletion },
          historyIndex: -1,
        };
      });
    } else if (key.ctrl && input === 'l') {
      // Ctrl+L で画面クリア 🧹
      setState(prev => ({
        ...prev,
        output: [{
          id: outputIdGenerator.generate('prompt'),
          content: generatePromptLine(prev.currentDirectory),
          type: 'prompt' as const,
          timestamp: new Date(),
          directory: prev.currentDirectory,
        }],
      }));
    } else if (key.ctrl && input === 'd') {
      // Ctrl+D でEOF/ログアウト 🚪
      if (state.currentInput === '') {
        exit();
      }
    } else if (key.ctrl && input === 'r') {
      // Ctrl+R で履歴検索 🔍
      if (!state.historySearch.isActive) {
        setState(prev => ({
          ...prev,
          historySearch: {
            isActive: true,
            query: '',
            matchedCommand: '',
            originalInput: prev.currentInput,
          },
        }));
      } else {
        // 既に検索モードの場合は、次の候補を探す
        const currentQuery = state.historySearch.query;
        if (currentQuery) {
          const matchedCommands = state.history.filter(cmd => 
            cmd.includes(currentQuery)
          ).reverse();
          const currentIndex = matchedCommands.indexOf(state.historySearch.matchedCommand);
          const nextCommand = matchedCommands[currentIndex + 1] || matchedCommands[0];
          
          if (nextCommand) {
            setState(prev => ({
              ...prev,
              historySearch: {
                ...prev.historySearch,
                matchedCommand: nextCommand,
              },
              currentInput: nextCommand,
              cursorPosition: nextCommand.length,
            }));
          }
        }
      }
    } else if (key.backspace || key.delete) {
      // バックスペース処理 ⌫
      if (state.historySearch.isActive) {
        setState(prev => {
          const newQuery = prev.historySearch.query.slice(0, -1);
          if (newQuery === '') {
            return {
              ...prev,
              historySearch: {
                ...prev.historySearch,
                query: '',
                matchedCommand: '',
              },
              currentInput: '',
              cursorPosition: 0,
            };
          }
          
          const matchedCommand = prev.history.find(cmd => cmd.includes(newQuery));
          return {
            ...prev,
            historySearch: {
              ...prev.historySearch,
              query: newQuery,
              matchedCommand: matchedCommand || '',
            },
            currentInput: matchedCommand || newQuery,
            cursorPosition: matchedCommand?.length || newQuery.length,
          };
        });
      } else {
        setState(prev => {
          if (prev.cursorPosition > 0) {
            const beforeCursor = prev.currentInput.slice(0, prev.cursorPosition - 1);
            const afterCursor = prev.currentInput.slice(prev.cursorPosition);
            return {
              ...prev,
              currentInput: beforeCursor + afterCursor,
              cursorPosition: prev.cursorPosition - 1,
              tabCompletion: { ...initialState.tabCompletion },
              historyIndex: -1,
            };
          }
          return prev;
        });
      }
    } else if (input && !key.ctrl && !key.meta) {
      // 通常の文字入力 ✏️
      if (state.historySearch.isActive) {
        setState(prev => {
          const newQuery = prev.historySearch.query + input;
          const matchedCommand = prev.history
            .slice()
            .reverse()
            .find(cmd => cmd.includes(newQuery));
          
          return {
            ...prev,
            historySearch: {
              ...prev.historySearch,
              query: newQuery,
              matchedCommand: matchedCommand || '',
            },
            currentInput: matchedCommand || newQuery,
            cursorPosition: matchedCommand?.length || newQuery.length,
          };
        });
      } else {
        setState(prev => {
          const beforeCursor = prev.currentInput.slice(0, prev.cursorPosition);
          const afterCursor = prev.currentInput.slice(prev.cursorPosition);
          const newInput = beforeCursor + input + afterCursor;
          return {
            ...prev,
            currentInput: newInput,
            cursorPosition: prev.cursorPosition + input.length,
            tabCompletion: { ...initialState.tabCompletion },
            historyIndex: -1,
          };
        });
        
        // Update auto-suggestion immediately
        const beforeCursor = state.currentInput.slice(0, state.cursorPosition);
        const afterCursor = state.currentInput.slice(state.cursorPosition);
        const newInput = beforeCursor + input + afterCursor;
        
        // Only update suggestion if cursor is at end
        if (state.cursorPosition + input.length === newInput.length) {
          updateAutoSuggestion(newInput);
        }
      }
    }
  }, [state, executeCommand, addOutput, handleTabCompletion, handleShiftTab, cancelCompletion, updateAutoSuggestion, acceptAutoSuggestion]);

  useInput(handleInput, { isActive: !state.isRunningInteractive });

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
          🐚 JSH - Next-Gen Interactive Shell ✨
        </Text>
      </Box>
      
      <OutputRenderer 
        output={state.output} 
        maxLines={Math.max(terminalHeight - 6, 10)} // ヘッダー、プロンプト、余白を考慮
      />
      
      {/* 現在のプロンプトと入力を同じ行に表示 */}
      <InputPrompt
        currentDirectory={process.cwd()}
        input={state.currentInput}
        cursorPosition={state.cursorPosition}
        isRunning={state.isRunningCommand}
        historySearch={state.historySearch}
        autoSuggestion={state.autoSuggestion}
      />

      <CompletionMenu tabCompletion={state.tabCompletion} />
    </Box>
  );
};