import type { CommandHandler } from './index.js';

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const SEARCH_TIMEOUT_MS = 10_000;

export const searchCommand: CommandHandler = async (args, ctx) => {
  if (args.length === 0) {
    return 'Usage: /search <query>\nExample: /search latest Node.js version';
  }

  const apiKey = ctx.config.tools?.web_search?.api_key;
  if (!apiKey) {
    return (
      '⚠️  Brave Search API key not configured.\n' +
      'Set tools.web_search.api_key in config.yaml or set WEB_SEARCH_API_KEY env var.\n' +
      'Get a free key at https://api.search.brave.com/app'
    );
  }

  const query = args.join(' ');

  const params = new URLSearchParams({
    q: query,
    count: '8',
    text_format: 'plain',
  });

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

    const response = await fetch(`${BRAVE_SEARCH_URL}?${params}`, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      return `❌ Brave Search API error ${response.status}: ${body.slice(0, 200)}`;
    }

    const data = await response.json() as {
      web?: { results?: Array<{ title: string; url: string; description: string }> };
      query?: { original: string };
    };

    if (!data.web?.results || data.web.results.length === 0) {
      return `🔍 No results found for: ${query}`;
    }

    const lines: string[] = [
      `🔍 **Search results for:** ${data.query?.original ?? query}`,
      '',
    ];

    for (let i = 0; i < data.web.results.length; i++) {
      const r = data.web.results[i]!;
      lines.push(`**${i + 1}. ${r.title}**`);
      lines.push(`   ${r.url}`);
      lines.push(`   ${r.description}`);
      lines.push('');
    }

    return lines.join('\n');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return '⏱️  Search timed out after 10s.';
    }
    const message = error instanceof Error ? error.message : String(error);
    return `❌ Search error: ${message}`;
  }
};
