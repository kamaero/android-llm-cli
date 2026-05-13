import type { CommandHandler } from './index.js';

export const clearCommand: CommandHandler = async (_args, ctx) => {
  ctx.dispatch({ type: 'RESET_MESSAGES' });
  return null;
};
