#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const CONFIG_DIR = join(homedir(), '.config', 'a-llmcli');
const CONFIG_PATH = join(CONFIG_DIR, 'config.yaml');

// ── Hardcoded provider catalog ──

interface ModelEntry {
  id: string;
  label: string;
  defaultModel?: boolean;
}

interface ProviderEntry {
  id: string;
  label: string;
  type: 'anthropic' | 'openai';
  baseUrl?: string;
  models: ModelEntry[];
}

const PROVIDERS: ProviderEntry[] = [
  {
    id: 'anthropic',
    label: 'Anthropic (Claude)',
    type: 'anthropic',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4', defaultModel: true },
      { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
      { id: 'claude-3-5-haiku-latest', label: 'Claude Haiku 3.5' },
    ],
  },
  {
    id: 'openai',
    label: 'OpenAI (GPT)',
    type: 'openai',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', defaultModel: true },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'gpt-4.1', label: 'GPT-4.1' },
      { id: 'o3', label: 'o3' },
      { id: 'o4-mini', label: 'o4-mini' },
    ],
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    type: 'openai',
    baseUrl: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', defaultModel: true },
      { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro' },
      { id: 'deepseek-chat', label: 'DeepSeek V3 (deepseek-chat)' },
    ],
  },
  {
    id: 'kimi',
    label: 'Kimi (Moonshot)',
    type: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    models: [
      { id: 'kimi-latest', label: 'kimi-latest', defaultModel: true },
      { id: 'moonshot-v1-8k', label: 'moonshot-v1-8k' },
      { id: 'moonshot-v1-32k', label: 'moonshot-v1-32k' },
    ],
  },
  {
    id: 'xai',
    label: 'xAI (Grok)',
    type: 'openai',
    baseUrl: 'https://api.x.ai',
    models: [
      { id: 'grok-3', label: 'Grok 3', defaultModel: true },
      { id: 'grok-3-mini', label: 'Grok 3 Mini' },
    ],
  },
];

async function ask(rl: readline.Interface, question: string, defaultVal?: string): Promise<string> {
  const hint = defaultVal ? ` [${defaultVal}]` : '';
  const answer = await rl.question(`  ${question}${hint}: `);
  return answer.trim() || defaultVal || '';
}

async function select(rl: readline.Interface, label: string, choices: { key: string; label: string }[]): Promise<string> {
  console.log(`\n  ${label}:`);
  for (const c of choices) {
    console.log(`    ${c.key}) ${c.label}`);
  }
  const answer = await rl.question(`  > `);
  const match = choices.find((c) => c.key === answer.trim());
  if (match) return match.key;
  // fallback to first
  return choices[0]?.key || '';
}

function buildTestUrl(baseUrl: string | undefined, path: string): string {
  if (!baseUrl) return `https://api.openai.com/v1${path}`;
  // Remove trailing slash, add /v1 if it's not there
  const base = baseUrl.replace(/\/$/, '');
  const normalized = base.endsWith('/v1') ? base : `${base}/v1`;
  return `${normalized}${path}`;
}

async function testProvider(
  type: 'anthropic' | 'openai',
  baseUrl: string | undefined,
  model: string,
  apiKey: string,
): Promise<boolean> {
  try {
    if (type === 'anthropic') {
      const url = 'https://api.anthropic.com/v1/messages';
      const body = JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'respond with just: ok' }],
      });
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.log(`  ✗ Error ${resp.status}: ${text.slice(0, 200)}`);
        return false;
      }
      const data = (await resp.json()) as { content?: { text?: string }[] };
      console.log(`  ✓ Success! Response: ${data.content?.[0]?.text || 'ok'}`);
      return true;
    } else {
      const url = buildTestUrl(baseUrl, '/chat/completions');
      const body = JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: 'user', content: 'respond with just: ok' }],
      });
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body,
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        console.log(`  ✗ Error ${resp.status}: ${text.slice(0, 200)}`);
        return false;
      }
      const data = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
      const reply = data.choices?.[0]?.message?.content || 'ok';
      console.log(`  ✓ Success! Response: ${reply}`);
      return true;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`  ✗ Connection error: ${msg.slice(0, 150)}`);
    return false;
  }
}

