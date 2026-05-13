import type { CommandHandler } from './index.js';

export const helpCommand: CommandHandler = async (_args, _ctx) => {
  return [
    '**Available commands:**',
    '',
    '- `/help`              — show this help',
    '- `/clear`             — clear all messages in the current session',
    '- `/model [name]`      — show current model, or switch to `name`',
    '- `/mode [chat|agent]`       — show or toggle mode; omit arg to toggle',
    '- `/security [normal|hardcore]` — show or toggle security mode; omit arg to toggle',
  ].join('\n');
};
