import type { Page } from '@playwright/test';

/**
 * Resolves when the next matching updateDecisionInstance mutation succeeds.
 *
 * Arm it *before* the interaction that triggers the save, then await it after:
 * the process builder autosaves in the background, so asserting straight after
 * a click races the write.
 *
 * The API streams batch responses, so the headers land before the mutation has
 * run. The client refetches getInstance once it has read the result from the
 * body, so that request is the signal that the write has landed. (Do not wait
 * on `response.finished()` instead: Chromium never reports loadingFinished for
 * these streamed bodies, so it hangs — see a317d0f67.)
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
  await page.waitForRequest(
    (req) => /decision\.getInstance(\?|,|$)/.test(req.url()),
    { timeout: 12_000 },
  );
  return response;
}
