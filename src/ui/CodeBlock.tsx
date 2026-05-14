import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { useTheme } from '../theme.js';
import { useClipboard, useToast } from './NotificationToast.js';

export interface CodeBlockProps {
  code: string;
  lang?: string;
}

type Token = { text: string; color?: string };

const CLASS_TO_COLOR: Record<string, string> = {
  'hljs-keyword': 'magenta',
  'hljs-string': 'green',
  'hljs-number': 'yellow',
  'hljs-comment': 'gray',
  'hljs-built_in': 'cyan',
  'hljs-title': 'blue',
};

const loadedLangs = new Set<string>();

function htmlToTokens(html: string): Token[] {
  const tokens: Token[] = [];
  const classStack: string[] = [];
  const re = /(<span class="([^"]+)">|<\/span>|([^<]+))/g;

  for (const m of html.matchAll(re)) {
    if (m[2] !== undefined) {
      classStack.push(m[2]!);
    } else if (m[0] === '</span>') {
      classStack.pop();
    } else if (m[3] !== undefined) {
      const text = m[3]!
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'");
      if (!text) continue;
      const cls = classStack[classStack.length - 1];
      const color = cls ? CLASS_TO_COLOR[cls] : undefined;
      tokens.push({ text, color });
    }
  }
  return tokens;
}

function splitIntoLines(tokens: Token[]): Token[][] {
  const lines: Token[][] = [[]];
  for (const token of tokens) {
    const parts = token.text.split('\n');
    for (let i = 0; i < parts.length; i++) {
      if (i > 0) lines.push([]);
      const part = parts[i]!;
      if (part) lines[lines.length - 1]!.push({ text: part, color: token.color });
    }
  }
  if (lines[lines.length - 1]!.length === 0 && lines.length > 1) lines.pop();
  return lines;
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const theme = useTheme();
  const [lines, setLines] = useState<Token[][] | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const { copyToClipboard } = useClipboard();
  const toast = useToast();

  // Handle Ctrl+C to copy code
  useInput((input, key) => {
    if (key.ctrl && input === 'c' && isFocused) {
      copyToClipboard(code, `${lang || 'Code'} block`);
    }
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 200));

      const highlight = async (): Promise<Token[][]> => {
        const { default: hljs } = await import('highlight.js/lib/core');

        if (lang && lang !== 'text' && !loadedLangs.has(lang)) {
          try {
            const mod = await import(`highlight.js/lib/languages/${lang}`);
            hljs.registerLanguage(lang, mod.default);
            loadedLangs.add(lang);
          } catch {
            // unsupported language → auto-detect fallback
          }
        }

        const html =
          lang && loadedLangs.has(lang)
            ? hljs.highlight(code, { language: lang }).value
            : hljs.highlightAuto(code).value;

        return splitIntoLines(htmlToTokens(html));
      };

      const result = await Promise.race([highlight(), timeout]);
      if (!cancelled && result !== null) {
        setLines(result);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [code, lang]);

  const plainLines = code.split('\n');

  return (
    <Box
      borderStyle="single"
      borderColor={theme.code}
      flexDirection="column"
      paddingX={1}
    >
      {/* Header with language and copy hint */}
      <Box flexDirection="row" justifyContent="space-between">
        {lang ? <Text bold color={theme.accent}>{lang}</Text> : <Box />}
        <Text dimColor>📋 copyable</Text>
      </Box>

      {/* Code content */}
      {lines === null
        ? plainLines.map((line, i) => (
            <Text key={i} color={theme.accent}>{line}</Text>
          ))
        : lines.map((lineTokens, i) => (
            <Text key={i}>
              {lineTokens.length === 0
                ? ' '
                : lineTokens.map((tok, j) => (
                    <Text key={j} color={tok.color}>{tok.text}</Text>
                  ))}
            </Text>
          ))}
    </Box>
  );
}
