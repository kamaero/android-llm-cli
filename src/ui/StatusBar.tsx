import React from 'react';
import { Box, Text } from 'ink';
import type { AppState } from '../types.js';
import { useTheme } from '../theme.js';

interface StatusBarProps {
  state: AppState;
}

function StatusBarInner({ state }: StatusBarProps) {
  const theme = useTheme();
  const { session, status, retryState } = state;

  const isStreaming = status === 'streaming';
  const isRetrying = status === 'retrying';
  const isError = status === 'error';
  const barColor = isError ? theme.error : isStreaming || isRetrying ? theme.warning : theme.success;

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
      <Text color={theme.accent}>{session.mode}</Text>
      <Text dimColor> │ </Text>
      <Text color={state.securityMode === 'hardcore' ? theme.error : theme.success}>{state.securityMode}</Text>
      <Text dimColor> │ </Text>
      <Text dimColor>tokens: {totalTokens}</Text>
      {isStreaming && (
        <>
          <Text dimColor> │ </Text>
          <Text color={theme.warning}>streaming…</Text>
        </>
      )}
      {isRetrying && retryState && (
        <>
          <Text dimColor> │ </Text>
          <Text color={theme.warning}>retrying ({retryState.attempt}/{retryState.maxAttempts})…</Text>
        </>
      )}
      {isError && state.error && (
        <>
          <Text dimColor> │ </Text>
          <Text color={theme.error}>{state.error}</Text>
        </>
      )}
    </Box>
  );
}

export const StatusBar = React.memo(StatusBarInner, (prev, next) => {
  const a = prev.state;
  const b = next.state;
  if (a.status !== b.status) return false;
  if (a.error !== b.error) return false;
  if (a.session.provider !== b.session.provider) return false;
  if (a.session.model !== b.session.model) return false;
  if (a.session.mode !== b.session.mode) return false;
  if (a.securityMode !== b.securityMode) return false;
  if (a.retryState?.attempt !== b.retryState?.attempt) return false;
  if (a.session.messages.length !== b.session.messages.length) return false;
  const lastA = a.session.messages.at(-1);
  const lastB = b.session.messages.at(-1);
  if (lastA?.tokens !== lastB?.tokens) return false;
  return true;
});
