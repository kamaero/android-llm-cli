import type {
  IProvider,
  Message,
  ProviderCapabilities,
  ProviderStreamOptions,
  StreamChunk,
} from '../types.js';

export type MockFixture = 'chat' | 'tool_call';

/**
 * MockProvider for offline testing.
 *
 * - 'chat' fixture: yields text → usage → done
 * - 'tool_call' fixture: yields text → tool_call (bash) → done
 *   — enables testing agent mode + tool confirmation without a live API.
 */
export class MockProvider implements IProvider {
  readonly name = 'mock';
  readonly model = 'mock-model';
  readonly capabilities: ProviderCapabilities = {
    streaming: true,
    tools: true,
    vision: false,
    systemPrompt: 'parameter',
  };

  private fixture: MockFixture;

  constructor(fixture: MockFixture = 'chat') {
    this.fixture = fixture;
  }

  async *stream(
    _messages: Message[],
    _options?: ProviderStreamOptions,
  ): AsyncGenerator<StreamChunk> {
    if (this.fixture === 'tool_call') {
      yield { type: 'text', delta: 'Let me run that command for you.' };
      yield {
        type: 'tool_call',
        id: 'mock_tc_1',
        name: 'bash',
        input: { command: 'echo hello from mock' },
      };
      yield { type: 'usage', inputTokens: 20, outputTokens: 12 };
      yield { type: 'done' };
    } else {
      yield { type: 'text', delta: 'Hello from mock!' };
      yield { type: 'usage', inputTokens: 10, outputTokens: 5 };
      yield { type: 'done' };
    }
  }

  async countTokens(_messages: Message[]): Promise<number> {
    return 0;
  }
}
