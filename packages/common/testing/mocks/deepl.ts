import { vi } from 'vitest';

// `[ES]` sets a mock translation apart from a seeded cache entry (`[ES-CACHED]`).
export const mockTranslateText = vi.fn((texts: string | string[]) => {
  const arr = Array.isArray(texts) ? texts : [texts];
  const results = arr.map((t) => ({
    text: `[ES] ${t}`,
    detectedSourceLang: 'en',
  }));

  // Mirror deepl-node: a single-string input returns a single result object.
  return Array.isArray(texts) ? results : results[0];
});

export const deeplMock = {
  DeepLClient: class {
    translateText = mockTranslateText;
  },
};
