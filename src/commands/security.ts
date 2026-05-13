import type { SecurityMode } from '../types.js';
import type { CommandHandler } from './index.js';

export const securityCommand: CommandHandler = async (args, ctx) => {
  if (args.length === 0) {
    const next: SecurityMode = ctx.state.securityMode === 'normal' ? 'hardcore' : 'normal';
    ctx.dispatch({ type: 'SET_SECURITY_MODE', mode: next });
    return `Security mode switched to: **${next}**`;
  }

  const modeArg = args[0].toLowerCase();
  if (modeArg !== 'normal' && modeArg !== 'hardcore') {
    return `Invalid mode: \`${modeArg}\`. Use \`normal\` or \`hardcore\`.`;
  }

  ctx.dispatch({ type: 'SET_SECURITY_MODE', mode: modeArg });
  return `Security mode set to: **${modeArg}**`;
};
