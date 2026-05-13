import type { CommandHandler } from './index.js';

export const modelCommand: CommandHandler = async (args, ctx) => {
  if (args.length === 0) {
    return `Current model: \`${ctx.state.session.model}\``;
  }

  const model = args[0]!;
  ctx.dispatch({ type: 'SET_MODEL', model });
  return `Model switched to: \`${model}\``;
};
