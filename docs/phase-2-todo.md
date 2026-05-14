# Phase 2 — Safety & Streaming Hardening

> Codex review → fixes → done (6/7)

## ✅ Done

| # | Task | Commit | Description |
|---|------|--------|-------------|
| 1 | **Fix confirmation classification** | `d285a34` | Sensitive-path check BEFORE safe-command auto-approval. `cat ~/.ssh/id_rsa` и `echo > .env` теперь запрашивают подтверждение |
| 2 | **Expand env blacklist** | `d313b31` | `ENV_BLACKLIST_PATTERN` расширен: bare suffixes (`MYKEY`, `TOKEN123`, `SECRET2`), prefixes (`PWD_`, `SECRET_`, `KEY_`) |
| 3 | **Bash pattern detection** | `d285a34` | `bashRefsSensitivePath()` — эвристики для `.ssh`, `.env`, `.aws`, `*.pem`, `*.key` в командах bash |
| 4 | **Sensitive-path block in write_file** | `d285a34` | `WriteFileTool.execute()` — `isSensitivePath()` блокирует запись в `.env`/`.ssh`/конфиги |
| 5 | **WAL parity in agent mode** | `d313b31` | `agentLoop()` теперь пишет WAL-журнал через `appendWalEntry`. Краш-рековери работает для обоих режимов |
| 6 | **Reasoning batcher retry + chat mode** | `d285a34` | `reasoningContent` очищается при retry, chat mode использует тот же батчер. `handleStreamChunk` удалена |

## ❌ Phase 3 — Multi-tool turns

> Отложено — крупный рефакторинг (provider contract, reducer, confirm UX, loop control)

**Проблема:** Провайдер (OpenAI/Anthropic) может вернуть несколько `tool_calls` в одном ответе, но `agentLoop` собирает только один и прерывает стрим. Остальные дропаются.

**Что надо сделать:**

- [ ] `agentLoop.ts`: заменить `toolCall: ToolCall | null` на `toolCalls: ToolCall[]`
- [ ] Не `break` при первом `tool_call` — собирать все до `done`
- [ ] `app.tsx` reducer: поддержать множественные `SET_TOOL_CALL` или новое действие `SET_TOOL_CALLS`
- [ ] `needsConfirm.ts`: проверять все tool_calls (достаточно одного confirm на пачку)
- [ ] `ToolConfirmBox`: показывать "N tool calls to execute" вместо одного
- [ ] `executeToolCall` → `executeToolCalls`: выполнить все последовательно
- [ ] Проверить, что 'always' confirm mode корректно resume'ит

**Затрагиваемые файлы:**
- `src/agent/agentLoop.ts`
- `src/app.tsx`
- `src/ui/ToolConfirmBox.tsx`
- `src/security/needsConfirm.ts`
- `src/types.ts` (возможно новый тип действия)

---

*Codex review: https://github.com/kamaero/android-llm-cli/commit/d285a34*
*Phase 2 total: 6 файлов изменено, ~200 строк добавлено*
