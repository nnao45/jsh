import React from 'react';
import { Box, Text } from 'ink';
import { OutputLine } from '../types/shell.js';

interface OutputRendererProps {
  output: OutputLine[];
}

export const OutputRenderer: React.FC<OutputRendererProps> = ({ output }) => {
  const getColorForType = (type: OutputLine['type']): string => {
    switch (type) {
      case 'command':
        return 'blue';
      case 'error':
        return 'red';
      case 'info':
        return 'yellow';
      case 'prompt':
        return 'green';
      case 'output':
      default:
        return 'white';
    }
  };

  const getIconForType = (type: OutputLine['type']): string => {
    switch (type) {
      case 'command':
        return '▶️';
      case 'error':
        return '❌';
      case 'info':
        return 'ℹ️';
      case 'prompt':
        return '🏠';
      case 'output':
      default:
        return '📄';
    }
  };

  return (
    <Box flexDirection="column">
      {output.map((line) => (
        <Box key={line.id} marginBottom={line.type === 'command' ? 1 : 0}>
          <Text color={getColorForType(line.type)}>
            {getIconForType(line.type)} {line.content}
          </Text>
        </Box>
      ))}
    </Box>
  );
};