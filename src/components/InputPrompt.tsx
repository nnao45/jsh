import React from 'react';
import { Box, Text } from 'ink';
import { getShortPath, getShortHostname } from '../utils/pathUtils.js';
import { useSparkleAnimation } from '../hooks/useSparkleAnimation.js';
import { getSettings } from '../config/settings.js';
import os from 'os';

interface InputPromptProps {
  currentDirectory: string;
  input: string;
  cursorPosition: number;
  isRunning: boolean;
  historySearch?: {
    isActive: boolean;
    query: string;
    matchedCommand: string;
    originalInput: string;
  };
}

export const InputPrompt: React.FC<InputPromptProps> = ({
  currentDirectory,
  input,
  cursorPosition,
  isRunning,
  historySearch,
}) => {
  const settings = getSettings();
  const sparkleFrame = useSparkleAnimation({ 
    enabled: !isRunning && settings.animation.enabled,
    intervalMs: settings.animation.sparkleIntervalMs
  });

  if (isRunning) {
    return (
      <Box>
        <Text color="yellow">⏳ コマンド実行中...</Text>
      </Box>
    );
  }

  // 履歴検索モード
  if (historySearch?.isActive) {
    return (
      <Box>
        <Text color="blue">(reverse-i-search)`</Text>
        <Text color="cyan">{historySearch.query}</Text>
        <Text color="blue">': </Text>
        <Text>{historySearch.matchedCommand}</Text>
        <Text backgroundColor="white" color="black"> </Text>
      </Box>
    );
  }

  // 通常のプロンプト
  const beforeCursor = input.slice(0, cursorPosition);
  const cursorChar = input[cursorPosition] || ' '; // カーソル位置の文字、末尾や空の場合は空白
  const afterCursor = input.slice(cursorPosition + 1);

  return (
    <Box>
      {sparkleFrame.symbols.map((symbol, index) => (
        <Text 
          key={index}
          color={symbol.color} 
          bold={sparkleFrame.bold}
          dimColor={sparkleFrame.dim}
        >
          {symbol.char}
        </Text>
      ))}
      <Text> </Text>
      <Text>{beforeCursor}</Text>
      <Text backgroundColor="white" color="black">{cursorChar}</Text>
      <Text>{afterCursor}</Text>
    </Box>
  );
};