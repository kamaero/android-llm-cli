import { describe, expect, it } from 'vitest';
import { MockProvider } from '../src/providers/mock.js';
import type { Message } from '../src/types.js';

describe('MockProvider', () => {
  it('has correct identity', () => {
    const provider = new MockProvider();
    expect(provider.name).toBe('mock');
    expect(provider.model).toBe('mock-model');
  });

  it('has tools capability', () => {
    const provider = new MockProvider();
    expect(provider.capabilities.tools).toBe(true);
  });

  it('yields chat fixture: text → usage → done', async () => {
    const provider = new MockProvider('chat');
    const msg: Message = {
      id: '1',
      role: 'user',
      content: 'hello',
      timestamp: Date.now(),
    };
    const chunks: unknown[] = [];
    for await (const chunk of provider.stream([msg])) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(3);
    expect(chunks[0]).toMatchObject({ type: 'text', delta: 'Hello from mock!' });
    expect(chunks[1]).toMatchObject({ type: 'usage', inputTokens: 10, outputTokens: 5 });
    expect(chunks[2]).toMatchObject({ type: 'done' });
  });

  it('yields tool_call fixture: text → tool_call → done', async () => {
    const provider = new MockProvider('tool_call');
    const msg: Message = {
      id: '1',
      role: 'user',
      content: 'run a command',
      timestamp: Date.now(),
    };
    const chunks: unknown[] = [];
    for await (const chunk of provider.stream([msg])) {
      chunks.push(chunk);
    }

    expect(chunks).toHaveLength(4);
    expect(chunks[0]).toMatchObject({ type: 'text', delta: 'Let me run that command for you.' });
    expect(chunks[1]).toMatchObject({
      type: 'tool_call',
      id: 'mock_tc_1',
      name: 'bash',
      input: { command: 'echo hello from mock' },
    });
    expect(chunks[2]).toMatchObject({ type: 'usage' });
    expect(chunks[3]).toMatchObject({ type: 'done' });
  });
});
