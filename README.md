# android-llm-cli

> LLM-агент прямо в Termux. Чат, bash, файлы — без выхода из терминала.

[![Tests](https://github.com/kamaero/android-llm-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/kamaero/android-llm-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)

---

## Быстрый старт

**Одной командой на Termux:**

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/kamaero/android-llm-cli/main/install.sh)
```

Или вручную:

```bash
pkg install git nodejs
git clone https://github.com/kamaero/android-llm-cli.git
cd android-llm-cli
npm install && npm run build
npm install -g .
```

---

## Настройка API

После установки добавь API-ключ:

```bash
# в ~/.bashrc (рекомендуется — ключ не хранится в файле)
echo 'export ANTHROPIC_API_KEY="sk-ant-..."' >> ~/.bashrc
source ~/.bashrc
```

Или создай config.yaml:

```bash
a-llmcli setup
```

Мастер создаст `~/.config/a-llmcli/config.yaml` и предложит ввести ключи интерактивно.

**Поддерживаемые провайдеры:**

| Провайдер | Тип в config | API key env var |
|-----------|-------------|-----------------|
| Anthropic (Claude) | `anthropic` | `ANTHROPIC_API_KEY` |
| OpenAI / DeepSeek / OpenRouter | `openai` | `OPENAI_API_KEY` |

> **Безопасность:** Храни `config.yaml` как `~/.ssh/id_rsa` — это секрет.
> Используй `${ENV_VAR}` interpolation, чтобы не держать ключи в файле.

---

## Использование

```bash
# Базовый чат
a-llmcli

# Agent mode (LLM может запускать bash, читать/писать файлы)
a-llmcli --mode agent

# Offline-режим (без интернета, для теста)
a-llmcli --mock

# Agent mode offline
a-llmcli --mock --mode agent
```

### Slash-команды

| Команда | Описание |
|---------|----------|
| `/clear` | Очистить историю сессии |
| `/model` | Показать текущую модель |
| `/mode` | Переключить chat/agent |
| `/help` | Справка по командам |
| `/retry` | Повторить последний запрос |

---

## Примеры

**Чат:**

```
$ a-llmcli --mock
┌────────────────────────────────────────────────────┐
│ > Напиши рифму про терминал                        │
└────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐
│ Hello from mock!                                   │
│ mock │ mock-model │ chat │ tokens: 15              │
└────────────────────────────────────────────────────┘
```

**Agent mode (LLM выполняет bash):**

```
$ a-llmcli --mock --mode agent
┌────────────────────────────────────────────────────┐
│ > Покажи содержимое текущей папки                  │
└────────────────────────────────────────────────────┘
┌────────────────────────────────────────────────────┐
│ 🤖 Mock вызывает bash("ls -la")                    │
│ ┌────────────────────────────────────────────────┐ │
│ │ Allow bash with {"command":"ls -la"}? (y/N)    │ │
│ └────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────┘
```

---

## Безопасность

### Что покрывает a-llmcli

- **Никакой tool не выполняется без явного `y`** от пользователя. Каждый вызов bash, read_file, write_file требует интерактивного подтверждения.
- **API-ключи фильтруются** из окружения bash subprocess'а. Даже если LLM попросит `echo $ANTHROPIC_API_KEY` — ответ будет пустым.
- **Sensitive пути блокируются**: `.ssh/`, `.aws/`, `.env`, `config.yaml`, `*.pem`, `*.key` — read_file на них вернёт ошибку.
- **Timeout на bash**: 30 секунд по умолчанию. После SIGTERM → 2s grace → SIGKILL. Никаких зависших процессов.
- **Трекинг токенов** и лимит вывода (50KB) — CLI не упадёт от переполнения памяти.
- **WAL-журнал**: при SIGKILL сессия восстанавливается после перезапуска.

### Что НЕ покрывает a-llmcli

- Если вы подтверждаете команду, мы её выполняем. **Внимательно читайте preview перед нажатием `y`.**
- Inject через содержимое файлов: LLM может прочитать README с вредоносными инструкциями и предложить опасную команду. Окончательное решение — за вами.
- Network exfil через DNS, ICMP, скрытые туннели — частично подсвечивается, но не блокируется.
- Multi-user / shared Termux — не оптимизировано.
- Root / jailbreak — out of scope.

### Безопасное использование

- Храните `config.yaml` как `~/.ssh/id_rsa` — это секрет.
- Используйте `${ENV_VAR}` interpolation, чтобы не держать ключи в файле.
- Запускайте в режиме `chat` по умолчанию. Переключайтесь в `agent` только когда явно нужно.
- Не игнорируйте предупреждения — они появляются, когда AI запросило что-то потенциально опасное.

---

## Установка из исходников (для разработки)

```bash
git clone https://github.com/kamaero/android-llm-cli.git
cd android-llm-cli
npm install
npm run build

# Линковка для разработки
npm link
a-llmcli --help
```

### Запуск тестов

```bash
npm test            # vitest — 186+ тестов
npm run build       # TypeScript strict mode
```

---

## Архитектура

```
src/
├── index.ts              # Точка входа, CLI-флаги (meow)
├── app.tsx               # React/Ink UI, reducer, agent loop
├── types.ts              # Все типы и интерфейсы
├── schemas.ts            # Zod-схемы для config.yaml
├── providers/            # IProvider + адаптеры
│   ├── IProvider.ts
│   ├── anthropic.ts
│   ├── openai.ts
│   ├── mock.ts           # Offline-режим для тестов
│   └── registry.ts
├── tools/                # Инструменты для agent mode
│   ├── bash.ts           # Запуск команд с env-фильтром
│   ├── readFile.ts       # Безопасное чтение файлов
│   ├── writeFile.ts      # Запись файлов (workspace-bound)
│   └── shell.ts          # Детект шелла
├── agent/                # Agent loop
│   └── agentLoop.ts
├── ui/                   # Ink-компоненты
│   ├── Layout.tsx
│   ├── InputBox.tsx
│   ├── MessageList.tsx
│   ├── MessageItem.tsx
│   ├── ToolConfirmBox.tsx
│   ├── StatusBar.tsx
│   ├── CodeBlock.tsx
│   └── RecoveryPrompt.tsx
├── streaming/            # Стриминг + retry
├── storage/              # Сессии, WAL, config
├── prompts/              # Системные промпты
└── commands/             # Slash-команды
```

---

## Для чего это

Замена Claude Code / Codex CLI на Android. Всё, что эти инструменты делают на desktop — работает на телефоне через Termux: разработка, деплой, администрирование, работа с файлами.

### Возможности

- ✅ Чат с Claude / OpenAI / DeepSeek / OpenRouter
- ✅ Agent mode — LLM запускает bash, читает/пишет файлы
- ✅ Офлайн-тестирование через `--mock`
- ✅ Crash recovery — WAL после SIGKILL
- ✅ Retry с exponential backoff
- ✅ Подсветка синтаксиса в ответах (highlight.js)
- ✅ Safety: env-filter, timeout, sensitive paths, per-call confirm

### В разработке (Phase 2)

- `/compact` — суммаризация длинных сессий
- Multi-tool batch confirm
- Edit tool input перед выполнением
- Отмена посреди agent loop
- GigaChat / YandexGPT провайдеры

---

## Лицензия

MIT © Kam Aero
