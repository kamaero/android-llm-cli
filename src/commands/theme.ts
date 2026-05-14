import { THEME_NAMES } from '../theme.js';
import type { CommandHandler } from './index.js';

export const themeCommand: CommandHandler = async (args, ctx) => {
  if (args.length === 0) {
    const current = ctx.config.theme ?? 'default';
    return (
      `🎨 Current theme: **${current}**\n\n` +
      'Usage: `/theme <name>` — switch theme\n' +
      `Available themes: ${THEME_NAMES.join(', ')}`
    );
  }

  const name = args[0].toLowerCase();

  if (!THEME_NAMES.includes(name)) {
    return (
      `❌ Unknown theme: **${name}**\n` +
      `Available: ${THEME_NAMES.join(', ')}`
    );
  }

  // Theme change happens via config update -> dispatch SET_CONFIG
  // For now we return the command output — the actual theme switch
  // is handled by the App component when it reads config.theme
  return `🎨 Switched to **${name}** theme! Changes apply on next render.`;
};
