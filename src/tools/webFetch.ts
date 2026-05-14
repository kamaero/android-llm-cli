import { spawn } from 'node:child_process';
import { TOOL_RESULT_MAX_BYTES } from '../constants.js';
import type { ITool, ToolContext } from '../types.js';

const FETCH_TIMEOUT_MS = 15_000;
const MAX_RESPONSE_BYTES = 500_000;

function formatResult(exitCode: number, content: string): string {
  return `exit code: ${exitCode}\nstdout:\n${content}`;
}

export class WebFetchTool implements ITool {
  static readonly schema: Record<string, unknown> = {
    type: 'object',
    required: ['url'],
    properties: {
      url: {
        type: 'string',
        description: 'URL to fetch (http:// or https://). Returns the page content as plain text.',
      },
      max_bytes: {
        type: 'number',
        description: 'Maximum bytes to read (default 500000).',
      },
    },
  };

  readonly name = 'web_fetch';

  readonly description = 'Fetch a URL and return its content as plain text. Strips HTML tags, extracts readable text. Timeout: 15s. Max response: 500KB.';

  get schema(): Record<string, unknown> {
    return WebFetchTool.schema;
  }

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const url = typeof input.url === 'string' ? input.url.trim() : '';

    if (!url) {
      return formatResult(1, 'URL is required.');
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return formatResult(1, 'Only http:// and https:// URLs are supported.');
    }

    const maxBytes = typeof input.max_bytes === 'number' && input.max_bytes > 0
      ? Math.min(input.max_bytes, MAX_RESPONSE_BYTES)
      : MAX_RESPONSE_BYTES;

    return await new Promise<string>((resolve) => {
      let settled = false;
      let timedOut = false;
      const chunks: Buffer[] = [];
      let totalBytes = 0;

      const child = spawn('curl', [
        '-sS',                // silent, show errors
        '-L',                 // follow redirects
        '--max-time', '15',   // max 15s total
        '-A', 'Mozilla/5.0 (compatible; android-llm-cli/1.0)', // user-agent
        url,
      ], {
        signal: ctx.signal as AbortSignal,
        timeout: FETCH_TIMEOUT_MS,
      });

      child.stdout.on('data', (chunk: Buffer) => {
        totalBytes += chunk.length;
        if (totalBytes <= maxBytes) {
          chunks.push(chunk);
        }
      });

      child.stderr.on('data', (chunk: Buffer) => {
        // stderr from curl (errors, progress) — collect only if we need it
        if (!settled) {
          chunks.push(chunk);
        }
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        const msg = (err as NodeJS.ErrnoException).code === 'ETIMEDOUT'
          ? `Timeout after ${FETCH_TIMEOUT_MS / 1000}s`
          : err.message;
        resolve(formatResult(1, `Fetch error: ${msg}`));
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;

        const raw = Buffer.concat(chunks).toString('utf8');

        if (timedOut) {
          resolve(formatResult(124, 'Timeout'));
          return;
        }

        // Truncate for TOOL_RESULT_MAX_BYTES if needed
        const truncated = raw.length > TOOL_RESULT_MAX_BYTES
          ? raw.slice(0, TOOL_RESULT_MAX_BYTES) + `\n[...truncated, ${raw.length} bytes total]`
          : raw;

        resolve(formatResult(code ?? 0, truncated));
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
      }, FETCH_TIMEOUT_MS + 1000);

      child.on('close', () => clearTimeout(timeoutId));
    });
  }
}