export async function setupWizard(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  try {
    console.log('');
    console.log('  ╔══════════════════════════════════════════╗');
    console.log('  ║   android-llm-cli — Setup Wizard         ║');
    console.log('  ╚══════════════════════════════════════════╝');

    // ── 1. Select provider ──
    const provKey = await select(rl, 'Choose a provider', [
      { key: '1', label: `${PROVIDERS[0]!.label} — Sonnet, Opus, Haiku` },
      { key: '2', label: `${PROVIDERS[1]!.label} — GPT-4o, GPT-4.1, o3` },
      { key: '3', label: `${PROVIDERS[2]!.label} — V4 Flash, V4 Pro, V3` },
      { key: '4', label: `${PROVIDERS[3]!.label} — kimi-latest` },
      { key: '5', label: `${PROVIDERS[4]!.label} — Grok 3` },
    ]);

    const provider = PROVIDERS[parseInt(provKey) - 1] || PROVIDERS[0]!;

    // ── 2. Select model ──
    const modelKey = await select(rl, 'Choose a model', provider.models.map((m, i) => ({
      key: String(i + 1),
      label: `${m.label}${m.defaultModel ? ' (default)' : ''}`,
    })));

    const model = provider.models[parseInt(modelKey) - 1] || provider.models.find((m) => m.defaultModel) || provider.models[0]!;

    // ── 3. API key ──
    const envVarName =
      provider.type === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY';

    console.log('');
    const keyRaw = await rl.question(
      `  API Key (Enter = use \${${envVarName}} from environment):\n  > `,
    );
    const useEnv = keyRaw.trim() === '';
    const apiKey = useEnv ? `\${${envVarName}}` : keyRaw.trim();

    // ── 4. Test connection ──
    console.log('');
    if (!useEnv && apiKey) {
      console.log('  Testing connection...');
      const ok = await testProvider(provider.type, provider.baseUrl, model.id, apiKey);
      if (!ok) {
        const retry = await rl.question('  Save config anyway? (y/N) ');
        if (retry.toLowerCase() !== 'y') {
          console.log('  Cancelled. Run a-llmcli setup again.');
          return;
        }
      }
    } else {
      console.log('  ${' + envVarName + '} — test skipped (key from environment variable)');
    }

    // ── 5. Security mode ──
    const securityKey = await select(rl, 'Security mode', [
      { key: '1', label: 'normal — smart auto-approval for safe commands (recommended)' },
      { key: '2', label: 'hardcore — full auto-execution without confirmations (risky!)' },
    ]);
    const securityMode = securityKey === '2' ? 'hardcore' : 'normal';

    const workspaceDefault = join(homedir(), 'projects');
    const workspace = await ask(rl, 'Workspace root directory', workspaceDefault);

    // ── 6. Build config ──
    const config: Record<string, unknown> = {
      default_provider: 'main',
      default_mode: 'agent',
      environment: {
        type: 'termux',
        include_builtin_context: true,
      },
      security: {
        mode: securityMode,
        workspace_root: workspace,
      },
      providers: {
        main: {
          type: provider.type,
          api_key: apiKey,
          model: model.id,
          ...(provider.baseUrl ? { base_url: provider.baseUrl } : {}),
        },
      },
    };

    // ── Write config ──
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }

    // Use js-yaml instead of custom buildYaml to properly escape strings
    const { dump } = await import('js-yaml');
    const yaml = dump(config, { lineWidth: 120, quotingType: '"' });
    writeFileSync(CONFIG_PATH, yaml, 'utf-8');

    // chmod 600
    try {
      const { chmodSync } = await import('fs');
      chmodSync(CONFIG_PATH, 0o600);
    } catch {
      // not critical
    }

    console.log('');
    console.log(`  ✓ Config saved: ${CONFIG_PATH}`);
    console.log('');

    if (useEnv) {
      console.log(`  ⚠ Don't forget to set the environment variable:`);
      console.log(`    export ${envVarName}="..." >> ~/.bashrc`);
      console.log(`    source ~/.bashrc`);
    }

    console.log('');
    console.log(`  Done! Run: a-llmcli`);
  } finally {
    rl.close();
  }
}

// setupWizard is exported and called from index.ts
