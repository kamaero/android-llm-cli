import React from 'react';
import { Box, Text } from 'ink';
import type { Message } from '../types.js';
import { CodeBlock } from './CodeBlock.js';

// ── Inline markdown ──────────────────────────────────────────────────────────

interface Segment {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
}

export function parseInline(line: string): Segment[] {
  const RE = /\*\*([^*]+)\*\*|_([^_]+)_|\*([^*]+)\*|`([^`]+)`/g;
  const segments: Segment[] = [];
  let last = 0;

  for (const match of line.matchAll(RE)) {
    const idx = match.index ?? 0;
    if (idx > last) {
      segments.push({ text: line.slice(last, idx) });
    }
    if (match[1] !== undefined) {
      segments.push({ text: match[1], bold: true });
    } else if (match[2] !== undefined) {
      segments.push({ text: match[2], italic: true });
    } else if (match[3] !== undefined) {
      segments.push({ text: match[3], italic: true });
    } else if (match[4] !== undefined) {
      segments.push({ text: match[4], code: true });
    }
    last = idx + match[0].length;
  }

  if (last < line.length) {
    segments.push({ text: line.slice(last) });
  }

  return segments.length > 0 ? segments : [{ text: line }];
}

function InlineText({ line }: { line: string }) {
  const segments = parseInline(line);
  return (
    <Text>
      {segments.map((seg, i) => (
        <Text
          key={i}
          bold={seg.bold}
          italic={seg.italic}
          color={seg.code ? 'cyan' : undefined}
        >
          {seg.text}
        </Text>
      ))}
    </Text>
  );
}

// ── Block-level markdown renderer ────────────────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) {
        codeLines.push(lines[i]!);
        i++;
      }
      blocks.push(
        <CodeBlock key={`cb-${i}`} code={codeLines.join('\n')} lang={lang || undefined} />,
      );
    } else if (/^#{1,3} /.test(line)) {
      const level = (line.match(/^(#+) /)?.[1].length) ?? 1;
      const text = line.replace(/^#+\s/, '');
      const headingColor = level === 1 ? 'yellow' : level === 2 ? 'green' : 'cyan';
      blocks.push(
        <Text key={`h-${i}`} bold color={headingColor}>{text}</Text>,
      );
    } else if (/^[-*] /.test(line)) {
      blocks.push(
        <Box key={`li-${i}`}>
          <Text color="yellow">• </Text>
          <InlineText line={line.slice(2)} />
        </Box>,
      );
    } else if (/^\d+\. /.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1] ?? '1';
      const text = line.replace(/^\d+\. /, '');
      blocks.push(
        <Box key={`ol-${i}`}>
          <Text color="yellow">{num}. </Text>
          <InlineText line={text} />
        </Box>,
      );
    } else if (line.trim() === '') {
      blocks.push(<Text key={`gap-${i}`}> </Text>);
    } else {
      blocks.push(<InlineText key={`p-${i}`} line={line} />);
    }

    i++;
  }

  return <Box flexDirection="column">{blocks}</Box>;
}

// ── MessageItem ───────────────────────────────────────────────────────────────

interface MessageItemProps {
  message: Message;
}

function MessageItemInner({ message }: MessageItemProps) {
  const { role, content, tool_result, tool_calls } = message;

  if (role === 'user') {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text bold color="blue">You</Text>
        <Box paddingLeft={2}>
          <Text>{content}</Text>
        </Box>
      </Box>
    );
  }

  if (role === 'tool') {
    const isError = tool_result?.is_error;
    return (
      <Box
        flexDirection="column"
        marginBottom={1}
        borderStyle="round"
        borderColor={isError ? 'red' : 'gray'}
        paddingX={1}
      >
        <Text bold color={isError ? 'red' : 'magenta'}>
          tool-result
        </Text>
        <Text color={isError ? 'red' : undefined}>
          {tool_result?.output ?? content}
        </Text>
      </Box>
    );
  }

  // assistant
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="green">Assistant</Text>
      <Box paddingLeft={2} flexDirection="column">
        <MarkdownContent content={content} />
        {tool_calls?.map((tc) => (
          <Box
            key={tc.id}
            borderStyle="round"
            borderColor="cyan"
            paddingX={1}
            marginTop={1}
            flexDirection="column"
          >
            <Text bold color="cyan">⚡ {tc.name}</Text>
            <Text dimColor>{JSON.stringify(tc.input, null, 2)}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

/**
 * Memoised message item — only re-renders if id, content, tool_calls, or tool result changes.
 * This is critical during streaming: only the last assistant message changes,
 * all previous messages are skipped.
 */
export const MessageItem = React.memo(MessageItemInner, (prev, next) => {
  const a = prev.message;
  const b = next.message;
  if (a.id !== b.id) return false;
  if (a.content !== b.content) return false;
  if (a.role !== b.role) return false;
  // Compare tool_result reference (immutable — same object = same data)
  if (a.tool_result !== b.tool_result) return false;
  // Compare tool_calls reference (new array created on each update)
  if (a.tool_calls !== b.tool_calls) return false;
  return true;
});
