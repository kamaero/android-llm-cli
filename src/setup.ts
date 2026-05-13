#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const CONFIG_DIR = join(homedir(), '.config', 'a-llmcli');
const CONFIG_PATH = join(CONFIG_DIR, 'config.yaml');

const rl = readline.createInterface({ input, output });

async function ask(question: string, defaultVal?: string): Promise<string> {
  const hint = defaultVal ? ` [${defaultVal}]` : '';
  const answer = await rl.question(`${question}${hint}: `);
  return answer.trim() || defaultVal || '';
}

/**
 * Interactive setup wizard.
 * Creates config.yaml with provider(s) and security profile.
 */
export async function setupWizard(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   android-llm-cli — Setup Wizard         ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');

  // ── Provider ──
  console.log('Выберите LLM-провайдера:');
  console.log('  1) Anthropic (Claude) — рекомендуется');
  console.log('  2) OpenAI / DeepSeek / OpenRouter');
  const provChoice = await ask('Ваш выбор', '1');

  let providerType: string;
  let providerKey: string;
  let envVar: string;
  let model: string;
  let baseUrl: string | undefined;

  if (provChoice === '2') {
    providerType = 'openai';
    providerKey = await ask('  OpenAI / DeepSeek / OpenRouter API Key (или оставьте пустым для ${OPENAI_API_KEY})');
    envVar = providerKey ? '' : '${OPENAI_API_KEY}';
    console.log('');
    console.log('  Популярные модели:');
    console.log('    • deepseek-v4-flash  — DeepSeek V4 Flash');
    console.log('    • deepseek-v4-pro    — DeepSeek V4 Pro');
    console.log('    • gpt-4o            — OpenAI GPT-4o');
    console.log('    • gpt-4o-mini       — OpenAI GPT-4o Mini');
    console.log('    • deepseek-chat     — DeepSeek V3');
    model = await ask('  Model', 'deepseek-v4-flash');
    const baseUrlRaw = await ask('  Base URL (Enter для OpenAI, или укажите свой)', '');
    baseUrl = baseUrlRaw || undefined;
  } else {
    providerType = 'anthropic';
    providerKey = await ask('  Anthropic API Key (или оставьте пустым для ${ANTHROPIC_API_KEY})');
    envVar = providerKey ? '' : '${ANTHROPIC_API_KEY}';
    console.log('');
    console.log('  Популярные модели:');
    console.log('    • claude-sonnet-4-20250514  — Claude Sonnet 4');
    console.log('    • claude-3-5-haiku-latest   — Claude 3.5 Haiku');
    model = await ask('  Model', 'claude-sonnet-4-20250514');
  }

  // ── Security profile ──
  console.log('');
  console.log('Профиль безопасности:');
  console.log('  1) safe-chat (чат без agent mode — рекомендуется)');
  console.log('  2) code-workspace (агент в пределах ~/workspace)');
  console.log('  3) full-termux-agent (полный доступ — осторожно!)');
  const profileChoice = await ask('Ваш выбор', '1');

  const profileMap: Record<string, string> = {
    '1': 'safe-chat',
    '2': 'code-workspace',
    '3': 'full-termux-agent',
  };
  const profile = profileMap[profileChoice] || 'safe-chat';

  const workspace =
    profile === 'safe-chat'
      ? '/tmp'
      : await ask('  Путь к workspace', join(homedir(), 'workspace'));

  // ── Build config ──
  const apiKey = providerKey || envVar;

  const config: Record<string, unknown> = {
    default_provider: 'main',
    default_mode: profile === 'safe-chat' ? 'chat' : 'agent',
    environment: {
      type: 'termux',
      include_builtin_context: true,
    },
    session_policy: {
      profile,
      workspace_root: workspace,
      dry_run_first: true,
      bash_confirmation: 'always',
      file_confirmation: 'always',
      network_confirmation: 'always',
      peripheral_confirmation: 'always',
    },
    providers: {
      main: {
        type: providerType,
        api_key: apiKey,
        model,
        ...(baseUrl ? { base_url: baseUrl } : {}),
      },
    },
  };

  // ── Write config ──
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }

  const yaml = buildYaml(config);
  writeFileSync(CONFIG_PATH, yaml, 'utf-8');

  // chmod 600
  try {
    const { chmodSync } = await import('fs');
    chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // Not critical on all platforms
  }

  console.log('');
  console.log(`Конфиг сохранён: ${CONFIG_PATH}`);
  console.log('');

  if (!providerKey) {
    console.log('⚠ Не забудьте установить переменную окружения:');
    if (providerType === 'anthropic') {
      console.log('  export ANTHROPIC_API_KEY="sk-ant-..." >> ~/.bashrc');
    } else {
      console.log('  export OPENAI_API_KEY="sk-..." >> ~/.bashrc');
    }
    console.log('  source ~/.bashrc');
  }

  console.log('');
  console.log('Готово! Запустите: a-llmcli');
}

function buildYaml(obj: Record<string, unknown>, indent = 0): string {
  const pad = '  '.repeat(indent);
  const lines: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === '') continue;

    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${pad}${key}:`);
      lines.push(buildYaml(value as Record<string, unknown>, indent + 1));
    } else if (typeof value === 'string' && value.startsWith('${')) {
      lines.push(`${pad}${key}: ${value}`);
    } else if (typeof value === 'string') {
      lines.push(`${pad}${key}: "${String(value)}"`);
    } else {
      lines.push(`${pad}${key}: ${String(value)}`);
    }
  }

  return lines.join('\n');
}

// ── Run if called directly ──
const isMain = process.argv[1]?.includes('setup');
if (isMain) {
  setupWizard()
    .catch((err) => {
      console.error('Setup failed:', err);
      process.exit(1);
    })
    .finally(() => rl.close());
}
