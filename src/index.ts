#!/usr/bin/env node
import React from 'react';
import {render} from 'ink';
import meow from 'meow';

import {App} from './app.js';

const cli = meow(
  `
    Usage
      $ a-llmcli

    Options
      --config  Path to config file
      --debug   Enable debug output
      --version Show version number
      --help    Show this help
  `,
  {
    importMeta: import.meta,
    flags: {
      config: {
        type: 'string'
      },
      debug: {
        type: 'boolean',
        default: false
      }
    }
  }
);

render(React.createElement(App));
