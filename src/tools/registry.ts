import type { IProvider, ITool } from '../types.js';

export class ToolRegistry {
  private readonly tools = new Map<string, ITool>();

  constructor(initialTools: ITool[] = []) {
    for (const tool of initialTools) {
      this.register(tool);
    }
  }

  register(tool: ITool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): ITool | undefined {
    return this.tools.get(name);
  }

  list(): ITool[] {
    return [...this.tools.values()];
  }

  enabledFor(provider: IProvider): ITool[] {
    return provider.capabilities.tools ? this.list() : [];
  }
}
