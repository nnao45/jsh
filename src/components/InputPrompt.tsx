import React from 'react';
import { Box, Text } from 'ink';
import { getShortPath, getShortHostname } from '../utils/pathUtils.js';
import os from 'os';

interface InputPromptProps {
  currentDirectory: string;
  input: string;
  isRunning: boolean;
}

export const InputPrompt: React.FC<InputPromptProps> = ({
  currentDirectory,
  input,
  isRunning,
}) => {
  if (isRunning) {
    return (
      <Box>
        <Text color="yellow">⏳ コマンド実行中...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="cyan" bold>$ </Text>
      <Text>{input}</Text>
      <Text color="green">▋</Text>
    </Box>
  );
};