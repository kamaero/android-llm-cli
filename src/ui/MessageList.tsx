import React from 'react';
import { Box, Text } from 'ink';
import type { Message } from '../types.js';
import { MessageItem } from './MessageItem.js';

// Keep only the most recent messages so the newest is always visible
// above the input box (sticky-bottom behaviour without terminal scroll APIs).
const MAX_VISIBLE = 50;

interface MessageListProps {
  messages: Message[];
}

export function MessageList({ messages }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <Box flexGrow={1} alignItems="center" justifyContent="center">
        <Text dimColor>No messages yet. Start typing below.</Text>
      </Box>
    );
  }

  const hidden = Math.max(0, messages.length - MAX_VISIBLE);
  const visible = messages.slice(-MAX_VISIBLE);

  return (
    <Box flexGrow={1} flexDirection="column" paddingX={1}>
      {hidden > 0 && (
        <Text dimColor>
          ↑ {hidden} older message{hidden === 1 ? '' : 's'}
        </Text>
      )}
      {visible.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </Box>
  );
}
