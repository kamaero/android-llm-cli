import { spawn } from 'node:child_process';
import { Buffer } from 'node:buffer';
import { homedir } from 'node:os';

import { BASH_OUTPUT_BUFFER_MAX, TOOL_RESULT_MAX_BYTES } from '../constants.js';
import type { ITool, ToolContext } from '../types.js';
import { detectShell } from './shell.js';

const ENV_WHITELIST = new Set([
  'PATH',
  'HOME',
  'PREFIX',
  'LANG',
  'LC_ALL',
  'TZ',
  'TERM',
  'USER',
  'SHELL',
]);

/**
 * Expanded secret env-var detection.
 *
 * Stage 1 — classic underscore-suffixed:  OPENAI_API_KEY, GITHUB_TOKEN, NPM_TOKEN, etc.
 * Stage 2 — bare suffixes anywhere in name:  MYKEY, SECRET2, PASSWORD, TOKEN123
 * Stage 3 — common prefixes:  SECRET_, PWD_, KEY_
 *
 * Still allows common non-secret names like TIMEOUT, TIMESTAMP, PREFIX.
 */
const ENV_BLACKLIST_PATTERN = /(?:^.*_(API_KEY|KEY|TOKEN|SECRET|PASSWORD|PASSWD|PAT)$|(?:KEY|TOKEN|SECRET|PASSWORD|PASSWD|PAT)[0-9]*$|^SECRET_|^PWD_|^KEY_)/i;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;
const TIMEOUT_KILL_GRACE_MS = 2_000;

export function filterEnv(
  env: NodeJS.ProcessEnv,
): Record<string, string> {
  const filtered: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    if (!ENV_WHITELIST.has(key) || value === undefined) {
      continue;
    }

    filtered[key] = value;
  }

  for (const key of Object.keys(filtered)) {
    if (ENV_BLACKLIST_PATTERN.test(key)) {
      delete filtered[key];
    }
  }

  return filtered;
}

function clampTimeout(timeoutMs: number | undefined): number {
  if (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return DEFAULT_TIMEOUT_MS;
  }

  return Math.min(timeoutMs, MAX_TIMEOUT_MS);
}

function truncateUtf8(text: string, maxBytes: number, totalBytes: number): string {
  const marker = `\n[...truncated, ${totalBytes} bytes total]`;
  const textBytes = Buffer.byteLength(text, 'utf8');

  if (textBytes <= maxBytes) {
    return text;
  }

  const markerBytes = Buffer.byteLength(marker, 'utf8');

  if (markerBytes >= maxBytes) {
    return marker.slice(0, maxBytes);
  }

  const sliceBytes = maxBytes - markerBytes;
  const prefix = Buffer.from(text, 'utf8').subarray(0, sliceBytes).toString('utf8');
  return `${prefix}${marker}`;
}

function formatResult(exitCode: number, content: string): string {
  const prefix = `exit code: ${exitCode}\nstdout:\n`;
  const prefixBytes = Buffer.byteLength(prefix, 'utf8');
  const availableContentBytes = Math.max(0, TOOL_RESULT_MAX_BYTES - prefixBytes);
  const totalContentBytes = Buffer.byteLength(content, 'utf8');
  const resultContent = truncateUtf8(content, availableContentBytes, totalContentBytes);
  return `${prefix}${resultContent}`;
}

export class BashTool implements ITool {
  static readonly schema: Record<string, unknown> = {
    type: 'object',
    required: ['command'],
    properties: {
      command: {
        type: 'string',
        description:
          'Shell command to execute in Termux on Android. Prefer pkg/apt, $HOME, $PREFIX, and $PREFIX/tmp. Do not assume systemd, sudo, /bin/bash, or desktop tools.',
      },
      cwd: {
        type: 'string',
        description: 'Working directory. Defaults to $HOME.',
      },
      timeout_ms: {
        type: 'number',
        description: 'Override default 30000ms timeout. Max 300000.',
      },
    },
  };

  readonly name = 'bash';

  readonly description = 'Execute a shell command in the current Termux or POSIX shell with guarded environment and output limits.';

  get schema(): Record<string, unknown> {
    return BashTool.schema;
  }

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const command = typeof input.command === 'string' ? input.command : '';
    const cwd =
      typeof input.cwd === 'string'
        ? input.cwd
        : typeof ctx.cwd === 'string'
          ? ctx.cwd
          : homedir();
    const timeoutMs = clampTimeout(
      typeof input.timeout_ms === 'number' ? input.timeout_ms : ctx.timeoutMs,
    );
    const env = filterEnv(process.env);

    return await new Promise<string>((resolve, reject) => {
      let settled = false;
      let timedOut = false;
      let aborted = false;
      let totalBytes = 0;
      let storedBytes = 0;
      const chunks: Buffer[] = [];

      const child = spawn(detectShell(), ['-c', command], {
        cwd,
        env,
        signal: ctx.signal,
      });

      const appendChunk = (chunk: Buffer | string): void => {
        const data = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += data.length;

        if (storedBytes >= BASH_OUTPUT_BUFFER_MAX) {
          return;
        }

        const remaining = BASH_OUTPUT_BUFFER_MAX - storedBytes;
        const slice = data.subarray(0, remaining);
        storedBytes += slice.length;
        chunks.push(slice);
      };

      const finalize = (exitCode: number): void => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        clearTimeout(killId);

        let content = Buffer.concat(chunks, storedBytes).toString('utf8');

        if (totalBytes > storedBytes) {
          content = truncateUtf8(content, BASH_OUTPUT_BUFFER_MAX, totalBytes);
        }

        if (timedOut) {
          content = content ? `${content}\ntimeout` : 'timeout';
        } else if (aborted) {
          content = content ? `${content}\naborted` : 'aborted';
        }

        resolve(formatResult(exitCode, content));
      };

      child.stdout.on('data', appendChunk);
      child.stderr.on('data', appendChunk);

      child.on('error', (error) => {
        if (settled) {
          return;
        }

        if ((error as NodeJS.ErrnoException).name === 'AbortError') {
          aborted = true;
          finalize(143);
          return;
        }

        settled = true;
        clearTimeout(timeoutId);
        clearTimeout(killId);
        reject(error);
      });

      child.on('close', (code, signal) => {
        if (signal && timedOut) {
          finalize(124);
          return;
        }

        if (signal && aborted) {
          finalize(143);
          return;
        }

        finalize(code ?? 1);
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, timeoutMs);

      const killId = setTimeout(() => {
        if (!settled && timedOut) {
          child.kill('SIGKILL');
        }
      }, timeoutMs + TIMEOUT_KILL_GRACE_MS);

      ctx.signal.addEventListener(
        'abort',
        () => {
          aborted = true;
        },
        { once: true },
      );
    });
  }
}
