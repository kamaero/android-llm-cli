import React from 'react';

// ── Theme type ───────────────────────────────────────────────────────────────

export interface Theme {
  /** UI label */
  name: string;
  /** User message label (e.g. "You") */
  user: string;
  /** Assistant label */
  assistant: string;
  /** Tool result header */
  tool: string;
  /** Tool result border */
  toolBorder: string;
  /** Inline code color */
  code: string;
  /** Heading level 1 */
  heading1: string;
  /** Heading level 2 */
  heading2: string;
  /** Heading level 3 */
  heading3: string;
  /** Bullet/list marker */
  bullet: string;
  /** Dim/secondary text */
  dim: string;
  /** Error/destructive */
  error: string;
  /** Warning */
  warning: string;
  /** Success */
  success: string;
  /** Accent / highlight */
  accent: string;
  /** Input box horizontal line color */
  inputLine: string;
}

// ── Presets ──────────────────────────────────────────────────────────────────

export const THEMES: Record<string, Theme> = {
  default: {
    name: 'Default',
    user: 'blue',
    assistant: 'green',
    tool: 'magenta',
    toolBorder: 'gray',
    code: 'cyan',
    heading1: 'yellow',
    heading2: 'green',
    heading3: 'cyan',
    bullet: 'yellow',
    dim: 'gray',
    error: 'red',
    warning: 'yellow',
    success: 'green',
    accent: 'cyan',
    inputLine: '#FF8800',
  },

  nord: {
    name: 'Nord',
    user: '#81A1C1',
    assistant: '#A3BE8C',
    tool: '#B48EAD',
    toolBorder: '#4C566A',
    code: '#88C0D0',
    heading1: '#EBCB8B',
    heading2: '#A3BE8C',
    heading3: '#88C0D0',
    bullet: '#EBCB8B',
    dim: '#616E88',
    error: '#BF616A',
    warning: '#EBCB8B',
    success: '#A3BE8C',
    accent: '#88C0D0',
    inputLine: '#D08770',
  },

  dracula: {
    name: 'Dracula',
    user: '#8BE9FD',
    assistant: '#50FA7B',
    tool: '#FF79C6',
    toolBorder: '#6272A4',
    code: '#F1FA8C',
    heading1: '#FFB86C',
    heading2: '#50FA7B',
    heading3: '#8BE9FD',
    bullet: '#FFB86C',
    dim: '#6272A4',
    error: '#FF5555',
    warning: '#FFB86C',
    success: '#50FA7B',
    accent: '#BD93F9',
    inputLine: '#FFB86C',
  },

  monokai: {
    name: 'Monokai',
    user: '#66D9EF',
    assistant: '#A6E22E',
    tool: '#F92672',
    toolBorder: '#49483E',
    code: '#E6DB74',
    heading1: '#FD971F',
    heading2: '#A6E22E',
    heading3: '#66D9EF',
    bullet: '#FD971F',
    dim: '#75715E',
    error: '#F92672',
    warning: '#FD971F',
    success: '#A6E22E',
    accent: '#AE81FF',
    inputLine: '#FD971F',
  },

  cyberpunk: {
    name: 'Cyberpunk',
    user: '#00FFFF',
    assistant: '#00FF41',
    tool: '#FF00FF',
    toolBorder: '#555555',
    code: '#FFFF00',
    heading1: '#FF6600',
    heading2: '#00FF41',
    heading3: '#00FFFF',
    bullet: '#FF6600',
    dim: '#888888',
    error: '#FF0044',
    warning: '#FF6600',
    success: '#00FF41',
    accent: '#FF00FF',
    inputLine: '#FF6600',
  },
};

export const THEME_NAMES = Object.keys(THEMES);

// ── React context ────────────────────────────────────────────────────────────

export const ThemeContext = React.createContext<Theme>(THEMES.default);

export function useTheme(): Theme {
  return React.useContext(ThemeContext);
}
