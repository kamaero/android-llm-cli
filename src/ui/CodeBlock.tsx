import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

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

// Tracks which language modules have been registered so we skip re-importing.
const loadedLangs = new Set<string>();

/**
 * Parse highlight.js HTML output into a flat token stream.
 * Tracks a class stack to handle nested <span> elements correctly.
 */
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

/** Split a token stream at newlines so we can render each line as a row. */
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
  // Drop a trailing empty line that highlight.js sometimes emits.
  if (lines[lines.length - 1]!.length === 0 && lines.length > 1) lines.pop();
  return lines;
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const [lines, setLines] = useState<Token[][] | null>(null);

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
    <Box borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
      {lang ? <Text bold>{lang}</Text> : null}
      {lines === null
        ? plainLines.map((line, i) => (
            <Text key={i} color="cyan">{line}</Text>
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
