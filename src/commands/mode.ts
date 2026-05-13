import type { CommandHandler } from './index.js';

export const modeCommand: CommandHandler = async (args, ctx) => {
  if (args.length === 0) {
    const next = ctx.state.session.mode === 'chat' ? 'agent' : 'chat';
    ctx.dispatch({ type: 'SET_MODE', mode: next });
    return `Mode switched to: \`${next}\``;
  }

  const modeArg = args[0];
  if (modeArg !== 'chat' && modeArg !== 'agent') {
    return `Invalid mode: \`${modeArg}\`. Use \`chat\` or \`agent\`.`;
  }

  ctx.dispatch({ type: 'SET_MODE', mode: modeArg });
  return `Mode set to: \`${modeArg}\``;
};
