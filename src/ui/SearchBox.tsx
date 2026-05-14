import React, { useState, useCallback, memo } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../theme.js';
import type { Message } from '../types.js';

export interface SearchResult {
  messageId: string;
  messageIndex: number;
  snippet: string;
  matches: Array<{ start: number; length: number }>;
}

interface SearchBoxProps {
  messages: Message[];
  isActive: boolean;
  onClose: () => void;
  onResultSelect: (messageIndex: number) => void;
}

export const SearchBox = memo(function SearchBox({
  messages,
  isActive,
  onClose,
  onResultSelect,
}: SearchBoxProps) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [selectedResult, setSelectedResult] = useState(0);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);

  // Perform search
  const searchResults = useCallback((): SearchResult[] => {
    if (!query.trim()) return [];

    const results: SearchResult[] = [];
    let searchRegex: RegExp;

    try {
      if (useRegex) {
        searchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi');
      } else {
        const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        searchRegex = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
      }
    } catch (error) {
      // Invalid regex, treat as literal string
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      searchRegex = new RegExp(escapedQuery, caseSensitive ? 'g' : 'gi');
    }

    messages.forEach((message, index) => {
      const content = message.content;
      const matches: Array<{ start: number; length: number }> = [];
      let match;

      // Reset regex state
      searchRegex.lastIndex = 0;

      while ((match = searchRegex.exec(content)) !== null) {
        matches.push({
          start: match.index,
          length: match[0].length,
        });

        // Prevent infinite loop with zero-length matches
        if (match[0].length === 0) {
          searchRegex.lastIndex++;
        }
      }

      if (matches.length > 0) {
        // Create snippet around first match
        const firstMatch = matches[0];
        const snippetStart = Math.max(0, firstMatch.start - 30);
        const snippetEnd = Math.min(content.length, firstMatch.start + firstMatch.length + 30);
        const snippet = content.slice(snippetStart, snippetEnd);

        results.push({
          messageId: message.id,
          messageIndex: index,
          snippet: snippetStart > 0 ? '...' + snippet : snippet,
          matches: matches.map(m => ({
            start: m.start - snippetStart,
            length: m.length,
          })),
        });
      }
    });

    return results.slice(0, 10); // Limit to 10 results
  }, [query, messages, caseSensitive, useRegex]);

  const results = searchResults();

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (!isActive) return;

      if (key.escape) {
        onClose();
        return;
      }

      if (key.return) {
        if (results.length > 0 && selectedResult < results.length) {
          onResultSelect(results[selectedResult].messageIndex);
          onClose();
        }
        return;
      }

      if (key.upArrow) {
        setSelectedResult(prev => Math.max(0, prev - 1));
        return;
      }

      if (key.downArrow) {
        setSelectedResult(prev => Math.min(results.length - 1, prev + 1));
        return;
      }

      if (key.backspace) {
        setQuery(prev => prev.slice(0, -1));
        setSelectedResult(0);
        return;
      }

      // Toggle case sensitivity with Ctrl+Shift+C
      if (key.ctrl && key.shift && input === 'c') {
        setCaseSensitive(prev => !prev);
        return;
      }

      // Toggle regex mode with Ctrl+Shift+R
      if (key.ctrl && key.shift && input === 'r') {
        setUseRegex(prev => !prev);
        return;
      }

      // Regular character input
      if (!key.ctrl && !key.meta && input) {
        setQuery(prev => prev + input);
        setSelectedResult(0);
      }
    },
    { isActive }
  );

  // Render highlighted snippet
  const renderSnippet = (result: SearchResult): React.ReactNode => {
    if (result.matches.length === 0) {
      return <Text>{result.snippet}</Text>;
    }

    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    result.matches.forEach((match, i) => {
      // Add text before match
      if (match.start > lastEnd) {
        elements.push(
          <Text key={`text-${i}`}>
            {result.snippet.slice(lastEnd, match.start)}
          </Text>
        );
      }

      // Add highlighted match
      elements.push(
        <Text key={`match-${i}`} inverse color={theme.warning}>
          {result.snippet.slice(match.start, match.start + match.length)}
        </Text>
      );

      lastEnd = match.start + match.length;
    });

    // Add remaining text
    if (lastEnd < result.snippet.length) {
      elements.push(
        <Text key="text-end">
          {result.snippet.slice(lastEnd)}
        </Text>
      );
    }

    return <>{elements}</>;
  };

  return (
    <Box flexDirection="column" borderStyle="double" borderColor={theme.accent} paddingX={1}>
      {/* Header */}
      <Box flexDirection="row" justifyContent="space-between">
        <Text bold color={theme.accent}>🔍 Search Messages</Text>
        <Text dimColor>ESC: close</Text>
      </Box>

      {/* Search input */}
      <Box flexDirection="row" marginTop={1}>
        <Text bold color={theme.accent}>Query: </Text>
        <Text>{query}</Text>
        <Text>█</Text> {/* Cursor */}
      </Box>

      {/* Search options */}
      <Box flexDirection="row" columnGap={2}>
        <Text dimColor>
          Ctrl+Shift+C: {caseSensitive ? '[✓] Case sensitive' : '[ ] Case sensitive'}
        </Text>
        <Text dimColor>
          Ctrl+Shift+R: {useRegex ? '[✓] Regex' : '[ ] Regex'}
        </Text>
      </Box>

      {/* Results */}
      {query.trim() && (
        <Box flexDirection="column" marginTop={1}>
          <Text bold>
            {results.length} result{results.length === 1 ? '' : 's'}
          </Text>

          {results.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              {results.map((result, index) => (
                <Box
                  key={result.messageId}
                  flexDirection="column"
                  borderStyle={index === selectedResult ? "single" : undefined}
                  borderColor={index === selectedResult ? theme.accent : undefined}
                  paddingX={index === selectedResult ? 1 : 0}
                  marginBottom={1}
                >
                  <Box flexDirection="row">
                    <Text bold color={theme.dim}>
                      Message #{result.messageIndex + 1}
                    </Text>
                    <Text dimColor> • </Text>
                    <Text dimColor>
                      {messages[result.messageIndex].role}
                    </Text>
                  </Box>
                  <Box marginLeft={2}>
                    {renderSnippet(result)}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Help text */}
      <Box marginTop={1}>
        <Text dimColor>
          ↑↓: navigate • Enter: jump to message • ESC: close
        </Text>
      </Box>
    </Box>
  );
});