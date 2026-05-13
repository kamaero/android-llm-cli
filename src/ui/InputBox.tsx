import React, { memo, useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { nanoid } from 'nanoid';
import type { AppAction } from '../types.js';

interface InputBoxProps {
  dispatch: React.Dispatch<AppAction>;
  onCommand?: (input: string) => void;
  isActive?: boolean;
  placeholder?: string;
}

export const InputBox = memo(function InputBox({
  dispatch,
  onCommand,
  isActive = true,
  placeholder = 'Type a message… (Ctrl+C to quit)',
}: InputBoxProps) {
  const { exit } = useApp();
  const [text, setText] = useState('');
  const [cursor, setCursor] = useState(0);

  useInput(
    (input, key) => {
      if (key.ctrl && input === 'c') {
        exit();
        return;
      }

      if (key.return) {
        const trimmed = text.trim();
        if (trimmed) {
          if (trimmed.startsWith('/')) {
            onCommand?.(trimmed);
          } else {
            dispatch({
              type: 'ADD_USER_MESSAGE',
              message: {
                id: nanoid(),
                role: 'user',
                content: trimmed,
                timestamp: Date.now(),
              },
            });
          }
        }
        setText('');
        setCursor(0);
        return;
      }

      if (key.backspace || key.delete) {
        if (cursor > 0) {
          const next = text.slice(0, cursor - 1) + text.slice(cursor);
          setText(next);
          setCursor(cursor - 1);
        }
        return;
      }

      if (key.leftArrow) {
        setCursor(Math.max(0, cursor - 1));
        return;
      }

      if (key.rightArrow) {
        setCursor(Math.min(text.length, cursor + 1));
        return;
      }

      if (!key.ctrl && !key.meta && input) {
        const next = text.slice(0, cursor) + input + text.slice(cursor);
        setText(next);
        setCursor(cursor + input.length);
      }
    },
    { isActive },
  );

  const before = text.slice(0, cursor);
  const cursorChar = text[cursor] ?? ' ';
  const after = text.slice(cursor + 1);
  const isEmpty = text.length === 0;
  const cursorAtEnd = cursor === text.length;

  return (
    <Box borderStyle="single" paddingX={1}>
      <Text bold color="blue">
        {'> '}
      </Text>
      {isEmpty ? (
        <Text dimColor>{placeholder}</Text>
      ) : cursorAtEnd ? (
        /* Cursor at end — plain text only. Native terminal cursor handles position,
           no inverse char to clash with the block cursor on Termux. */
        <Text>{text}</Text>
      ) : (
        <>
          <Text>{before}</Text>
          <Text inverse>{cursorChar}</Text>
          <Text>{after}</Text>
        </>
      )}
    </Box>
  );
});
