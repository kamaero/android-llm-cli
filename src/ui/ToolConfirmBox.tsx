import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { AppAction, PendingToolCall } from '../types.js';
import { useTheme } from '../theme.js';

interface ToolConfirmBoxProps {
  pendingToolCall: PendingToolCall;
  dispatch: React.Dispatch<AppAction>;
}

export function ToolConfirmBox({ pendingToolCall, dispatch }: ToolConfirmBoxProps) {
  const theme = useTheme();
  const [typed, setTyped] = useState('');

  const confirm = () => {
    dispatch({ type: 'CONFIRM_TOOL', toolCallId: pendingToolCall.call.id });
  };

  const reject = () => {
    dispatch({ type: 'REJECT_TOOL', toolCallId: pendingToolCall.call.id });
  };

  useInput((input, key) => {
    if (key.return) {
      if (typed.toLowerCase() === 'y' || typed.toLowerCase() === 'a') {
        confirm();
      } else if (typed.toLowerCase() === 'n') {
        reject();
      }
      setTyped('');
      return;
    }

    if (input === 'y' || input === 'Y') {
      confirm();
      return;
    }

    if (input === 'n' || input === 'N') {
      reject();
      return;
    }

    if (input && input.length === 1 && !key.ctrl && !key.meta) {
      setTyped((prev) => (prev + input).toLowerCase());
    }
  });

  const { call } = pendingToolCall;
  const getCommandPreview = (): string => {
    if (call.name === 'bash') {
      const input = call.input as Record<string, unknown>;
      return typeof input.command === 'string' ? input.command : '';
    }
    return JSON.stringify(call.input);
  };
  const commandPreview = getCommandPreview();

  return (
    <Box borderStyle="single" borderColor={theme.warning} flexDirection="column" paddingX={1}>
      {call.name === 'bash' ? (
        <Box flexDirection="column">
          <Text bold color={theme.warning}>⚡ bash</Text>
          <Box paddingLeft={2}>
            <Text>{String(commandPreview)}</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text bold color={theme.accent}>🔧 {call.name}</Text>
          <Box paddingLeft={2}>
            <Text dimColor>{commandPreview}</Text>
          </Box>
        </Box>
      )}
      <Box marginTop={1}>
        <Text bold color={theme.success}>[a]</Text>
        <Text> Allow • </Text>
        <Text bold color={theme.error}>[n]</Text>
        <Text> Deny</Text>
        {typed ? (
          <Text> — typed: {typed}</Text>
        ) : null}
      </Box>
      <Text dimColor>or type y/a + Enter, n + Enter</Text>
    </Box>
  );
}
