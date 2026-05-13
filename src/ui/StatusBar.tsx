import React from 'react';
import { Box, Text } from 'ink';
import type { AppState } from '../types.js';

interface StatusBarProps {
  state: AppState;
}

function StatusBarInner({ state }: StatusBarProps) {
  const { session, status, retryState } = state;

  const isStreaming = status === 'streaming';
  const isRetrying = status === 'retrying';
  const isError = status === 'error';
  const barColor = isError ? 'red' : isStreaming || isRetrying ? 'yellow' : 'green';

  // Compute total tokens only from the last message's token count
  // (faster than reducing the entire array on every render)
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
      {isRetrying && retryState && (
        <>
          <Text dimColor> │ </Text>
          <Text color="yellow">retrying ({retryState.attempt}/{retryState.maxAttempts})…</Text>
        </>
      )}
      {isError && state.error && (
        <>
          <Text dimColor> │ </Text>
          <Text color="red">{state.error}</Text>
        </>
      )}
    </Box>
  );
}

/**
 * Memoised status bar — only re-renders when status, provider, model, mode, error, or token count changes.
 * This prevents input keystrokes from causing any status bar re-render.
 */
export const StatusBar = React.memo(StatusBarInner, (prev, next) => {
  const a = prev.state;
  const b = next.state;
  if (a.status !== b.status) return false;
  if (a.error !== b.error) return false;
  if (a.session.provider !== b.session.provider) return false;
  if (a.session.model !== b.session.model) return false;
  if (a.session.mode !== b.session.mode) return false;
  if (a.retryState?.attempt !== b.retryState?.attempt) return false;
  // Check if tokens changed
  const tokensA = a.session.messages.reduce((s, m) => s + (m.tokens ?? 0), 0);
  const tokensB = b.session.messages.reduce((s, m) => s + (m.tokens ?? 0), 0);
  if (tokensA !== tokensB) return false;
  return true;
});
