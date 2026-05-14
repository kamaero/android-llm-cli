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

function MessageListInner({ messages }: MessageListProps) {
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

/**
 * Optimized memoization: only re-render if the visible messages actually changed.
 * This prevents unnecessary re-renders when messages array reference changes but
 * visible content is identical (e.g., hidden message count changes).
 */
export const MessageList = React.memo(MessageListInner, (prevProps, nextProps) => {
  const prevMessages = prevProps.messages;
  const nextMessages = nextProps.messages;

  // Quick reference check first
  if (prevMessages === nextMessages) return true;

  // Check if visible messages are the same
  const prevVisible = prevMessages.slice(-MAX_VISIBLE);
  const nextVisible = nextMessages.slice(-MAX_VISIBLE);

  if (prevVisible.length !== nextVisible.length) return false;

  // Compare each visible message by reference (messages are immutable)
  for (let i = 0; i < prevVisible.length; i++) {
    if (prevVisible[i] !== nextVisible[i]) return false;
  }

  return true;
});
