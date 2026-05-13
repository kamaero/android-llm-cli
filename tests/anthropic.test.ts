import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StreamChunk } from '../src/types.js';

// Mock @anthropic-ai/sdk before importing AnthropicProvider
const mockStream = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { stream: mockStream },
  })),
}));

// Stream helper
async function* makeStream<T>(events: T[]): AsyncIterable<T> {
  for (const e of events) yield e;
}

import { AnthropicProvider } from '../src/providers/anthropic.js';

describe('AnthropicProvider', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('constructs with correct capabilities', () => {
    const p = new AnthropicProvider('anthropic', 'claude-sonnet-4-6', 'sk-fake');
    expect(p.name).toBe('anthropic');
    expect(p.model).toBe('claude-sonnet-4-6');
    expect(p.capabilities.streaming).toBe(true);
    expect(p.capabilities.tools).toBe(true);
    expect(p.capabilities.systemPrompt).toBe('parameter');
  });

  it('stream emits text chunks', async () => {
    mockStream.mockReturnValue(makeStream([
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: ' world' } },
      { type: 'message_stop' },
    ]));

    const p = new AnthropicProvider('anthropic', 'claude-sonnet-4-6', 'sk-fake');
    const chunks: StreamChunk[] = [];
    for await (const c of p.stream([{ id: '1', role: 'user', content: 'Hi', timestamp: 0 }])) {
      chunks.push(c);
    }

    expect(chunks.filter(c => c.type === 'text')).toHaveLength(2);
    expect(chunks.filter(c => c.type === 'text').map(c => (c as any).delta)).toEqual(['Hello', ' world']);
    expect(chunks.some(c => c.type === 'done')).toBe(true);
  });

  it('stream emits tool_call chunk', async () => {
    mockStream.mockReturnValue(makeStream([
      {
        type: 'content_block_start', index: 0,
        content_block: { type: 'tool_use', id: 'tu_1', name: 'bash', input: { command: 'ls' } },
      },
      { type: 'message_stop' },
    ]));

    const p = new AnthropicProvider('anthropic', 'claude-sonnet-4-6', 'sk-fake');
    const chunks: StreamChunk[] = [];
    for await (const c of p.stream([{ id: '1', role: 'user', content: 'Run ls', timestamp: 0 }])) {
      chunks.push(c);
    }

    const toolCalls = chunks.filter(c => c.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect((toolCalls[0] as any).id).toBe('tu_1');
    expect((toolCalls[0] as any).name).toBe('bash');
  });

  it('stream emits usage chunk', async () => {
    mockStream.mockReturnValue(makeStream([
      { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { input_tokens: 10, output_tokens: 5 } },
      { type: 'message_stop' },
    ]));

    const p = new AnthropicProvider('anthropic', 'claude-sonnet-4-6', 'sk-fake');
    const chunks: StreamChunk[] = [];
    for await (const c of p.stream([{ id: '1', role: 'user', content: 'Hi', timestamp: 0 }])) {
      chunks.push(c);
    }

    const usage = chunks.find(c => c.type === 'usage') as any;
    expect(usage).toBeDefined();
    expect(usage.inputTokens).toBe(10);
    expect(usage.outputTokens).toBe(5);
  });

  it('passes systemPrompt to stream options', async () => {
    mockStream.mockReturnValue(makeStream([{ type: 'message_stop' }]));
    const p = new AnthropicProvider('anthropic', 'claude-sonnet-4-6', 'sk-fake');
    await p.stream([], { systemPrompt: 'Be helpful' }).next();
    expect(mockStream.mock.calls[0][0].system).toBe('Be helpful');
  });
});
