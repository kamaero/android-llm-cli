import React from 'react';
import { describe, expect, it } from 'vitest';
import type { AppState, Message, Session, ToolCall } from '../src/types.js';

import { appReducer } from '../src/app.js';
import type { ConfigType } from '../src/schemas.js';

function makeConfig(): ConfigType {
  return {
    default_provider: 'primary',
    default_mode: 'chat',
    environment: { type: 'termux', include_builtin_context: true },
    session_policy: {
      profile: 'safe-chat', workspace_root: '/workspace', dry_run_first: true,
      bash_confirmation: 'always', file_confirmation: 'always',
      network_confirmation: 'always', peripheral_confirmation: 'always',
    },
    providers: {
      primary: { type: 'openai', api_key: 'test-key', model: 'gpt-test' },
    },
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'session-1', title: '', provider: 'primary', model: 'gpt-test',
    mode: 'chat', messages: [], createdAt: 0, updatedAt: 0, ...overrides,
  };
}

function makeState(overrides: Partial<AppState> = {}): AppState {
  return {
    session: makeSession(), status: 'idle', pendingToolCall: undefined, ...overrides,
  };
}

describe('appReducer', () => {
  it('creates a configured session on first user message', () => {
    const state = makeState();
    const message: Message = { id: 'user-1', role: 'user', content: 'Hello from user', timestamp: 1 };
    const next = appReducer(state, { type: 'ADD_USER_MESSAGE', message }, makeConfig());
    expect(next.session.provider).toBe('primary');
    expect(next.session.model).toBe('gpt-test');
    expect(next.session.title).toBe('Hello from user');
    expect(next.session.messages).toEqual([message]);
  });

  it('ADD_USER_MESSAGE appends to existing session', () => {
    const session = makeSession({ messages: [{ id: 'm1', role: 'user', content: 'first', timestamp: 1 }] });
    const state = makeState({ session });
    const msg2: Message = { id: 'm2', role: 'user', content: 'second', timestamp: 2 };
    const next = appReducer(state, { type: 'ADD_USER_MESSAGE', message: msg2 }, makeConfig());
    expect(next.session.messages).toHaveLength(2);
    expect(next.session.messages[1].content).toBe('second');
  });

  it('START_STREAMING sets status and adds empty assistant message', () => {
    const state = makeState();
    const next = appReducer(state, { type: 'START_STREAMING' }, makeConfig());
    expect(next.status).toBe('streaming');
    const lastMsg = next.session.messages.at(-1);
    expect(lastMsg?.role).toBe('assistant');
    expect(lastMsg?.content).toBe('');
  });

  it('APPEND_TEXT appends to assistant message', () => {
    const session = makeSession({ messages: [{ id: 'a1', role: 'assistant', content: 'Hi', timestamp: 0 }] });
    const state = makeState({ session, status: 'streaming' });
    const next = appReducer(state, { type: 'APPEND_TEXT', delta: ' there' }, makeConfig());
    expect(next.session.messages.at(-1)?.content).toBe('Hi there');
  });

  it('SET_TOOL_CALL sets awaiting-tool-confirm status', () => {
    const state = makeState({ status: 'streaming' });
    const toolCall: ToolCall = { id: 'tc-1', name: 'bash', input: { command: 'ls' } };
    const next = appReducer(state, { type: 'SET_TOOL_CALL', toolCall }, makeConfig());
    expect(next.status).toBe('awaiting-tool-confirm');
    expect(next.pendingToolCall?.call).toEqual(toolCall);
  });

  it('CONFIRM_TOOL sets idle status', () => {
    const toolCall: ToolCall = { id: 'tc-1', name: 'bash', input: { command: 'ls' } };
    const state = makeState({ status: 'awaiting-tool-confirm', pendingToolCall: { call: toolCall } });
    const next = appReducer(state, { type: 'CONFIRM_TOOL', toolCallId: 'tc-1' }, makeConfig());
    expect(next.status).toBe('idle');
    expect(next.pendingToolCall).toBeUndefined();
  });

  it('REJECT_TOOL sets idle and clears pending', () => {
    const toolCall: ToolCall = { id: 'tc-2', name: 'bash', input: { cmd: 'rm' } };
    const state = makeState({ status: 'awaiting-tool-confirm', pendingToolCall: { call: toolCall } });
    const next = appReducer(state, { type: 'REJECT_TOOL', toolCallId: 'tc-2' }, makeConfig());
    expect(next.status).toBe('idle');
    expect(next.pendingToolCall).toBeUndefined();
  });

  it('SET_USAGE sets tokens on last assistant message', () => {
    const session = makeSession({ messages: [{ id: 'a1', role: 'assistant', content: 'hello', timestamp: 0 }] });
    const state = makeState({ session, status: 'streaming' });
    const next = appReducer(state, { type: 'SET_USAGE', inputTokens: 10, outputTokens: 20 }, makeConfig());
    expect(next.session.messages.at(-1)?.tokens).toBe(30);
  });

  it('STOP_STREAMING sets idle', () => {
    const state = makeState({ status: 'streaming' });
    const next = appReducer(state, { type: 'STOP_STREAMING' }, makeConfig());
    expect(next.status).toBe('idle');
  });

  it('SET_ERROR sets error status', () => {
    const state = makeState({ status: 'streaming' });
    const next = appReducer(state, { type: 'SET_ERROR', error: 'API timeout' }, makeConfig());
    expect(next.status).toBe('error');
    expect(next.error).toBe('API timeout');
  });

  it('SET_TOOL_RESULT adds tool message', () => {
    const state = makeState({ status: 'streaming' });
    const next = appReducer(state, { type: 'SET_TOOL_RESULT', toolResult: { tool_call_id: 'tc-1', output: 'done' } }, makeConfig());
    const toolMsg = next.session.messages.find(m => m.role === 'tool');
    expect(toolMsg).toBeDefined();
    expect(toolMsg?.tool_result?.output).toBe('done');
  });
});
