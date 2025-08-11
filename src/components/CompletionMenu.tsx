import React from 'react';
import { Box, Text } from 'ink';
import { TabCompletionState } from '../types/shell.js';

interface CompletionMenuProps {
  tabCompletion: TabCompletionState;
  maxVisible?: number;
}

export const CompletionMenu: React.FC<CompletionMenuProps> = ({ 
  tabCompletion, 
  maxVisible = 8 
}) => {
  if (!tabCompletion.isActive || tabCompletion.completions.length === 0) {
    return null;
  }

  const { completions, selectedIndex } = tabCompletion;
  
  // 表示する候補の範囲を計算 📊
  const startIndex = Math.max(0, selectedIndex - Math.floor(maxVisible / 2));
  const endIndex = Math.min(completions.length, startIndex + maxVisible);
  const visibleCompletions = completions.slice(startIndex, endIndex);

  // スクロール表示用の情報 📜
  const showScrollUp = startIndex > 0;
  const showScrollDown = endIndex < completions.length;
  const totalCount = completions.length;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* 候補数とスクロール情報 */}
      <Box>
        <Text color="gray">
          💡 {totalCount} completion{totalCount !== 1 ? 's' : ''} 
          {totalCount > maxVisible && ` (showing ${visibleCompletions.length})`}
          {showScrollUp && ' ⬆️'}
          {showScrollDown && ' ⬇️'}
        </Text>
      </Box>

      {/* 候補一覧 */}
      <Box flexDirection="column">
        {visibleCompletions.map((completion, index) => {
          const actualIndex = startIndex + index;
          const isSelected = actualIndex === selectedIndex;
          const isDirectory = completion.endsWith('/');
          
          // 表示用: 補完部分のみ表示（baseInputは表示しない）
          const displayCompletion = completion;
          
          return (
            <Box key={`completion-${actualIndex}`}>
              <Text 
                color={isSelected ? 'black' : isDirectory ? 'blue' : 'white'}
                backgroundColor={isSelected ? 'cyan' : undefined}
                bold={isSelected}
              >
                {isSelected ? '▶ ' : '  '}
                {isDirectory ? '📁' : '📄'} {displayCompletion}
                {isSelected ? ' ◀' : ''}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* 操作ヘルプ */}
      <Box marginTop={1}>
        <Text color="gray" dimColor>
          💫 Tab:次へ Shift+Tab:前へ Enter:選択 Esc:キャンセル
        </Text>
      </Box>
    </Box>
  );
};