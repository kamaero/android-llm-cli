import React, { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { nanoid } from 'nanoid';
import type { AppAction } from '../types.js';
import { useTheme } from '../theme.js';

interface InputBoxProps {
  dispatch: React.Dispatch<AppAction>;
  onCommand?: (input: string) => void;
  isActive?: boolean;
  placeholder?: string;
}

// Available commands for autocomplete
const AVAILABLE_COMMANDS = [
  '/clear',
  '/help',
  '/model',
  '/mode',
  '/search',
  '/security',
  '/theme',
];

// Command descriptions for help
const COMMAND_DESCRIPTIONS: Record<string, string> = {
  '/clear': 'Clear the conversation',
  '/help': 'Show help information',
  '/model': 'Change the AI model',
  '/mode': 'Switch between chat and agent mode',
  '/search': 'Search the web',
  '/security': 'Change security settings',
  '/theme': 'Change the UI theme',
};

export const EnhancedInputBox = memo(function EnhancedInputBox({
  dispatch,
  onCommand,
  isActive = true,
  placeholder = 'Type a message… (Tab: autocomplete, ↑↓: history, Shift+Enter: new line)',
}: InputBoxProps) {
  const theme = useTheme();
  const { exit } = useApp();

  // State management
  const [lines, setLines] = useState(['']);
  const [cursor, setCursor] = useState({ row: 0, col: 0 });
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [autocomplete, setAutocomplete] = useState<{
    suggestions: string[];
    selectedIndex: number;
    prefix: string;
  } | null>(null);
  const [isTyping, setIsTyping] = useState(false);

  // Typing indicator timer
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to get current line
  const currentLine = lines[cursor.row] || '';
  const text = lines.join('\n');
  const isEmpty = text.trim().length === 0;
  const isMultiline = lines.length > 1;

  // Typing indicator logic
  const handleTypingStart = useCallback(() => {
    if (!isTyping && text.length > 20) {
      setIsTyping(true);
    }

    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
    }

    typingTimerRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 1500);
  }, [isTyping, text.length]);

  // Cleanup typing timer
  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        clearTimeout(typingTimerRef.current);
      }
    };
  }, []);

  // Autocomplete logic
  const updateAutocomplete = useCallback((currentText: string, cursorPosition: number) => {
    if (!currentText.startsWith('/') || cursorPosition === 0) {
      setAutocomplete(null);
      return;
    }

    const beforeCursor = currentText.slice(0, cursorPosition);
    const lastWord = beforeCursor.match(/\/\w*$/)?.[0] || '';

    if (lastWord.length < 2) {
      setAutocomplete(null);
      return;
    }

    const suggestions = AVAILABLE_COMMANDS.filter(cmd =>
      cmd.toLowerCase().startsWith(lastWord.toLowerCase())
    );

    if (suggestions.length > 0) {
      setAutocomplete({
        suggestions,
        selectedIndex: 0,
        prefix: lastWord,
      });
    } else {
      setAutocomplete(null);
    }
  }, []);

  // Apply autocomplete suggestion
  const applyAutocomplete = useCallback(() => {
    if (!autocomplete || autocomplete.suggestions.length === 0) return;

    const suggestion = autocomplete.suggestions[autocomplete.selectedIndex];
    const newLines = [...lines];
    const beforePrefix = currentLine.slice(0, cursor.col - autocomplete.prefix.length);
    const afterCursor = currentLine.slice(cursor.col);

    newLines[cursor.row] = beforePrefix + suggestion + afterCursor;
    setLines(newLines);
    setCursor({ row: cursor.row, col: beforePrefix.length + suggestion.length });
    setAutocomplete(null);
  }, [autocomplete, currentLine, cursor, lines]);

  // Submit handler
  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Add to history (avoid duplicates)
    if (trimmed !== history[history.length - 1]) {
      setHistory(prev => [...prev.slice(-49), trimmed]); // Keep last 50 entries
    }

    // Execute command or send message
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

    // Reset state
    setLines(['']);
    setCursor({ row: 0, col: 0 });
    setHistoryIndex(-1);
    setAutocomplete(null);
    setIsTyping(false);
  }, [text, history, onCommand, dispatch]);

  // History navigation
  const navigateHistory = useCallback((direction: 'up' | 'down') => {
    if (history.length === 0) return;

    let newIndex: number;
    if (direction === 'up') {
      newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
    } else {
      newIndex = historyIndex === -1 ? -1 : Math.min(history.length - 1, historyIndex + 1);
    }

    setHistoryIndex(newIndex);

    if (newIndex === -1) {
      setLines(['']);
      setCursor({ row: 0, col: 0 });
    } else {
      const historyText = history[newIndex];
      const historyLines = historyText.split('\n');
      setLines(historyLines);
      const lastLine = historyLines[historyLines.length - 1];
      setCursor({ row: historyLines.length - 1, col: lastLine.length });
    }
    setAutocomplete(null);
  }, [history, historyIndex]);

  // Input handler
  useInput(
    (input, key) => {
      // Exit on Ctrl+C
      if (key.ctrl && input === 'c') {
        exit();
        return;
      }

      // Handle Enter and Shift+Enter
      if (key.return) {
        if (key.shift) {
          // Shift+Enter: new line
          const newLines = [...lines];
          const before = currentLine.slice(0, cursor.col);
          const after = currentLine.slice(cursor.col);
          newLines[cursor.row] = before;
          newLines.splice(cursor.row + 1, 0, after);
          setLines(newLines);
          setCursor({ row: cursor.row + 1, col: 0 });
          setAutocomplete(null);
        } else {
          // Enter: submit
          handleSubmit();
        }
        return;
      }

      // Tab: autocomplete
      if (key.tab) {
        if (autocomplete && autocomplete.suggestions.length > 0) {
          applyAutocomplete();
        } else {
          updateAutocomplete(currentLine, cursor.col);
        }
        return;
      }

      // Arrow key navigation
      if (key.upArrow) {
        if (autocomplete) {
          // Navigate autocomplete suggestions
          setAutocomplete(prev => prev ? {
            ...prev,
            selectedIndex: Math.max(0, prev.selectedIndex - 1)
          } : null);
        } else if (cursor.row === 0) {
          // Navigate history when on first line
          navigateHistory('up');
        } else {
          // Move cursor up
          setCursor(prev => ({
            row: Math.max(0, prev.row - 1),
            col: Math.min(prev.col, (lines[prev.row - 1] || '').length)
          }));
        }
        return;
      }

      if (key.downArrow) {
        if (autocomplete) {
          // Navigate autocomplete suggestions
          setAutocomplete(prev => prev ? {
            ...prev,
            selectedIndex: Math.min(prev.suggestions.length - 1, prev.selectedIndex + 1)
          } : null);
        } else if (cursor.row === lines.length - 1) {
          // Navigate history when on last line
          navigateHistory('down');
        } else {
          // Move cursor down
          setCursor(prev => ({
            row: Math.min(lines.length - 1, prev.row + 1),
            col: Math.min(prev.col, (lines[prev.row + 1] || '').length)
          }));
        }
        return;
      }

      if (key.leftArrow) {
        if (cursor.col > 0) {
          setCursor(prev => ({ ...prev, col: prev.col - 1 }));
        } else if (cursor.row > 0) {
          const prevLine = lines[cursor.row - 1];
          setCursor({ row: cursor.row - 1, col: prevLine.length });
        }
        updateAutocomplete(currentLine, cursor.col - 1);
        return;
      }

      if (key.rightArrow) {
        if (cursor.col < currentLine.length) {
          setCursor(prev => ({ ...prev, col: prev.col + 1 }));
        } else if (cursor.row < lines.length - 1) {
          setCursor({ row: cursor.row + 1, col: 0 });
        }
        updateAutocomplete(currentLine, cursor.col + 1);
        return;
      }

      // Backspace
      if (key.backspace || key.delete) {
        const newLines = [...lines];

        if (cursor.col > 0) {
          // Remove character before cursor
          const before = currentLine.slice(0, cursor.col - 1);
          const after = currentLine.slice(cursor.col);
          newLines[cursor.row] = before + after;
          setCursor(prev => ({ ...prev, col: prev.col - 1 }));
        } else if (cursor.row > 0) {
          // Join with previous line
          const prevLine = lines[cursor.row - 1];
          newLines[cursor.row - 1] = prevLine + currentLine;
          newLines.splice(cursor.row, 1);
          setCursor({ row: cursor.row - 1, col: prevLine.length });
        }

        setLines(newLines);
        setAutocomplete(null);
        return;
      }

      // Regular character input
      if (!key.ctrl && !key.meta && input) {
        const newLines = [...lines];
        const before = currentLine.slice(0, cursor.col);
        const after = currentLine.slice(cursor.col);
        newLines[cursor.row] = before + input + after;

        setLines(newLines);
        const newCol = cursor.col + input.length;
        setCursor(prev => ({ ...prev, col: newCol }));

        updateAutocomplete(newLines[cursor.row], newCol);
        handleTypingStart();
      }
    },
    { isActive },
  );

  // Render autocomplete suggestions
  const renderAutocomplete = () => {
    if (!autocomplete || autocomplete.suggestions.length === 0) return null;

    return (
      <Box flexDirection="column" marginLeft={2}>
        {autocomplete.suggestions.map((suggestion, index) => (
          <Box key={suggestion} flexDirection="row">
            <Text
              color={index === autocomplete.selectedIndex ? theme.accent : theme.dim}
              inverse={index === autocomplete.selectedIndex}
            >
              {suggestion}
            </Text>
            <Text dimColor> — {COMMAND_DESCRIPTIONS[suggestion] || ''}</Text>
          </Box>
        ))}
      </Box>
    );
  };

  // Render content with cursor
  const renderContent = () => {
    if (isEmpty) {
      return <Text dimColor>{placeholder}</Text>;
    }

    return (
      <Box flexDirection="column">
        {lines.map((line, rowIndex) => {
          if (rowIndex !== cursor.row) {
            return <Text key={rowIndex}>{line || ' '}</Text>;
          }

          // Current line with cursor
          const before = line.slice(0, cursor.col);
          const cursorChar = line[cursor.col] || ' ';
          const after = line.slice(cursor.col + 1);
          const isAtEnd = cursor.col === line.length;

          if (isAtEnd) {
            return <Text key={rowIndex}>{line}</Text>;
          } else {
            return (
              <Text key={rowIndex}>
                {before}
                <Text inverse>{cursorChar}</Text>
                {after}
              </Text>
            );
          }
        })}
        {isTyping && (
          <Text dimColor italic> ✍️ typing...</Text>
        )}
      </Box>
    );
  };

  return (
    <Box flexDirection="column">
      {/* Autocomplete suggestions */}
      {renderAutocomplete()}

      {/* Main input area */}
      <Box
        borderStyle="single"
        borderColor={isMultiline ? theme.accent : undefined}
        paddingX={1}
        flexDirection="column"
      >
        <Box flexDirection="row">
          <Text bold color="blue">
            {'> '}
          </Text>
          <Box flexGrow={1}>
            {renderContent()}
          </Box>
        </Box>

        {/* Status line for multiline mode */}
        {isMultiline && (
          <Text dimColor>
            Line {cursor.row + 1}/{lines.length} • Shift+Enter: new line • Enter: send
          </Text>
        )}
      </Box>
    </Box>
  );
});

// Keep the old component for backward compatibility
export { EnhancedInputBox as InputBox };