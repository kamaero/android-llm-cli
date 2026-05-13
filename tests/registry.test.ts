import { describe, expect, it, vi } from 'vitest';

import { toToolSpec } from '../src/tools/ITool.js';
import { ToolRegistry } from '../src/tools/registry.js';
import type { IProvider, ITool, ToolContext } from '../src/types.js';

const execute = vi.fn<(input: Record<string, unknown>, ctx: ToolContext) => Promise<string>>();

function makeTool(name: string): ITool {
  return {
    name,
    description: `${name} description`,
    schema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
      },
      required: ['command'],
    },
    execute,
  };
}

function makeProvider(tools: boolean): IProvider {
  return {
    name: 'test-provider',
    model: 'test-model',
    capabilities: {
      streaming: true,
      tools,
      vision: false,
      systemPrompt: 'parameter',
    },
    stream: vi.fn(),
  };
}

describe('toToolSpec', () => {
  it('returns Anthropic tool format', () => {
    const bashTool = makeTool('bash');

    expect(toToolSpec(bashTool, 'anthropic')).toEqual({
      name: 'bash',
      description: 'bash description',
      input_schema: bashTool.schema,
    });
  });

  it('returns OpenAI tool format', () => {
    const bashTool = makeTool('bash');

    expect(toToolSpec(bashTool, 'openai')).toEqual({
      type: 'function',
      function: {
        name: 'bash',
        description: 'bash description',
        parameters: bashTool.schema,
      },
    });
  });
});

describe('ToolRegistry', () => {
  it('registers and gets tools by name', () => {
    const registry = new ToolRegistry();
    const bashTool = makeTool('bash');

    registry.register(bashTool);

    expect(registry.get('bash')).toBe(bashTool);
  });

  it('lists initial and registered tools', () => {
    const bashTool = makeTool('bash');
    const readFileTool = makeTool('read_file');
    const registry = new ToolRegistry([bashTool]);

    registry.register(readFileTool);

    expect(registry.list()).toEqual([bashTool, readFileTool]);
  });

  it('returns tools only when the provider supports them', () => {
    const bashTool = makeTool('bash');
    const registry = new ToolRegistry([bashTool]);

    expect(registry.enabledFor(makeProvider(true))).toEqual([bashTool]);
    expect(registry.enabledFor(makeProvider(false))).toEqual([]);
  });
});
