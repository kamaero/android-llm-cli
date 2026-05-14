import { TOOL_RESULT_MAX_BYTES } from '../constants.js';
import type { ITool, ToolContext } from '../types.js';

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const SEARCH_TIMEOUT_MS = 10_000;
const MAX_RESULTS = 8;

interface BraveWebResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
  query?: {
    original: string;
  };
}

function formatResult(exitCode: number, content: string): string {
  return `exit code: ${exitCode}\nstdout:\n${content}`;
}

export class WebSearchTool implements ITool {
  static readonly schema: Record<string, unknown> = {
    type: 'object',
    required: ['query'],
    properties: {
      query: {
        type: 'string',
        description: 'Search query — natural language or keywords.',
      },
      count: {
        type: 'number',
        description: 'Number of results to return (default 8, max 20).',
      },
    },
  };

  readonly name = 'web_search';

  readonly description = 'Search the web using Brave Search API. Returns title, URL, and snippet for each result. Use when you need current information, documentation, or public data.';

  readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  get schema(): Record<string, unknown> {
    return WebSearchTool.schema;
  }

  async execute(input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
    const query = typeof input.query === 'string' ? input.query.trim() : '';
    const count = typeof input.count === 'number' ? Math.min(Math.max(1, input.count), 20) : MAX_RESULTS;

    if (!query) {
      return formatResult(1, 'Query is required.');
    }

    if (!this.apiKey) {
      return formatResult(
        1,
        'Brave Search API key is not configured. Set tools.web_search.api_key in config.yaml or WEB_SEARCH_API_KEY env var.',
      );
    }

    const params = new URLSearchParams({
      q: query,
      count: String(count),
      text_format: 'plain',  // no markdown in snippets
    });

    const url = `${BRAVE_SEARCH_URL}?${params}`;

    try {
      const response = await fetch(url, {
        signal: ctx.signal,
        headers: {
          'Accept': 'application/json',
          'X-Subscription-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        return formatResult(1, `Brave Search API error ${response.status}: ${body.slice(0, 200)}`);
      }

      const data = (await response.json()) as BraveSearchResponse;

      if (!data.web?.results || data.web.results.length === 0) {
        return formatResult(0, `No results found for: ${query}`);
      }

      const lines: string[] = [];
      lines.push(`Search results for: ${data.query?.original ?? query}`);
      lines.push('');

      for (let i = 0; i < data.web.results.length; i++) {
        const r = data.web.results[i]!;
        lines.push(`${i + 1}. ${r.title}`);
        lines.push(`   URL: ${r.url}`);
        lines.push(`   ${r.description}`);
        lines.push('');
      }

      const output = lines.join('\n');
      const truncated = output.length > TOOL_RESULT_MAX_BYTES
        ? output.slice(0, TOOL_RESULT_MAX_BYTES) + `\n[...truncated, ${output.length} bytes total]`
        : output;

      return formatResult(0, truncated);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return formatResult(143, 'Search was cancelled.');
      }
      const message = error instanceof Error ? error.message : String(error);
      return formatResult(1, `Search error: ${message}`);
    }
  }
}
