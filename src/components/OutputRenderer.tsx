import React, { useMemo } from 'react';
import { Box, Text } from 'ink';
import { OutputLine } from '../types/shell.js';

interface OutputRendererProps {
  output: OutputLine[];
  maxLines?: number;
}

export const OutputRenderer: React.FC<OutputRendererProps> = ({ output, maxLines = 100 }) => {
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

  // メモ化で不要な再レンダリングを防ぎ、長い出力は制限する
  const renderedOutput = useMemo(() => {
    // 最新のmaxLines行のみを表示
    const displayOutput = output.length > maxLines 
      ? output.slice(-maxLines) 
      : output;
    
    return displayOutput.map((line) => (
      <Box key={line.id} marginBottom={line.type === 'command' ? 1 : 0}>
        <Text color={getColorForType(line.type)}>
          {getIconForType(line.type)} {line.content}
        </Text>
      </Box>
    ));
  }, [output, maxLines]);

  return (
    <Box flexDirection="column" overflow="hidden">
      {output.length > maxLines && (
        <Box marginBottom={1}>
          <Text color="yellow" dimColor>
            📋 ... ({output.length - maxLines} lines hidden)
          </Text>
        </Box>
      )}
      {renderedOutput}
    </Box>
  );
};