import { db } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
import { inArray } from 'drizzle-orm';

import { hashContent } from '../../services/translation/hashContent';

/**
 * Seeds and cleans up `content_translations` rows for testing cache behavior.
 * Each instance registers cleanup via vitest's `onTestFinished` so rows are
 * removed even if the test fails.
 */
export class TestTranslationDataManager {
  private cleanupRegistered = false;
  private onTestFinishedCallback: (fn: () => void | Promise<void>) => void;
  private createdIds: string[] = [];

  constructor(onTestFinished: (fn: () => void | Promise<void>) => void) {
    this.onTestFinishedCallback = onTestFinished;
  }

  async seedTranslation({
    contentKey,
    sourceText,
    translatedText,
    sourceLocale,
    targetLocale,
  }: {
    contentKey: string;
    sourceText: string;
    translatedText: string;
    sourceLocale: string;
    targetLocale: string;
  }): Promise<void> {
    this.ensureCleanupRegistered();

    const contentHash = hashContent(sourceText);

    const [row] = await db
      .insert(contentTranslations)
      .values({
        contentKey,
        contentHash,
        sourceLocale,
        targetLocale,
        translated: translatedText,
      })
      .returning({ id: contentTranslations.id });

    if (row) {
      this.createdIds.push(row.id);
    }
  }

  private ensureCleanupRegistered(): void {
    if (this.cleanupRegistered) {
      return;
    }

    this.onTestFinishedCallback(async () => {
      await this.cleanup();
    });

    this.cleanupRegistered = true;
  }

  async cleanup(): Promise<void> {
    if (this.createdIds.length > 0) {
      await db
        .delete(contentTranslations)
        .where(inArray(contentTranslations.id, this.createdIds));
    }
  }
}
