import React from 'react';
import { Box, Text, useInput } from 'ink';
import type { AppAction, PendingToolCall } from '../types.js';

interface ToolConfirmBoxProps {
  pendingToolCall: PendingToolCall;
  dispatch: React.Dispatch<AppAction>;
}

export function ToolConfirmBox({ pendingToolCall, dispatch }: ToolConfirmBoxProps) {
  useInput((input) => {
    if (input === 'y' || input === 'Y') {
      dispatch({ type: 'CONFIRM_TOOL', toolCallId: pendingToolCall.call.id });
    }

    if (input === 'n' || input === 'N') {
      dispatch({ type: 'REJECT_TOOL', toolCallId: pendingToolCall.call.id });
    }
  });

  return (
    <Box borderStyle="single" flexDirection="column" paddingX={1}>
      <Text>
        Allow {pendingToolCall.call.name} with {JSON.stringify(pendingToolCall.call.input)}?
      </Text>
      <Text dimColor>y = Confirm, n = Reject</Text>
    </Box>
  );
}
