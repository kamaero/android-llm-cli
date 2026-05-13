import OpenAI from 'openai';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions/completions.js';
import type {
  IProvider,
  Message,
  ProviderCapabilities,
  ProviderStreamOptions,
  StreamChunk,
  ITool,
} from '../types.js';

/**
 * Convert our ITool[] to OpenAI tool format.
 */
function toOpenAITools(tools: ITool[]): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.schema as Record<string, unknown>,
    },
  }));
}

/**
 * Convert our Message[] to OpenAI chat message format.
 * systemPrompt ('first-message') is injected as the first message with role='system'.
 */
function toOpenAIMessages(
  messages: Message[],
  systemPrompt?: string
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] {
  const result: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

  // System prompt as first message
  if (systemPrompt) {
    result.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.role === 'tool' && msg.tool_result) {
      result.push({
        role: 'tool',
        tool_call_id: msg.tool_result.tool_call_id,
        content: msg.tool_result.output,
      });
    } else if (msg.role === 'assistant' && msg.tool_calls && msg.tool_calls.length > 0) {
      const entry: Record<string, unknown> = {
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.tool_calls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.input),
          },
        })),
      };
      if (msg.reasoningContent) {
        entry.reasoning_content = msg.reasoningContent;
      }
      result.push(entry as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam);
    } else if (msg.role === 'assistant' && msg.content) {
      const entry: Record<string, unknown> = {
        role: 'assistant',
        content: msg.content,
      };
      if (msg.reasoningContent) {
        entry.reasoning_content = msg.reasoningContent;
      }
      result.push(entry as unknown as OpenAI.Chat.Completions.ChatCompletionMessageParam);
    } else {
      result.push({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      });
    }
  }

  return result;
}

export class OpenAIProvider implements IProvider {
  readonly name: string;
  readonly model: string;
  readonly capabilities: ProviderCapabilities;

  private client: OpenAI;

  constructor(name: string, model: string, apiKey: string, baseUrl?: string) {
    this.name = name;
    this.model = model;
    this.capabilities = {
      streaming: true,
      tools: true,
      vision: true,
      systemPrompt: 'first-message',
    };
    this.client = new OpenAI({ apiKey, baseURL: baseUrl });
  }

  async *stream(
    messages: Message[],
    options?: ProviderStreamOptions
  ): AsyncGenerator<StreamChunk> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: toOpenAIMessages(messages, options?.systemPrompt),
        tools: options?.tools ? toOpenAITools(options.tools) : undefined,
        stream: true,
        stream_options: { include_usage: true },
      } as OpenAI.Chat.Completions.ChatCompletionCreateParamsStreaming,
      {
        signal: options?.signal,
      }
    );

    // Track in-progress tool calls by index
    const toolCallsByIndex = new Map<
      number,
      { id: string; name: string; arguments: string }
    >();

    let sawDone = false;
    for await (const chunk of stream) {
      const parsed = this.parseChunk(chunk, toolCallsByIndex);
      if (parsed) {
        if (Array.isArray(parsed)) {
          for (const p of parsed) {
            yield p;
            if (p.type === 'done') sawDone = true;
          }
        } else {
          yield parsed;
          if (parsed.type === 'done') sawDone = true;
        }
      }
    }

    // Emit done only if we didn't already see one
    if (!sawDone) {
      yield { type: 'done' };
    }
  }

  private parseChunk(
    chunk: ChatCompletionChunk,
    toolCallsByIndex: Map<number, { id: string; name: string; arguments: string }>
  ): StreamChunk | StreamChunk[] | null {
    const results: StreamChunk[] = [];

    // Check for usage in the chunk (from stream_options.include_usage)
    if (chunk.usage) {
      results.push({
        type: 'usage',
        inputTokens: chunk.usage.prompt_tokens,
        outputTokens: chunk.usage.completion_tokens,
      });
    }

    for (const choice of chunk.choices) {
      const delta = choice.delta;

      // Text content delta
      if (delta.content) {
        results.push({ type: 'text', delta: delta.content });
      }

      // DeepSeek reasoning/thinking content
      const rawDelta = delta as Record<string, unknown>;
      if (rawDelta.reasoning_content && typeof rawDelta.reasoning_content === 'string') {
        results.push({ type: 'reasoning', delta: rawDelta.reasoning_content });
      }

      // Tool calls
      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          // Initialize tracking entry for new tool calls
          if (!toolCallsByIndex.has(tc.index)) {
            toolCallsByIndex.set(tc.index, { id: tc.id ?? '', name: '', arguments: '' });
          }
          const entry = toolCallsByIndex.get(tc.index)!;

          if (tc.id) entry.id = tc.id;
          if (tc.function?.name) entry.name = tc.function.name;
          if (tc.function?.arguments) entry.arguments += tc.function.arguments;
        }
      }

      // When finish_reason is 'tool_calls', emit the accumulated tool call
      if (choice.finish_reason === 'tool_calls') {
        toolCallsByIndex.forEach((entry) => {
          if (entry.id && entry.name) {
            let input: unknown = {};
            try {
              input = JSON.parse(entry.arguments || '{}');
            } catch {
              input = entry.arguments;
            }
            results.push({
              type: 'tool_call',
              id: entry.id,
              name: entry.name,
              input,
            });
          }
        });
        toolCallsByIndex.clear();
      }

      // End of stream
      if (choice.finish_reason === 'stop') {
        results.push({ type: 'done' });
      }
    }

    if (results.length === 0) return null;
    if (results.length === 1) return results[0];
    return results;
  }
}
