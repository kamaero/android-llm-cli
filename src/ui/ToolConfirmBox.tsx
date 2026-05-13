import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import type { AppAction, PendingToolCall } from '../types.js';

interface ToolConfirmBoxProps {
  pendingToolCall: PendingToolCall;
  dispatch: React.Dispatch<AppAction>;
}

/**
 * Tool confirmation box with dual input:
 * - Keyboard: y/n/a (hardware keyboards, desktops)
 * - Text input: y + Enter / n + Enter / a + Enter (touch keyboards on Termux)
 */
export function ToolConfirmBox({ pendingToolCall, dispatch }: ToolConfirmBoxProps) {
  const [typed, setTyped] = useState('');

  const confirm = () => {
    dispatch({ type: 'CONFIRM_TOOL', toolCallId: pendingToolCall.call.id });
  };

  const reject = () => {
    dispatch({ type: 'REJECT_TOOL', toolCallId: pendingToolCall.call.id });
  };

  // Hardware keyboard listener (y/n/a)
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

    // Accumulate typed input for Enter-based confirmation
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
    <Box borderStyle="single" borderColor="yellow" flexDirection="column" paddingX={1}>
      {call.name === 'bash' ? (
        <Box flexDirection="column">
          <Text bold color="yellow">⚡ bash</Text>
          <Box paddingLeft={2}>
            <Text>{String(commandPreview)}</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text bold color="cyan">🔧 {call.name}</Text>
          <Box paddingLeft={2}>
            <Text dimColor>{commandPreview}</Text>
          </Box>
        </Box>
      )}
      <Box marginTop={1}>
        <Text bold color="green">[a]</Text>
        <Text> Allow • </Text>
        <Text bold color="red">[n]</Text>
        <Text> Deny</Text>
        {typed ? (
          <Text> — typed: {typed}</Text>
        ) : null}
      </Box>
      <Text dimColor>or type y/a + Enter, n + Enter</Text>
    </Box>
  );
}
