export type { ITool } from '../types.js';

import type { ITool } from '../types.js';

export function toToolSpec(
  tool: ITool,
  providerType: 'anthropic' | 'openai',
): Record<string, unknown> {
  if (providerType === 'anthropic') {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.schema,
    };
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.schema,
    },
  };
}
