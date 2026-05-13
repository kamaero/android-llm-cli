import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { afterEach, describe, expect, it } from 'vitest';

import { ARTIFACT_MAX_BYTES } from '../src/constants.js';
import { WriteFileTool } from '../src/tools/writeFile.js';
import type { ToolContext } from '../src/types.js';

function makeContext(workspaceRoot: string): ToolContext {
  return {
    signal: new AbortController().signal,
    workspaceRoot,
  };
}

describe('WriteFileTool', () => {
  const tool = new WriteFileTool();
  const workspaces: string[] = [];

  async function makeWorkspace(): Promise<string> {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'write-file-tool-'));
    workspaces.push(workspace);
    return workspace;
  }

  afterEach(async () => {
    await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true, force: true })));
  });

  it('writes a file successfully', async () => {
    const workspace = await makeWorkspace();

    const result = await tool.execute({ path: 'notes.txt', content: 'hello' }, makeContext(workspace));

    expect(result).toBe('exit code: 0\nstdout:\nWritten 5 bytes to notes.txt');
    await expect(readFile(path.join(workspace, 'notes.txt'), 'utf8')).resolves.toBe('hello');
  });

  it('creates parent directories automatically', async () => {
    const workspace = await makeWorkspace();

    await tool.execute({ path: 'nested/deep/file.txt', content: 'value' }, makeContext(workspace));

    await expect(readFile(path.join(workspace, 'nested/deep/file.txt'), 'utf8')).resolves.toBe('value');
  });

  it('overwrites existing files', async () => {
    const workspace = await makeWorkspace();
    const filePath = path.join(workspace, 'notes.txt');
    await writeFile(filePath, 'before', 'utf8');

    await tool.execute({ path: 'notes.txt', content: 'after' }, makeContext(workspace));

    await expect(readFile(filePath, 'utf8')).resolves.toBe('after');
  });

  it('rejects path traversal attempts', async () => {
    const workspace = await makeWorkspace();

    const result = await tool.execute({ path: '../notes.txt', content: 'nope' }, makeContext(workspace));

    expect(result).toBe('exit code: 1\nstdout:\nPath traversal is not allowed.');
  });

  it('rejects absolute paths', async () => {
    const workspace = await makeWorkspace();

    const result = await tool.execute(
      { path: path.join(workspace, 'notes.txt'), content: 'nope' },
      makeContext(workspace),
    );

    expect(result).toBe('exit code: 1\nstdout:\nAbsolute paths are not allowed.');
  });

  it('rejects content larger than the artifact limit', async () => {
    const workspace = await makeWorkspace();
    const oversized = 'x'.repeat(ARTIFACT_MAX_BYTES + 1);

    const result = await tool.execute({ path: 'notes.txt', content: oversized }, makeContext(workspace));

    expect(result).toBe(`exit code: 1\nstdout:\nContent exceeds ${ARTIFACT_MAX_BYTES} bytes.`);
  });
});
