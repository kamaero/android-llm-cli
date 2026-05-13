import React from 'react';
import { Box } from 'ink';
import type { AppState, AppAction } from '../types.js';
import { MessageList } from './MessageList.js';
import { StatusBar } from './StatusBar.js';
import { InputBox } from './InputBox.js';
import { ToolConfirmBox } from './ToolConfirmBox.js';

interface LayoutProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onCommand?: (input: string) => void;
}

export function Layout({ state, dispatch, onCommand }: LayoutProps) {
  return (
    <Box flexDirection="column" width="100%">
      <MessageList messages={state.session.messages} />
      <StatusBar state={state} />
      {state.status === 'awaiting-tool-confirm' && state.pendingToolCall ? (
        <ToolConfirmBox pendingToolCall={state.pendingToolCall} dispatch={dispatch} />
      ) : (
        <InputBox dispatch={dispatch} onCommand={onCommand} isActive={state.status !== 'awaiting-tool-confirm'} />
      )}
    </Box>
  );
}
