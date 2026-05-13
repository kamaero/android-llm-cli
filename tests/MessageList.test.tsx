import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { MessageList } from '../src/ui/MessageList.js';
import { MessageItem, parseInline } from '../src/ui/MessageItem.js';
import type { Message } from '../src/types.js';

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    timestamp: 0,
    ...overrides,
  };
}

// ── parseInline unit tests ────────────────────────────────────────────────────

describe('parseInline', () => {
  it('returns plain segment for plain text', () => {
    expect(parseInline('hello world')).toEqual([{ text: 'hello world' }]);
  });

  it('parses **bold** span', () => {
    const result = parseInline('hello **world** end');
    expect(result).toContainEqual({ text: 'world', bold: true });
  });

  it('parses `code` span', () => {
    const result = parseInline('run `npm install` now');
    expect(result).toContainEqual({ text: 'npm install', code: true });
  });

  it('parses *italic* span', () => {
    const result = parseInline('this is *important*');
    expect(result).toContainEqual({ text: 'important', italic: true });
  });

  it('parses _italic_ span', () => {
    const result = parseInline('_emphasis_');
    expect(result).toContainEqual({ text: 'emphasis', italic: true });
  });

  it('preserves surrounding plain text segments', () => {
    const result = parseInline('before **bold** after');
    const texts = result.map((s) => s.text);
    expect(texts).toContain('before ');
    expect(texts).toContain(' after');
  });
});

// ── MessageItem rendering ─────────────────────────────────────────────────────

describe('MessageItem', () => {
  it('renders user message with "You" label and content', () => {
    const { lastFrame } = render(
      <MessageItem message={makeMessage({ role: 'user', content: 'Hi there' })} />,
    );
    expect(lastFrame()).toContain('You');
    expect(lastFrame()).toContain('Hi there');
  });

  it('renders assistant message with "Assistant" label and content', () => {
    const { lastFrame } = render(
      <MessageItem message={makeMessage({ role: 'assistant', content: 'I can help you.' })} />,
    );
    expect(lastFrame()).toContain('Assistant');
    expect(lastFrame()).toContain('I can help you.');
  });

  it('renders assistant markdown bold text', () => {
    const { lastFrame } = render(
      <MessageItem message={makeMessage({ role: 'assistant', content: '**bold word**' })} />,
    );
    expect(lastFrame()).toContain('bold word');
  });

  it('renders assistant markdown code span', () => {
    const { lastFrame } = render(
      <MessageItem message={makeMessage({ role: 'assistant', content: 'Use `npm install`' })} />,
    );
    expect(lastFrame()).toContain('npm install');
  });

  it('renders assistant markdown heading', () => {
    const { lastFrame } = render(
      <MessageItem message={makeMessage({ role: 'assistant', content: '# Section Title' })} />,
    );
    expect(lastFrame()).toContain('Section Title');
  });

  it('renders assistant markdown bullet list', () => {
    const { lastFrame } = render(
      <MessageItem message={makeMessage({ role: 'assistant', content: '- item one\n- item two' })} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('item one');
    expect(frame).toContain('item two');
  });

  it('renders assistant code fence block', () => {
    const content = '```ts\nconst x = 1;\n```';
    const { lastFrame } = render(
      <MessageItem message={makeMessage({ role: 'assistant', content })} />,
    );
    expect(lastFrame()).toContain('const x = 1;');
  });

  it('renders tool result message with output', () => {
    const { lastFrame } = render(
      <MessageItem
        message={makeMessage({
          role: 'tool',
          content: '',
          tool_result: { tool_call_id: 'tc-1', output: 'file contents here' },
        })}
      />,
    );
    expect(lastFrame()).toContain('file contents here');
    expect(lastFrame()).toContain('tool-result');
  });

  it('renders error tool result', () => {
    const { lastFrame } = render(
      <MessageItem
        message={makeMessage({
          role: 'tool',
          content: '',
          tool_result: { tool_call_id: 'tc-1', output: 'Error: not found', is_error: true },
        })}
      />,
    );
    expect(lastFrame()).toContain('Error: not found');
  });

  it('renders assistant tool_calls frame', () => {
    const { lastFrame } = render(
      <MessageItem
        message={makeMessage({
          role: 'assistant',
          content: 'Running tool',
          tool_calls: [{ id: 'tc-1', name: 'bash', input: { cmd: 'ls' } }],
        })}
      />,
    );
    expect(lastFrame()).toContain('bash');
  });
});

// ── MessageList ───────────────────────────────────────────────────────────────

describe('MessageList', () => {
  it('shows empty state when no messages', () => {
    const { lastFrame } = render(<MessageList messages={[]} />);
    expect(lastFrame()).toContain('No messages yet');
  });

  it('renders all messages in order', () => {
    const messages: Message[] = [
      makeMessage({ id: '1', role: 'user', content: 'First message' }),
      makeMessage({ id: '2', role: 'assistant', content: 'Second message' }),
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('First message');
    expect(frame).toContain('Second message');
    expect(frame.indexOf('First message')).toBeLessThan(frame.indexOf('Second message'));
  });

  it('shows "older messages" indicator when over MAX_VISIBLE (50)', () => {
    const messages: Message[] = Array.from({ length: 55 }, (_, i) =>
      makeMessage({ id: String(i), content: `Message ${i}` }),
    );
    const { lastFrame } = render(<MessageList messages={messages} />);
    expect(lastFrame()).toContain('older message');
  });

  it('shows all messages when under limit', () => {
    const messages: Message[] = [
      makeMessage({ id: '1', content: 'alpha' }),
      makeMessage({ id: '2', content: 'beta' }),
    ];
    const { lastFrame } = render(<MessageList messages={messages} />);
    const frame = lastFrame() ?? '';
    expect(frame).toContain('alpha');
    expect(frame).toContain('beta');
    expect(frame).not.toContain('older message');
  });
});
