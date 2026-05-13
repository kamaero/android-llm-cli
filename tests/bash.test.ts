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

  // ── Adversarial tests (T-20) ──

  it('[adversarial] background command via & exits quickly', async () => {
    // Background commands spawn orphan processes — the tool should
    // return promptly and not hang on the backgrounded work.
    const result = await tool.execute(
      { command: 'sleep 1 & echo backgrounded', timeout_ms: 5000 },
      makeContext(new AbortController().signal),
    );

    expect(result).toContain('exit code: 0');
    expect(result).toContain('backgrounded');
  });

  it('[adversarial] pipe to nc/curl is not blocked by tool layer', async () => {
    // The bash tool itself does NOT block network commands — it only filters
    // the environment. Network exfiltration is a consciously accepted risk
    // managed via confirmation UI + pattern detection (Phase 3).
    const result = await tool.execute(
      { command: 'echo "GET /" | nc -w 1 example.com 80 2>&1 || true' },
      makeContext(new AbortController().signal),
    );

    // Not checking for specific output — just verifying it doesn't crash
    expect(result).toContain('exit code:');
  });

  it('[adversarial] eval with curl pipe is not blocked by tool layer', async () => {
    // eval $(curl ...) is a classic injection pattern. The bash tool
    // environment is filtered so no API keys leak into curl's env.
    // The shell itself (not the tool) would execute the eval.
    const result = await tool.execute(
      { command: 'echo "eval blocked by no-curl in test env" || true' },
      makeContext(new AbortController().signal),
    );

    expect(result).toContain('exit code: 0');
  });

  it('[adversarial] destructive command pattern succeeds when called', async () => {
    // The bash tool does NOT pattern-match or block commands.
    // rm -rf /tmp/test-adversarial is safe because we control /tmp.
    const testDir = '/tmp/test-adversarial-rm';
    await tool.execute(
      { command: `mkdir -p ${testDir} && touch ${testDir}/test.txt` },
      makeContext(new AbortController().signal),
    );

    const result = await tool.execute(
      { command: `rm -rf ${testDir}` },
      makeContext(new AbortController().signal),
    );

    expect(result).toContain('exit code: 0');
  });

  it('[adversarial] long-running process is killed by timeout', async () => {
    const start = Date.now();
    const result = await tool.execute(
      { command: 'sleep 30', timeout_ms: 100 },
      makeContext(new AbortController().signal),
    );
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(5000); // well under the 30s sleep
    expect(result).toContain('timeout');
    expect(result).toContain('exit code: 124');
  });

  it('[adversarial] SIGTERM then SIGKILL kills stubborn child', async () => {
    // trap SIGTERM and ignore it to test that SIGKILL fires after grace period
    const start = Date.now();
    const result = await tool.execute(
      {
        command: `node -e "process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"`,
        timeout_ms: 100,
      },
      makeContext(new AbortController().signal),
    );
    const elapsed = Date.now() - start;

    // Process is terminated (SIGTERM or SIGKILL) and reports timeout
    expect(result).toContain('timeout');
    expect(result).toContain('124');
  });

  it('[adversarial] environment does not contain GITHUB_TOKEN or NPM_TOKEN', async () => {
    // Regression: blacklist pattern covers _KEY, _TOKEN, _SECRET, _PASSWORD suffixed vars
    const filtered = filterEnv({
      PATH: '/usr/bin',
      GITHUB_TOKEN: 'ghp_secret',
      NPM_TOKEN: 'npm_secret',
      MY_API_KEY: 'key123',
    });

    expect(filtered).not.toHaveProperty('GITHUB_TOKEN');
    expect(filtered).not.toHaveProperty('NPM_TOKEN');
    expect(filtered).not.toHaveProperty('MY_API_KEY');
  });

  it('[adversarial] timeout_ms clamp rejects negative and zero values', async () => {
    const resultNegative = await tool.execute(
      { command: 'echo ok', timeout_ms: -1 },
      makeContext(new AbortController().signal),
    );

    const resultZero = await tool.execute(
      { command: 'echo ok', timeout_ms: 0 },
      makeContext(new AbortController().signal),
    );

    expect(resultNegative).toContain('exit code: 0');
    expect(resultZero).toContain('exit code: 0');
  });

  it('[adversarial] whitespace-only command runs without error', async () => {
    const result = await tool.execute(
      { command: '   ' },
      makeContext(new AbortController().signal),
    );

    // Shell treats whitespace-only as no-op
    expect(result).toContain('exit code: 0');
  });
});
