import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from 'ink-testing-library';
import { Layout } from '../src/ui/Layout.js';
import { StatusBar } from '../src/ui/StatusBar.js';
import { InputBox } from '../src/ui/InputBox.js';
import type { AppState, AppAction, Session } from '../src/types.js';

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'test-id',
    title: 'Test session',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    mode: 'chat',
    messages: [],
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    session: makeSession(),
    status: 'idle',
    pendingToolCall: undefined,
    ...overrides,
  };
}

describe('StatusBar', () => {
  it('renders provider name', () => {
    const { lastFrame } = render(
      <StatusBar state={makeState()} />,
    );
    expect(lastFrame()).toContain('anthropic');
  });

  it('renders model name', () => {
    const { lastFrame } = render(
      <StatusBar state={makeState()} />,
    );
    expect(lastFrame()).toContain('claude-sonnet-4-6');
  });

  it('renders mode', () => {
    const { lastFrame } = render(
      <StatusBar state={makeState()} />,
    );
    expect(lastFrame()).toContain('chat');
  });

  it('shows streaming indicator when status is streaming', () => {
    const { lastFrame } = render(
      <StatusBar state={makeState({ status: 'streaming' })} />,
    );
    expect(lastFrame()).toContain('streaming');
  });

  it('shows error message when status is error', () => {
    const { lastFrame } = render(
      <StatusBar
        state={makeState({ status: 'error', error: 'API failure' })}
      />,
    );
    expect(lastFrame()).toContain('API failure');
  });

  it('shows token count', () => {
    const session = makeSession({
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'hello',
          timestamp: 0,
          tokens: 42,
        },
      ],
    });
    const { lastFrame } = render(
      <StatusBar state={makeState({ session })} />,
    );
    expect(lastFrame()).toContain('42');
  });
});

describe('InputBox', () => {
  it('renders placeholder when empty', () => {
    const dispatch = vi.fn() as React.Dispatch<AppAction>;
    const { lastFrame } = render(
      <InputBox dispatch={dispatch} placeholder="Type here…" />,
    );
    expect(lastFrame()).toContain('Type here…');
  });

  it('displays typed characters', async () => {
    const dispatch = vi.fn() as React.Dispatch<AppAction>;
    const { lastFrame, stdin } = render(
      <InputBox dispatch={dispatch} />,
    );
    // Flush useEffect so useInput's setRawMode registers the stdin listener
    await new Promise<void>((resolve) => setImmediate(resolve));
    stdin.write('hello');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(lastFrame()).toContain('hello');
  });

  it('hides placeholder once text is entered', async () => {
    const dispatch = vi.fn() as React.Dispatch<AppAction>;
    const { lastFrame, stdin } = render(
      <InputBox dispatch={dispatch} placeholder="Type here…" />,
    );
    await new Promise<void>((resolve) => setImmediate(resolve));
    stdin.write('x');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(lastFrame()).not.toContain('Type here…');
  });
});

describe('Layout', () => {
  it('renders StatusBar and InputBox', () => {
    const dispatch = vi.fn() as React.Dispatch<AppAction>;
    const { lastFrame } = render(
      <Layout state={makeState()} dispatch={dispatch} />,
    );
    const frame = lastFrame() ?? '';
    expect(frame).toContain('anthropic');
    expect(frame).toContain('chat');
  });

  it('matches snapshot', () => {
    const dispatch = vi.fn() as React.Dispatch<AppAction>;
    const { lastFrame } = render(
      <Layout state={makeState()} dispatch={dispatch} />,
    );
    expect(lastFrame()).toMatchSnapshot();
  });
});
