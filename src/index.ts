#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';

import { App } from './app.js';
import { loadConfig } from './storage/config.js';
import { setupWizard } from './setup.js';
import type { ConfigType } from './schemas.js';

const cli = meow(
  `
    Usage
      $ a-llmcli
      $ a-llmcli setup      # Interactive config wizard

    Options
      --config  Path to config file
      --mock    Use MockProvider (no config file needed, offline mode)
      --mode    Session mode: chat or agent (default: chat)
      --debug   Enable debug output
      --version Show version number
      --help    Show this help
  `,
  {
    importMeta: import.meta,
    flags: {
      config: {
        type: 'string',
      },
      mock: {
        type: 'boolean',
        default: false,
      },
      mode: {
        type: 'string',
        default: 'chat',
      },
      debug: {
        type: 'boolean',
        default: false,
      },
    },
  },
);

// ── Subcommand: setup ──
if (cli.input.includes('setup')) {
  await setupWizard().catch((err) => {
    console.error('Setup failed:', err);
    process.exit(1);
  });
  process.exit(0);
}

// ── Normal launch ──
let config: ConfigType;

if (cli.flags.mock) {
  config = {
    default_provider: 'mock',
    default_mode: (cli.flags.mode === 'agent' ? 'agent' : 'chat') as 'chat' | 'agent',
    environment: {
      type: 'termux',
      include_builtin_context: true,
    },
    session_policy: {
      profile: 'safe-chat',
      workspace_root: '/tmp',
      dry_run_first: true,
      bash_confirmation: 'always',
      file_confirmation: 'always',
      network_confirmation: 'always',
      peripheral_confirmation: 'always',
    },
    providers: {
      mock: { type: 'mock' as const, api_key: '', model: 'mock-model' },
    },
  } as ConfigType;
} else {
  config = loadConfig(cli.flags.config);
}

render(React.createElement(App, { config }));
