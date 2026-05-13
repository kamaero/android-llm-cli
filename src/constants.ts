// Output buffer limits — anti-OOM for Termux / Android
export const BASH_OUTPUT_BUFFER_MAX = 50 * 1024;       // stdout/stderr buffer
export const TOOL_RESULT_MAX_BYTES = 8 * 1024;          // tool_result sent to LLM
export const ARTIFACT_MAX_BYTES = 50 * 1024;            // file artifact saved to disk
export const JOURNAL_SUMMARY_MAX = 2 * 1024;            // outputSummary in JSONL journal entry

// Agent loop limits
export const AGENT_LOOP_MAX_ITERATIONS_MVP = 5;         // Phase 1 (Termux smoke buffer)
export const AGENT_LOOP_MAX_ITERATIONS_TARGET = 10;     // Phase 2 (stable)
