import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

import type { CatalogEntry } from './catalog.ts';
import { writeFile } from './util.ts';

export interface CardCheck {
  /** Rendered height of the card's stories, for the preview's `height`. */
  height: number;
  /** Uncaught errors and stories whose error boundary caught. */
  errors: string[];
  /** Network requests the preview frame would not make either (map tiles, remote images). */
  blocked: string[];
}

export interface VerifyResult {
  cards: Record<string, CardCheck>;
  /** Every name the bundle puts on `window.Sense`. */
  exports: string[];
  /** Export names two modules define differently; the first module wins. */
  clashes: string[];
}

const NETWORK_ERROR = /Failed to fetch|AJAXError|NetworkError|ERR_/;

/**
 * Loads the built project in Chromium, the way the Design System page does
 * (tokens.css, bundle.css, the React libraries, bundle.js), with the network
 * cut off, and renders each card's stories.
 */
export async function verify(
  projectDir: string,
  entries: CatalogEntry[],
  options: { executablePath?: string; screenshotDir?: string },
): Promise<VerifyResult> {
  const browser = await chromium.launch(
    options.executablePath ? { executablePath: options.executablePath } : {},
  );
  const harness = resolve(projectDir, '.verify.html');
  const head = [
    '<!doctype html><html data-theme="light"><head><meta charset="utf-8">',
    '<link rel="stylesheet" href="tokens.css"><link rel="stylesheet" href="components/bundle.css">',
    '<script src="components/lib/react.production.min.js"></script>',
    '<script src="components/lib/react-dom.production.min.js"></script>',
    '<script src="components/bundle.js"></script>',
    '<style>body{margin:0;padding:16px}</style></head>',
  ].join('');

  try {
    const cards: Record<string, CardCheck> = {};
    let exports: string[] = [];
    let clashes: string[] = [];

    for (const entry of entries) {
      writeFile(
        harness,
        `${head}<body><div id="root"></div><script>window.Sense.__renderStories(document.getElementById('root'), ${JSON.stringify(entry.name)});</script></body></html>`,
      );
      const page = await browser.newPage({
        viewport: { width: 960, height: 600 },
      });
      const errors: string[] = [];
      const blocked: string[] = [];
      await page.route('**/*', (route) => {
        const url = route.request().url();
        if (url.startsWith('file:')) return route.continue();
        blocked.push(url);
        return route.abort();
      });
      page.on('pageerror', (error) => {
        if (!NETWORK_ERROR.test(error.message)) errors.push(error.message);
      });

      await page.goto(pathToFileURL(harness).href);
      await page.waitForTimeout(500);

      const result = await page.evaluate(() => {
        const root = document.getElementById('root');
        const sense = window.Sense ?? {};
        const clashList = sense.__clashes;
        return {
          height: Math.ceil((root?.getBoundingClientRect().height ?? 0) + 32),
          failed: [...document.querySelectorAll('[data-story-error]')].map(
            (node) => node.textContent ?? '',
          ),
          exports: Object.keys(sense).filter((key) => !key.startsWith('__')),
          clashes: Array.isArray(clashList)
            ? clashList.filter(
                (item): item is string => typeof item === 'string',
              )
            : [],
        };
      });
      exports = result.exports;
      clashes = result.clashes;
      cards[entry.name] = {
        height: result.height,
        errors: [...errors, ...result.failed],
        blocked,
      };
      if (options.screenshotDir) {
        await page.screenshot({
          path: resolve(options.screenshotDir, `${entry.name}.png`),
          fullPage: true,
        });
      }
      await page.close();
    }
    return { cards, exports, clashes };
  } finally {
    await browser.close();
  }
}
