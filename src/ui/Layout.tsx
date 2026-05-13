import React from 'react';
import { Box } from 'ink';
import type { AppState, AppAction } from '../types.js';
import { MessageList } from './MessageList.js';
import { StatusBar } from './StatusBar.js';
import { InputBox } from './InputBox.js';

interface LayoutProps {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

export function Layout({ state, dispatch }: LayoutProps) {
  return (
    <Box flexDirection="column" width="100%">
      <MessageList messages={state.session.messages} />
      <StatusBar state={state} />
      <InputBox dispatch={dispatch} isActive={state.status !== 'awaiting-tool-confirm'} />
    </Box>
  );
}
