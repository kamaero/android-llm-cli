import React from 'react';
import { Box, Text } from 'ink';
import type { Message } from '../types.js';

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

  return (
    <Box flexGrow={1} flexDirection="column" paddingX={1}>
      {messages.map((msg) => (
        <Box key={msg.id} marginBottom={1} flexDirection="column">
          <Text bold color={msg.role === 'user' ? 'blue' : 'green'}>
            {msg.role === 'user' ? 'You' : 'Assistant'}
          </Text>
          <Text>{msg.content}</Text>
        </Box>
      ))}
    </Box>
  );
}
