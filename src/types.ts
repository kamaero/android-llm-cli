// ── Data model ──

export interface Message {
  id: string;                           // nanoid
  role: 'user' | 'assistant' | 'tool';
  content: string;
  tool_calls?: ToolCall[];              // only for role=assistant in agent mode
  tool_result?: ToolResult;             // only for role=tool
  timestamp: number;                    // Unix ms
  tokens?: number;                      // filled from usage chunk
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  tool_call_id: string;
  output: string;
  is_error?: boolean;
}

export interface Session {
  id: string;                           // nanoid
  title: string;                        // first 60 chars of first user message
  provider: string;                     // provider key from config.yaml
  model: string;
  mode: 'chat' | 'agent';
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

// ── Streaming ──

export type StreamChunk =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'usage'; inputTokens: number; outputTokens: number }
  | { type: 'done' };

// ── Provider interfaces ──

export interface ProviderCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  systemPrompt: 'parameter' | 'first-message' | 'unsupported';
  maxContextTokens?: number;
  pricing?: { input: number; output: number }; // $ per 1M tokens
}

export interface ProviderStreamOptions {
  tools?: ITool[];
  systemPrompt?: string;
  signal?: AbortSignal;
}

export interface IProvider {
  readonly name: string;
  readonly model: string;
  readonly capabilities: ProviderCapabilities;
  stream(
    messages: Message[],
    options?: ProviderStreamOptions
  ): AsyncIterable<StreamChunk>;
  countTokens?(messages: Message[]): Promise<number>;
}

// ── Tool interfaces ──

export interface ITool {
  readonly name: string;
  readonly description: string;
  readonly schema: Record<string, unknown>; // JSON Schema 7
  execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string>;
}

export interface ToolContext {
  signal: AbortSignal;
  timeoutMs?: number;
  cwd?: string;
  workspaceRoot: string;
}

// ── Session policy & runtime environment ──

export type ProfileType = 'safe-chat' | 'code-workspace' | 'full-termux-agent';

export interface SessionPolicy {
  profile: ProfileType;
  workspaceRoot: string;
  dryRunFirst: boolean;
  bashConfirmation: 'always' | 'batch' | 'never';
  fileConfirmation: 'always' | 'batch' | 'never';
  networkConfirmation: 'always' | 'batch' | 'never';
  peripheralConfirmation: 'always' | 'batch' | 'never';
}

export interface RuntimeEnvironment {
  type: 'termux' | 'linux' | 'macos' | 'windows' | 'unknown';
  includeBuiltinContext: boolean;
  extraContext?: string;
}

// ── App state (Ink reducer) ──

export type AppStatus = 'idle' | 'streaming' | 'awaiting-tool-confirm' | 'error';

export interface AppState {
  session: Session;
  status: AppStatus;
  pendingToolCall: PendingToolCall | undefined;
  error?: string;
}

export interface PendingToolCall {
  call: ToolCall;
  result?: ToolResult;
}

export type AppAction =
  | { type: 'ADD_USER_MESSAGE'; message: Message }
  | { type: 'START_STREAMING' }
  | { type: 'APPEND_TEXT'; delta: string }
  | { type: 'SET_TOOL_CALL'; toolCall: ToolCall }
  | { type: 'SET_TOOL_RESULT'; toolResult: ToolResult }
  | { type: 'SET_USAGE'; inputTokens: number; outputTokens: number }
  | { type: 'STOP_STREAMING' }
  | { type: 'SET_ERROR'; error: string }
  | { type: 'CONFIRM_TOOL'; toolCallId: string }
  | { type: 'REJECT_TOOL'; toolCallId: string }
  | { type: 'RESET_MESSAGES' }
  | { type: 'SET_MODEL'; model: string }
  | { type: 'SET_MODE'; mode: 'chat' | 'agent' }
  | { type: 'ADD_COMMAND_OUTPUT'; content: string };

// ── Config (used by zod schema, re-exported from schemas.ts) ──

export interface ProviderConfig {
  type: 'anthropic' | 'openai';
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface AppConfig {
  defaultProvider: string;
  defaultMode: 'chat' | 'agent';
  environment: RuntimeEnvironment;
  sessionPolicy: SessionPolicy;
  providers: Record<string, ProviderConfig>;
}
