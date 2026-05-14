import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Buffer } from 'node:buffer';

import { ARTIFACT_MAX_BYTES } from '../constants.js';
import type { ITool, ToolContext } from '../types.js';
import { isSensitivePath } from '../security/needsConfirm.js';

function formatResult(exitCode: number, content: string): string {
  return `exit code: ${exitCode}\nstdout:\n${content}`;
}

function splitPathSegments(inputPath: string): string[] {
  return inputPath.split(/[\\/]+/).filter(Boolean);
}

function hasParentTraversal(inputPath: string): boolean {
  return splitPathSegments(inputPath).includes('..');
}

function resolveWritePath(inputPath: string, workspaceRoot: string): string {
  if (!inputPath) {
    throw new Error('Path is required.');
  }

  if (path.isAbsolute(inputPath)) {
    throw new Error('Absolute paths are not allowed.');
  }

  if (hasParentTraversal(inputPath)) {
    throw new Error('Path traversal is not allowed.');
  }

  return path.resolve(workspaceRoot, inputPath);
}

export class WriteFileTool implements ITool {
  static readonly schema: Record<string, unknown> = {
    type: 'object',
    required: ['path', 'content'],
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to write, relative to the workspace root.',
      },
      content: {
        type: 'string',
        description: 'UTF-8 text content to write to the file. Existing files are overwritten.',
      },
    },
  };

  readonly name = 'write_file';

  readonly description = 'Write a UTF-8 text file inside the workspace, creating parent directories and overwriting existing files. Sensitive paths (config, credentials, .env, .ssh, .aws) are blocked.';

  get schema(): Record<string, unknown> {
    return WriteFileTool.schema;
  }

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    try {
      const inputPath = typeof input.path === 'string' ? input.path : '';
      const content = typeof input.content === 'string' ? input.content : '';
      const byteLength = Buffer.byteLength(content, 'utf8');

      if (typeof input.content !== 'string') {
        return formatResult(1, 'Content is required.');
      }

      if (byteLength > ARTIFACT_MAX_BYTES) {
        return formatResult(1, `Content exceeds ${ARTIFACT_MAX_BYTES} bytes.`);
      }

      const resolvedPath = resolveWritePath(inputPath, ctx.workspaceRoot);

      // Block writes to sensitive paths
      if (isSensitivePath(resolvedPath)) {
        return formatResult(1, `Writing to sensitive path is not allowed: ${inputPath}`);
      }

      await mkdir(path.dirname(resolvedPath), { recursive: true });
      await writeFile(resolvedPath, content, 'utf8');

      return formatResult(0, `Written ${byteLength} bytes to ${inputPath}`);
    } catch (error) {
      return formatResult(1, error instanceof Error ? error.message : String(error));
    }
  }
}
