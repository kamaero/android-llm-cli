import React from 'react';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from 'ink-testing-library';
import { App } from '../src/app.js';
import { getDataDir } from '../src/paths.js';
import {
  appendWalEntry,
  loadSession,
  saveSession,
  scanWalFiles,
} from '../src/storage/session.js';
import type { ConfigType } from '../src/schemas.js';
import type { Session } from '../src/types.js';

function makeTempDataDir(): string {
  const dir = join(tmpdir(), `a-llmcli-recovery-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeConfig(): ConfigType {
  return {
    default_provider: 'primary',
    default_mode: 'chat',
    environment: { type: 'termux', include_builtin_context: true },
    session_policy: {
      profile: 'safe-chat',
      workspace_root: '/workspace',
      dry_run_first: true,
      bash_confirmation: 'always',
      file_confirmation: 'always',
      network_confirmation: 'always',
      peripheral_confirmation: 'always',
    },
    providers: {
      primary: { type: 'openai', api_key: 'test-key', model: 'gpt-test' },
    },
  };
}

function makeSession(id: string, userContent = 'Recover this interrupted session please.'): Session {
  const now = Date.now();

  return {
    id,
    title: userContent.slice(0, 60),
    provider: 'primary',
    model: 'gpt-test',
    mode: 'chat',
    messages: [
      {
        id: randomUUID(),
        role: 'user',
        content: userContent,
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

async function flushInk(): Promise<void> {
  await new Promise<void>((resolve) => setImmediate(resolve));
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function walFilePath(id: string): string {
  return join(getDataDir(), 'sessions', `${id}.wal`);
}

describe('crash recovery', () => {
  let dataDir: string;

  beforeEach(() => {
    dataDir = makeTempDataDir();
    process.env.XDG_DATA_HOME = dataDir;
  });

  afterEach(() => {
    if (existsSync(dataDir)) {
      rmSync(dataDir, { recursive: true, force: true });
    }
    delete process.env.XDG_DATA_HOME;
  });

  it('scanWalFiles finds orphan WALs with previews', () => {
    const sessionId = randomUUID();
    saveSession(makeSession(sessionId, 'First user message for preview extraction.'));
    appendWalEntry(sessionId, { type: 'text', delta: 'Partial assistant reply' });
    appendWalEntry(sessionId, { type: 'done' });

    expect(scanWalFiles()).toEqual([
      {
        id: sessionId,
        preview: 'First user message for preview extraction.',
      },
    ]);
  });

  it('shows the recovery prompt on startup and skips it on S', async () => {
    const sessionId = randomUUID();
    saveSession(makeSession(sessionId));
    appendWalEntry(sessionId, { type: 'text', delta: 'Partial assistant reply' });

    const view = render(<App config={makeConfig()} />);
    await flushInk();

    expect(view.lastFrame()).toContain('Recovery available');
    expect(view.lastFrame()).toContain('Found 1 orphan session');
    expect(view.lastFrame()).toContain('Recover this interrupted session please.');

    view.stdin.write('s');
    await flushInk();

    expect(view.lastFrame()).toContain('gpt-test');
    expect(existsSync(walFilePath(sessionId))).toBe(true);
    view.unmount();
  });

  it('recovers orphan WALs on Y', async () => {
    const sessionId = randomUUID();
    saveSession(makeSession(sessionId));
    appendWalEntry(sessionId, { type: 'text', delta: 'Recovered reply' });
    appendWalEntry(sessionId, { type: 'text', delta: ' after crash' });
    appendWalEntry(sessionId, { type: 'done' });

    const view = render(<App config={makeConfig()} />);
    await flushInk();

    view.stdin.write('y');
    await flushInk();

    const recovered = loadSession(sessionId);
    expect(recovered.messages.at(-1)?.role).toBe('assistant');
    expect(recovered.messages.at(-1)?.content).toBe('Recovered reply after crash');
    expect(existsSync(walFilePath(sessionId))).toBe(false);
    expect(view.lastFrame()).toContain('gpt-test');
    view.unmount();
  });

  it('discards orphan WALs on D', async () => {
    const sessionId = randomUUID();
    saveSession(makeSession(sessionId));
    appendWalEntry(sessionId, { type: 'text', delta: 'Throw this away' });

    const view = render(<App config={makeConfig()} />);
    await flushInk();

    view.stdin.write('d');
    await flushInk();

    expect(existsSync(walFilePath(sessionId))).toBe(false);
    expect(view.lastFrame()).toContain('gpt-test');
    view.unmount();
  });
});
