import { accessSync, constants, existsSync } from 'node:fs';

function isExecutable(path: string | undefined): path is string {
  if (!path) {
    return false;
  }

  try {
    accessSync(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export function detectShell(): string {
  if (isExecutable(process.env.SHELL)) {
    return process.env.SHELL;
  }

  const prefix = process.env.PREFIX;
  const termuxBash = prefix ? `${prefix}/bin/bash` : undefined;

  if (termuxBash && existsSync(termuxBash)) {
    return termuxBash;
  }

  return 'sh';
}
