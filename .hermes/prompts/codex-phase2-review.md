You have access to SocratiCode MCP tools: codebase_search (semantic search), codebase_graph_query (imports/dependents), codebase_symbol (symbol lookup), codebase_flow (execution flow tracing). Use them to understand the architecture BEFORE reading random files.

## Task: Full Codebase Analysis & Phase 2 Planning

This is **android-llm-cli** — an LLM agent TUI for Termux/desktop, built with React/Ink. Currently at **Phase 1 (MVP)** — security model is in place but has documented gaps.

### Step 1 — Read Documentation

Read these files first to understand the project context and roadmap:

1. `/root/projects/android-llm-cli/README.md` — project overview
2. `/root/projects/android-llm-cli/docs/bash-tool-security.md` — threat model, current protections, documented gaps, and Phase 2/3/4 roadmap

### Step 2 — Analyze Codebase via SocratiCode

Use the MCP tools to understand the architecture:

**Architecture:**
- `codebase_search("provider architecture streaming")` — understand provider pattern
- `codebase_search("agent loop tool execution")` — understand agent loop flow
- `codebase_search("tool registry confirmation")` — understand tool confirmation flow
- `codebase_search("security env filter blacklist")` — understand env protection
- `codebase_search("session storage journal")` — understand persistence

**Code graph:**
- `codebase_flow` — find entry points and execution flow
- `codebase_symbol("agentLoop")` — understand the core loop
- `codebase_symbol("needsConfirm")` — understand confirmation logic

**After MCP search, read key files directly:**
- `src/agent/agentLoop.ts` — core agent loop
- `src/tools/bash.ts` — bash tool implementation
- `src/security/needsConfirm.ts` — confirmation logic
- `src/providers/openai.ts` — provider streaming
- `src/tools/readFile.ts` — file reading with security
- `src/tools/writeFile.ts` — file writing with security
- `src/tools/registry.ts` — tool registry

### Step 3 — Code Review

Analyze the codebase and produce a structured review covering:

1. **Architecture** — component relationships, data flow, separation of concerns
2. **Security** — evaluate the threat model implementation vs documented gaps (Phase 1 status)
3. **Streaming & Rendering** — the `reasoningBatcher` fix we just merged (throttle reasoning chunks) — is it correct? Any edge cases?
4. **Provider Layer** — OpenAI provider handles reasoning_content, tool_calls, streaming — any bugs?
5. **UI Components** — MessageItem memoization, streaming render performance
6. **Error Handling** — retry logic, timeout handling, crash recovery (WAL journal)
7. **Phase 2 Gaps** — what specific items from bash-tool-security.md are Phase 2? Prioritise them.

### Step 4 — Phase 2 Recommendations

Based on the codebase analysis, recommend:
- What specific improvements belong in Phase 2 (non-underscore suffixed secrets, pattern detection)
- What would require significant refactoring vs quick wins
- Implementation priority order with rationale

### Output Format

Provide the review as structured markdown with:
- Executive summary (3-5 bullet points)
- Architecture analysis
- Security review with severity ratings (Critical/High/Medium/Low)
- Streaming performance assessment
- Phase 2 roadmap with implementation order
- Any bugs found

The project is at `/root/projects/android-llm-cli`. It's already indexed for SocratiCode.
