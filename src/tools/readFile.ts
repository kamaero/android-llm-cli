import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import { TOOL_RESULT_MAX_BYTES } from '../constants.js';
import type { ITool, ToolContext } from '../types.js';

/** Regex patterns matching paths that contain sensitive segments. */
const SENSITIVE_SEGMENTS: RegExp[] = [
  /[/\\](\.ssh|\.aws|\.gnupg|\.config[/\\]a-llmcli|\.config[/\\]llmcli|\.llmcli)[/\\]/,
  /[/\\]\.gitconfig$/,
  /[/\\]\.netrc$/,
  /[/\\]\.env(\.\w+)?$/,
  /[/\\]id_(rsa|ecdsa|ed25519|dsa)(\.pub)?$/,
  /\.pem$/,
  /\.key$/,
];

/**
 * Check if the resolved path matches known sensitive patterns.
 * Returns true for paths like ~/.ssh/id_rsa, .env, config.yaml, etc.
 */
export function isSensitivePath(resolvedPath: string): boolean {
  return SENSITIVE_SEGMENTS.some((pattern) => pattern.test(resolvedPath));
}

const DEFAULT_OFFSET = 1;
const DEFAULT_LIMIT = 500;
const MAX_LIMIT = 2000;

function formatResult(exitCode: number, content: string): string {
  return `exit code: ${exitCode}\nstdout:\n${content}`;
}

function splitPathSegments(inputPath: string): string[] {
  return inputPath.split(/[\\/]+/).filter(Boolean);
}

function hasParentTraversal(inputPath: string): boolean {
  return splitPathSegments(inputPath).includes('..');
}

function resolveReadPath(inputPath: string, workspaceRoot: string): string {
  if (hasParentTraversal(inputPath)) {
    throw new Error('Path traversal is not allowed.');
  }

  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const resolvedPath = path.isAbsolute(inputPath)
    ? path.resolve(inputPath)
    : path.resolve(resolvedWorkspaceRoot, inputPath);
  const relativePath = path.relative(resolvedWorkspaceRoot, resolvedPath);

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new Error('Path must be within the workspace root.');
  }

  return resolvedPath;
}

function clampPositiveInteger(value: unknown, fallback: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  const integer = Math.trunc(value);

  if (integer < 1) {
    return fallback;
  }

  return typeof max === 'number' ? Math.min(integer, max) : integer;
}

function decodeUtf8(buffer: Buffer): string {
  if (buffer.includes(0)) {
    throw new Error('Binary files are not supported.');
  }

  try {
    return new TextDecoder('utf8', { fatal: true }).decode(buffer);
  } catch {
    throw new Error('Binary files are not supported.');
  }
}

function buildOutput(text: string, offset: number, limit: number): string {
  const normalized = text.replace(/\r\n/g, '\n');
  const lines = normalized.split('\n');

  if (normalized.endsWith('\n')) {
    lines.pop();
  }

  if (lines.length === 0) {
    lines.push('');
  }

  const slice = lines.slice(offset - 1, offset - 1 + limit);
  return slice.map((line, index) => `${offset + index}|${line}`).join('\n');
}

function fitsResultLimit(result: string): boolean {
  return Buffer.byteLength(result, 'utf8') <= TOOL_RESULT_MAX_BYTES;
}

function formatError(message: string): string {
  const result = formatResult(1, message);

  if (fitsResultLimit(result)) {
    return result;
  }

  const prefix = 'exit code: 1\nstdout:\n';
  const availableBytes = Math.max(0, TOOL_RESULT_MAX_BYTES - Buffer.byteLength(prefix, 'utf8'));
  const truncated = Buffer.from(message, 'utf8').subarray(0, availableBytes).toString('utf8');
  return `${prefix}${truncated}`;
}

export class ReadFileTool implements ITool {
  static readonly schema: Record<string, unknown> = {
    type: 'object',
    required: ['path'],
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read, relative to the workspace root unless absolute within the workspace.',
      },
      offset: {
        type: 'number',
        description: '1-based line offset to start reading from. Defaults to 1.',
        minimum: 1,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to return. Defaults to 500, max 2000.',
        minimum: 1,
        maximum: 2000,
      },
    },
  };

  readonly name = 'read_file';

  readonly description = 'Read a text file inside the workspace and return numbered lines with pagination.';

  get schema(): Record<string, unknown> {
    return ReadFileTool.schema;
  }

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    try {
      const inputPath = typeof input.path === 'string' ? input.path : '';

      if (!inputPath) {
        return formatError('Path is required.');
      }

      const resolvedPath = resolveReadPath(inputPath, ctx.workspaceRoot);

      // Sensitive path check — warn in result so the model can see it flagged
      if (isSensitivePath(resolvedPath)) {
        return formatError(
          `Access to sensitive path is flagged:\n  ${resolvedPath}\nThis file may contain credentials or secrets.`
        );
      }

      const offset = clampPositiveInteger(input.offset, DEFAULT_OFFSET);
      const limit = clampPositiveInteger(input.limit, DEFAULT_LIMIT, MAX_LIMIT);
      const content = await readFile(resolvedPath);
      const output = buildOutput(decodeUtf8(content), offset, limit);
      const result = formatResult(0, output);

      if (!fitsResultLimit(result)) {
        return formatError(`Read output exceeds ${TOOL_RESULT_MAX_BYTES} bytes; reduce limit.`);
      }

      return result;
    } catch (error) {
      return formatError(error instanceof Error ? error.message : String(error));
    }
  }
}
