import type { AppAction, AppState } from '../types.js';
import type { ConfigType } from '../schemas.js';
import { clearCommand } from './clear.js';
import { helpCommand } from './help.js';
import { modelCommand } from './model.js';
import { modeCommand } from './mode.js';
import { securityCommand } from './security.js';

export interface CommandContext {
  state: AppState;
  dispatch: (action: AppAction) => AppState;
  config: ConfigType;
}

export type CommandHandler = (args: string[], ctx: CommandContext) => Promise<string | null>;

const COMMANDS: Record<string, CommandHandler> = {
  clear: clearCommand,
  help: helpCommand,
  model: modelCommand,
  mode: modeCommand,
  security: securityCommand,
};

export function parseCommand(input: string): { name: string; args: string[] } | null {
  if (!input.startsWith('/')) return null;
  const parts = input.slice(1).trim().split(/\s+/).filter(Boolean);
  const name = parts[0];
  if (!name) return null;
  return { name, args: parts.slice(1) };
}

export async function executeCommand(
  input: string,
  ctx: CommandContext,
): Promise<string | null> {
  const parsed = parseCommand(input);
  if (!parsed) return null;

  const handler = COMMANDS[parsed.name];
  if (!handler) {
    return `Unknown command: /${parsed.name}. Type /help for a list of commands.`;
  }

  return handler(parsed.args, ctx);
}
