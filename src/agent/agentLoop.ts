import { AGENT_LOOP_MAX_ITERATIONS_MVP } from '../constants.js';
import type {
  AppAction,
  AppState,
  IProvider,
  Session,
  SecurityConfig,
  ToolCall,
  ToolContext,
  ToolResult,
} from '../types.js';
import type { ToolRegistry } from '../tools/registry.js';
import { DEFAULT_RETRY_OPTS, withRetry } from '../streaming/retry.js';
import { needsConfirm } from '../security/needsConfirm.js';

/**
 * Throttled batcher for reasoning chunks.
 * Collects reasoning deltas and dispatches a single APPEND_REASONING
 * at most once per `intervalMs`. This prevents render flickering from
 * high-frequency tiny reasoning chunks (DeepSeek thinking).
 */
export function createReasoningBatcher(
  dispatch: (action: AppAction) => AppState,
  intervalMs = 60,
) {
  let buffer = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  function flush() {
    if (buffer) {
      dispatch({ type: 'APPEND_REASONING', delta: buffer });
      buffer = '';
    }
    timer = null;
  }

  return {
    add(delta: string) {
      buffer += delta;
      if (!timer) {
        timer = setTimeout(flush, intervalMs);
      }
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      buffer = '';
    },
  };
}

export interface AgentLoopParams {
  session: Session;
  provider: IProvider;
  toolRegistry: ToolRegistry;
  systemPrompt: string;
  dispatch: (action: AppAction) => AppState;
  security: SecurityConfig;
  saveSession: (session: Session) => void;
  signal: AbortSignal;
  /** How many tool executions have already occurred this session (for 'always' resume). */
  iteration?: number;
}

function normalizeToolInput(input: unknown): Record<string, unknown> {
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    return input as Record<string, unknown>;
  }
  return { value: input };
}

/**
 * Execute a single tool call and return the result.
 * Exported so app.tsx can call it from handleToolDecision for 'always' confirmation.
 */
export async function executeToolCall(
  toolCall: ToolCall,
  toolRegistry: ToolRegistry,
  security: SecurityConfig,
  signal: AbortSignal,
): Promise<ToolResult> {
  const tool = toolRegistry.get(toolCall.name);
  if (!tool) {
    return {
      tool_call_id: toolCall.id,
      output: `Tool "${toolCall.name}" not found in registry.`,
      is_error: true,
    };
  }

  const ctx: ToolContext = {
    signal,
    workspaceRoot: security.workspaceRoot,
  };

  try {
    const output = await tool.execute(toolCall.input, ctx);
    return { tool_call_id: toolCall.id, output };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { tool_call_id: toolCall.id, output: message, is_error: true };
  }
}

/**
 * Core agent loop. Streams from the provider, handles tool calls, and loops.
 *
 * For 'always' confirmation mode: returns after dispatching SET_TOOL_CALL so the
 * UI can prompt the user. The caller (handleToolDecision in app.tsx) executes the
 * tool and calls agentLoop again with the updated session and iteration+1.
 *
 * For 'never'/'batch' confirmation mode: executes tools automatically and loops
 * internally up to AGENT_LOOP_MAX_ITERATIONS_MVP times.
 */
export async function agentLoop(params: AgentLoopParams): Promise<void> {
  const { provider, toolRegistry, systemPrompt, dispatch, security, saveSession, signal } =
    params;

  let session = params.session;
  let iteration = params.iteration ?? 0;

  while (iteration < AGENT_LOOP_MAX_ITERATIONS_MVP) {
    const tools = provider.capabilities.tools ? toolRegistry.list() : undefined;

    dispatch({ type: 'START_STREAMING' });

    let toolCall: ToolCall | null = null;

    try {
      let streamAttempt = 0;
      const reasoningBatcher = createReasoningBatcher(dispatch);

      await withRetry(
        async () => {
          if (streamAttempt > 0) {
            // Reset tool call state on retry — cancel stale reasoning buffer too
            toolCall = null;
            reasoningBatcher.cancel();
            dispatch({ type: 'RESUME_STREAMING' });
          }
          streamAttempt += 1;

          for await (const chunk of provider.stream(session.messages, { systemPrompt, tools, signal })) {
            if (signal.aborted) break;

            switch (chunk.type) {
              case 'text':
                // Flush any pending reasoning before text starts (thinking → response transition)
                reasoningBatcher.flush();
                dispatch({ type: 'APPEND_TEXT', delta: chunk.delta });
                break;
              case 'reasoning':
                reasoningBatcher.add(chunk.delta);
                break;
              case 'tool_call':
                reasoningBatcher.flush();
                toolCall = {
                  id: chunk.id,
                  name: chunk.name,
                  input: normalizeToolInput(chunk.input),
                };
                // Don't dispatch SET_TOOL_CALL during retry - wait until stream completes successfully
                break;
              case 'usage':
                dispatch({
                  type: 'SET_USAGE',
                  inputTokens: chunk.inputTokens,
                  outputTokens: chunk.outputTokens,
                });
                break;
              case 'done':
                reasoningBatcher.flush();
                break;
            }

            if (toolCall) break;
          }
        },
        DEFAULT_RETRY_OPTS,
        (attempt) => {
          dispatch({
            type: 'SET_RETRY',
            attempt,
            maxAttempts: DEFAULT_RETRY_OPTS.maxAttempts,
          });
        },
      );

      // Only dispatch SET_TOOL_CALL after successful completion of withRetry
      if (toolCall) {
        dispatch({ type: 'SET_TOOL_CALL', toolCall });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      dispatch({ type: 'SET_ERROR', error: message });
      return;
    }

    if (!toolCall) {
      const finalState = dispatch({ type: 'STOP_STREAMING' });
      saveSession(finalState.session);
      return;
    }

    // Tool call encountered — check if it needs confirmation
    if (needsConfirm(toolCall, security)) {
      return; // Pause for user confirmation
    }

    iteration++;
    const toolResult = await executeToolCall(toolCall, toolRegistry, security, signal);
    const stateWithResult = dispatch({ type: 'SET_TOOL_RESULT', toolResult });
    session = stateWithResult.session;

    if (iteration >= AGENT_LOOP_MAX_ITERATIONS_MVP) {
      const finalState = dispatch({ type: 'STOP_STREAMING' });
      saveSession(finalState.session);
      return;
    }
  }
}
