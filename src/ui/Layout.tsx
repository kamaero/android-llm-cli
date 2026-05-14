import React from 'react';
import { Box } from 'ink';
import type { AppState, AppAction } from '../types.js';
import { MessageList } from './MessageList.js';
import { CleanStatusLine } from './CleanStatusLine.js';
import { InputBox } from './EnhancedInputBox.js';
import { ToolConfirmBox } from './ToolConfirmBox.js';
import { NotificationProvider, NotificationToast } from './NotificationToast.js';
import { QuickActions } from './QuickActions.js';

interface LayoutProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  onCommand?: (input: string) => void;
}

export function Layout({ state, dispatch, onCommand }: LayoutProps) {
  return (
    <NotificationProvider>
      <Box flexDirection="column" width="100%">
        <MessageList messages={state.session.messages} />
        {state.status === 'awaiting-tool-confirm' && state.pendingToolCall ? (
          <ToolConfirmBox pendingToolCall={state.pendingToolCall} dispatch={dispatch} />
        ) : (
          <InputBox dispatch={dispatch} onCommand={onCommand} isActive={state.status !== 'awaiting-tool-confirm'} />
        )}
        <CleanStatusLine state={state} />
        <QuickActions messages={state.session.messages} />
        <NotificationToast />
      </Box>
    </NotificationProvider>
  );
}
