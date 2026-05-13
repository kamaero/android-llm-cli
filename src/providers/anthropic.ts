import Anthropic from '@anthropic-ai/sdk';
import type {
  MessageParam,
  RawMessageStreamEvent,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages/index.js';
import type {
  IProvider,
  Message,
  ProviderCapabilities,
  ProviderStreamOptions,
  StreamChunk,
  ITool,
} from '../types.js';

/**
 * Convert our Message[] to Anthropic MessageParam[].
 * Anthropic Messages API expects alternating user/assistant roles
 * and a top-level system parameter (not a message).
 *
 * Tool-result messages (role='tool') are transformed into
 * user messages containing tool_result blocks.
 */
function toAnthropicMessages(messages: Message[]): MessageParam[] {
  const result: MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === 'tool' && msg.tool_result) {
      // Anthropic expects tool_result as a user message with tool_result content blocks
      result.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: msg.tool_result.tool_call_id,
            content: msg.tool_result.output,
            is_error: msg.tool_result.is_error,
          },
        ],
      });
    } else if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      // Assistant message with tool_use blocks
      const content: Anthropic.ContentBlockParam[] = [];
      if (msg.content) {
        content.push({ type: 'text', text: msg.content });
      }
      for (const tc of msg.tool_calls) {
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input as Record<string, unknown>,
        });
      }
      result.push({ role: 'assistant', content });
    } else {
      // Simple text message (user or assistant without tools)
      result.push({ role: msg.role as 'user' | 'assistant', content: msg.content });
    }
  }

  return result;
}

/**
 * Convert our ITool[] to Anthropic tool format.
 */
function toAnthropicTools(tools: ITool[]): Anthropic.Tool[] {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.schema as Anthropic.Tool.InputSchema,
  }));
}

export class AnthropicProvider implements IProvider {
  readonly name: string;
  readonly model: string;
  readonly capabilities: ProviderCapabilities;

  private client: Anthropic;

  constructor(name: string, model: string, apiKey: string) {
    this.name = name;
    this.model = model;
    this.capabilities = {
      streaming: true,
      tools: true,
      vision: true,
      systemPrompt: 'parameter',
    };
    this.client = new Anthropic({ apiKey });
  }

  async *stream(
    messages: Message[],
    options?: ProviderStreamOptions
  ): AsyncGenerator<StreamChunk> {
    const stream = this.client.messages.stream({
      model: this.model,
      max_tokens: 4096,
      system: options?.systemPrompt,
      messages: toAnthropicMessages(messages),
      tools: options?.tools ? toAnthropicTools(options.tools) : undefined,
    });

    // Wire up abort signal if provided
    if (options?.signal) {
      options.signal.addEventListener('abort', () => stream.abort(), { once: true });
    }

    for await (const event of stream) {
      const chunk = this.parseEvent(event);
      if (chunk) yield chunk;
    }

    // Emit final done event if we didn't already
    yield { type: 'done' };
  }

  private parseEvent(event: RawMessageStreamEvent): StreamChunk | null {
    switch (event.type) {
      case 'content_block_delta': {
        if (event.delta.type === 'text_delta') {
          return { type: 'text', delta: event.delta.text };
        }
        return null;
      }
      case 'content_block_start': {
        if (event.content_block.type === 'tool_use') {
          const tb = event.content_block as ToolUseBlock;
          return {
            type: 'tool_call',
            id: tb.id,
            name: tb.name,
            input: tb.input,
          };
        }
        return null;
      }
      case 'message_delta': {
        return {
          type: 'usage',
          inputTokens: event.usage.input_tokens ?? 0,
          outputTokens: event.usage.output_tokens,
        };
      }
      case 'message_stop': {
        return { type: 'done' };
      }
      default:
        return null;
    }
  }
}
