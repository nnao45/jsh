import React from 'react';
import { Box, Text } from 'ink';
import path from 'path';
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
  const getShortPath = (fullPath: string): string => {
    const home = os.homedir();
    if (fullPath.startsWith(home)) {
      return fullPath.replace(home, '~');
    }
    return fullPath;
  };

  const currentDir = getShortPath(currentDirectory);

  if (isRunning) {
    return (
      <Box>
        <Text color="yellow">⏳ コマンド実行中...</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="green" bold>
        🏠 {currentDir}
      </Text>
      <Text color="cyan" bold>
        {' $ '}
      </Text>
      <Text>{input}</Text>
      <Text color="green">▋</Text>
    </Box>
  );
};