import type { Page } from '@playwright/test';

/**
 * Resolves when the next matching updateDecisionInstance mutation succeeds.
 *
 * Arm it *before* the interaction that triggers the save, then await it after:
 * the process builder autosaves in the background, so asserting straight after
 * a click races the write.
 *
 * The API streams batch responses, so the headers land before the mutation has
 * run; `finished()` waits for the body, which is written once it has.
 *
 * Pass `requestBodyIncludes` to wait for a specific save rather than whichever
 * one lands first — the builder saves several fields independently.
 */
export async function waitForAutoSave(
  page: Page,
  requestBodyIncludes?: string,
) {
  const response = await page.waitForResponse(
    (resp) => {
      if (
        !resp.url().includes('decision.updateDecisionInstance') ||
        !resp.ok()
      ) {
        return false;
      }

      if (!requestBodyIncludes) {
        return true;
      }

      return resp.request().postData()?.includes(requestBodyIncludes) ?? false;
    },
    { timeout: 12_000 },
  );
  await response.finished();
  return response;
}
