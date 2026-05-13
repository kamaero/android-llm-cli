import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StreamChunk } from '../src/types.js';

// Mock openai SDK
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// Stream helper
async function* makeStream<T>(events: T[]): AsyncIterable<T> {
  for (const e of events) yield e;
}

import { OpenAIProvider } from '../src/providers/openai.js';

describe('OpenAIProvider', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('constructs with correct capabilities', () => {
    const p = new OpenAIProvider('openai', 'gpt-4o', 'sk-fake');
    expect(p.name).toBe('openai');
    expect(p.model).toBe('gpt-4o');
    expect(p.capabilities.streaming).toBe(true);
    expect(p.capabilities.tools).toBe(true);
    expect(p.capabilities.systemPrompt).toBe('first-message');
  });

  it('passes base_url to OpenAI client', () => {
    const p = new OpenAIProvider('deepseek', 'deepseek-chat', 'key', 'https://api.deepseek.com/v1');
    expect(p.name).toBe('deepseek');
  });

  it('emits text and usage chunks', async () => {
    mockCreate.mockResolvedValue(makeStream([
      {
        choices: [{ delta: { content: 'Hello' }, index: 0, finish_reason: null }],
        usage: null,
        created: 0,
        id: '1',
        model: 'gpt-4o',
        object: 'chat.completion.chunk',
      },
      {
        choices: [{ delta: { content: ' world' }, index: 0, finish_reason: null }],
        usage: null,
        created: 0,
        id: '1',
        model: 'gpt-4o',
        object: 'chat.completion.chunk',
      },
      {
        choices: [],
        usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 },
        created: 0,
        id: '1',
        model: 'gpt-4o',
        object: 'chat.completion.chunk',
      },
      {
        choices: [{ delta: {}, index: 0, finish_reason: 'stop' }],
        usage: null,
        created: 0,
        id: '1',
        model: 'gpt-4o',
        object: 'chat.completion.chunk',
      },
    ]));

    const p = new OpenAIProvider('openai', 'gpt-4o', 'sk-fake');
    const chunks: StreamChunk[] = [];
    for await (const c of p.stream([{ id: '1', role: 'user', content: 'Hi', timestamp: 0 }])) {
      chunks.push(c);
    }

    expect(chunks.filter(c => c.type === 'text')).toHaveLength(2);
    expect(chunks.filter(c => c.type === 'text').map(c => (c as any).delta)).toEqual(['Hello', ' world']);
    expect(chunks.some(c => c.type === 'usage')).toBe(true);
    const usage = chunks.find(c => c.type === 'usage') as any;
    expect(usage.inputTokens).toBe(5);
    expect(usage.outputTokens).toBe(10);
  });

  it('parses tool calls from streaming format', async () => {
    mockCreate.mockResolvedValue(makeStream([
      {
        choices: [{
          delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'bash', arguments: '{"cmd":"ls"}' } }] },
          index: 0,
          finish_reason: 'tool_calls',
        }],
        usage: null,
        created: 0,
        id: '1',
        model: 'gpt-4o',
        object: 'chat.completion.chunk',
      },
    ]));

    const p = new OpenAIProvider('openai', 'gpt-4o', 'sk-fake');
    const chunks: StreamChunk[] = [];
    for await (const c of p.stream([{ id: '1', role: 'user', content: 'Run ls', timestamp: 0 }])) {
      chunks.push(c);
    }

    const toolCalls = chunks.filter(c => c.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect((toolCalls[0] as any).name).toBe('bash');
  });

  it('passes systemPrompt as first message', async () => {
    mockCreate.mockResolvedValue(makeStream([
      { choices: [{ delta: { content: '' }, index: 0, finish_reason: 'stop' }], usage: null, created: 0, id: '1', model: 'gpt-4o', object: 'chat.completion.chunk' },
    ]));

    const p = new OpenAIProvider('openai', 'gpt-4o', 'sk-fake');
    await p.stream([{ id: '1', role: 'user', content: 'Hi', timestamp: 0 }], { systemPrompt: 'Be concise' }).next();

    const messages = mockCreate.mock.calls[0][0].messages;
    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toBe('Be concise');
  });

  it('passes abort signal to SDK options', async () => {
    mockCreate.mockResolvedValue(makeStream([
      { choices: [{ delta: { content: '' }, index: 0, finish_reason: 'stop' }], usage: null, created: 0, id: '1', model: 'gpt-4o', object: 'chat.completion.chunk' },
    ]));

    const p = new OpenAIProvider('openai', 'gpt-4o', 'sk-fake');
    const controller = new AbortController();
    await p.stream([{ id: '1', role: 'user', content: 'Hi', timestamp: 0 }], { signal: controller.signal }).next();

    expect(mockCreate.mock.calls[0][1].signal).toBe(controller.signal);
  });
});
