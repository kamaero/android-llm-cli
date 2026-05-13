import { describe, expect, it, vi } from 'vitest';

import { BASH_OUTPUT_BUFFER_MAX, TOOL_RESULT_MAX_BYTES } from '../src/constants.js';
import { BashTool, filterEnv } from '../src/tools/bash.js';
import type { ToolContext } from '../src/types.js';

function makeContext(signal: AbortSignal, overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    signal,
    workspaceRoot: process.cwd(),
    ...overrides,
  };
}

describe('filterEnv', () => {
  it('keeps only whitelisted variables', () => {
    expect(
      filterEnv({
        PATH: '/usr/bin',
        HOME: '/tmp/home',
        TERM: 'xterm-256color',
        FOO: 'bar',
      }),
    ).toEqual({
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      TERM: 'xterm-256color',
    });
  });

  it('removes blacklisted variables even after whitelist passes', () => {
    expect(
      filterEnv({
        PATH: '/usr/bin',
        HOME: '/tmp/home',
        SHELL: '/bin/sh',
        API_TOKEN: 'secret',
        TERM: 'xterm',
      }),
    ).toEqual({
      PATH: '/usr/bin',
      HOME: '/tmp/home',
      SHELL: '/bin/sh',
      TERM: 'xterm',
    });
  });
});

describe('BashTool', () => {
  const tool = new BashTool();

  it('runs a command and returns stdout', async () => {
    const result = await tool.execute(
      { command: 'echo hello' },
      makeContext(new AbortController().signal),
    );

    expect(result).toBe('exit code: 0\nstdout:\nhello\n');
  });

  it('reports non-zero exit codes', async () => {
    const result = await tool.execute(
      { command: 'exit 7' },
      makeContext(new AbortController().signal),
    );

    expect(result).toContain('exit code: 7');
  });

  it('terminates on timeout and reports timeout', async () => {
    const result = await tool.execute(
      { command: 'sleep 5', timeout_ms: 200 },
      makeContext(new AbortController().signal),
    );

    expect(result).toContain('exit code: 124');
    expect(result).toContain('timeout');
  });

  it('kills the child on abort without leaking handles', async () => {
    const controller = new AbortController();
    const promise = tool.execute(
      { command: `node -e "setInterval(() => {}, 1000)"` },
      makeContext(controller.signal),
    );

    setTimeout(() => controller.abort(), 100);

    await expect(promise).resolves.toContain('aborted');

    await vi.waitFor(() => {
      const processHandles = process
        ._getActiveHandles()
        .filter((handle) => handle?.constructor?.name === 'ChildProcess');
      expect(processHandles).toHaveLength(0);
    });
  });

  it('truncates oversized output returned to the model', async () => {
    const payloadSize = BASH_OUTPUT_BUFFER_MAX + 2048;
    const result = await tool.execute(
      {
        command: `yes x | head -c ${payloadSize}`,
      },
      makeContext(new AbortController().signal),
    );

    expect(Buffer.byteLength(result, 'utf8')).toBeLessThanOrEqual(TOOL_RESULT_MAX_BYTES);
    expect(result).toContain('[...truncated,');
  });

  it('filters secrets from the subprocess environment', async () => {
    const original = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = original ?? 'sk-test-secret';

    try {
      const result = await tool.execute(
        { command: 'echo $ANTHROPIC_API_KEY' },
        makeContext(new AbortController().signal),
      );

      expect(result).toBe('exit code: 0\nstdout:\n\n');
    } finally {
      if (original === undefined) {
        delete process.env.ANTHROPIC_API_KEY;
      } else {
        process.env.ANTHROPIC_API_KEY = original;
      }
    }
  });
});
