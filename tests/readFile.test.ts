import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { ReadFileTool } from '../src/tools/readFile.js';
import type { ToolContext } from '../src/types.js';

function makeContext(workspaceRoot: string): ToolContext {
  return {
    signal: new AbortController().signal,
    workspaceRoot,
  };
}

describe('ReadFileTool', () => {
  const tool = new ReadFileTool();
  const workspaces: string[] = [];

  async function makeWorkspace(): Promise<string> {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'read-file-tool-'));
    workspaces.push(workspace);
    return workspace;
  }

  afterEach(async () => {
    await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true, force: true })));
  });

  it('reads a file and returns numbered lines', async () => {
    const workspace = await makeWorkspace();
    await writeFile(path.join(workspace, 'notes.txt'), 'alpha\nbeta\ngamma', 'utf8');

    const result = await tool.execute({ path: 'notes.txt' }, makeContext(workspace));

    expect(result).toBe('exit code: 0\nstdout:\n1|alpha\n2|beta\n3|gamma');
  });

  it('reports file not found errors', async () => {
    const workspace = await makeWorkspace();

    const result = await tool.execute({ path: 'missing.txt' }, makeContext(workspace));

    expect(result).toContain('exit code: 1');
    expect(result).toContain('ENOENT');
  });

  it('supports offset and limit pagination', async () => {
    const workspace = await makeWorkspace();
    await writeFile(path.join(workspace, 'notes.txt'), 'one\ntwo\nthree\nfour\nfive', 'utf8');

    const result = await tool.execute({ path: 'notes.txt', offset: 2, limit: 2 }, makeContext(workspace));

    expect(result).toBe('exit code: 0\nstdout:\n2|two\n3|three');
  });

  it('rejects path traversal attempts', async () => {
    const workspace = await makeWorkspace();

    const result = await tool.execute({ path: '../secret.txt' }, makeContext(workspace));

    expect(result).toBe('exit code: 1\nstdout:\nPath traversal is not allowed.');
  });

  it('rejects binary files', async () => {
    const workspace = await makeWorkspace();
    await writeFile(path.join(workspace, 'image.bin'), Buffer.from([0, 159, 146, 150]));

    const result = await tool.execute({ path: 'image.bin' }, makeContext(workspace));

    expect(result).toBe('exit code: 1\nstdout:\nBinary files are not supported.');
  });

  it('allows absolute paths inside the workspace root', async () => {
    const workspace = await makeWorkspace();
    const filePath = path.join(workspace, 'notes.txt');
    await writeFile(filePath, 'inside', 'utf8');

    const result = await tool.execute({ path: filePath }, makeContext(workspace));

    expect(result).toBe('exit code: 0\nstdout:\n1|inside');
  });
});
