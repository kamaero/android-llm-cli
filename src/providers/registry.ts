import type { IProvider, ProviderConfig } from '../types.js';
import { AnthropicProvider } from './anthropic.js';
import { OpenAIProvider } from './openai.js';

/**
 * Create a provider instance from config and the resolved API key.
 * Throws TypeError for unsupported provider types (e.g. 'gigachat').
 */
export function createProvider(config: ProviderConfig, apiKey: string): IProvider {
  switch (config.type) {
    case 'anthropic':
      return new AnthropicProvider(
        config.type, // use config key as provider name? No — the registry callers pass a name param; for now use type
        config.model,
        apiKey
      );
    case 'openai':
      return new OpenAIProvider(config.type, config.model, apiKey, config.baseUrl);
    default:
      throw new TypeError(
        `Unsupported provider type: "${(config as ProviderConfig).type}". ` +
          `Supported types: anthropic, openai.`
      );
  }
}
