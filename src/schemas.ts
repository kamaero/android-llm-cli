import { z } from 'zod';

// ── Message schema ──

export const ToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
});

export const ToolResultSchema = z.object({
  tool_call_id: z.string(),
  output: z.string(),
  is_error: z.boolean().optional(),
});

export const MessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant', 'tool']),
  content: z.string(),
  tool_calls: z.array(ToolCallSchema).optional(),
  tool_result: ToolResultSchema.optional(),
  timestamp: z.number(),
  tokens: z.number().optional(),
});

export type MessageType = z.infer<typeof MessageSchema>;

// ── Session schema ──

export const SessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  provider: z.string(),
  model: z.string(),
  mode: z.enum(['chat', 'agent']),
  messages: z.array(MessageSchema),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type SessionType = z.infer<typeof SessionSchema>;

// ── Config schema (mirrors config.yaml structure) ──

const SecuritySchema = z.object({
  mode: z.enum(['normal', 'hardcore']),
  workspace_root: z.string(),
});

const RuntimeEnvironmentSchema = z.object({
  type: z.enum(['termux', 'linux', 'macos', 'windows', 'unknown']).default('termux'),
  include_builtin_context: z.boolean().default(true),
  extra_context: z.string().optional(),
});

const ProviderConfigSchema = z.object({
  type: z.enum(['anthropic', 'openai', 'mock']),
  api_key: z.string(),
  model: z.string(),
  base_url: z.string().optional(),
});

export const ConfigSchema = z.object({
  default_provider: z.string(),
  default_mode: z.enum(['chat', 'agent']).default('chat'),
  environment: RuntimeEnvironmentSchema.default({ type: 'termux', include_builtin_context: true }),
  security: SecuritySchema,
  providers: z.record(z.string(), ProviderConfigSchema),
});

export type ConfigType = z.infer<typeof ConfigSchema>;
