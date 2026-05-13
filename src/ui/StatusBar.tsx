import React from 'react';
import { Box, Text } from 'ink';
import type { AppState } from '../types.js';

interface StatusBarProps {
  state: AppState;
}

export function StatusBar({ state }: StatusBarProps) {
  const { session, status } = state;

  const isStreaming = status === 'streaming';
  const barColor = isStreaming ? 'yellow' : 'green';

  const totalTokens = session.messages.reduce(
    (sum, m) => sum + (m.tokens ?? 0),
    0,
  );

  return (
    <Box borderStyle="single" borderColor={barColor} paddingX={1}>
      <Text color={barColor} bold>
        {session.provider || 'no-provider'}
      </Text>
      <Text dimColor> │ </Text>
      <Text>{session.model || 'no-model'}</Text>
      <Text dimColor> │ </Text>
      <Text color="cyan">{session.mode}</Text>
      <Text dimColor> │ </Text>
      <Text dimColor>tokens: {totalTokens}</Text>
      {isStreaming && (
        <>
          <Text dimColor> │ </Text>
          <Text color="yellow">streaming…</Text>
        </>
      )}
      {status === 'error' && state.error && (
        <>
          <Text dimColor> │ </Text>
          <Text color="red">{state.error}</Text>
        </>
      )}
    </Box>
  );
}
