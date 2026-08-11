import { db } from '@op/db/client';
import { contentTranslations } from '@op/db/schema';
import type { TranslationFormat } from '@op/translation';
import { hashContent } from '@op/translation';
import { inArray } from 'drizzle-orm';

/**
 * Seeds and cleans up `content_translations` rows for testing cache behavior.
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
    format = 'html',
  }: {
    contentKey: string;
    sourceText: string;
    translatedText: string;
    sourceLocale: string;
    targetLocale: string;
    /**
     * Must match the format the service sends the entry with — the hash folds
     * it in, so seeding a plain field as `html` produces a key nothing looks up.
     */
    format?: TranslationFormat;
  }): Promise<void> {
    this.ensureCleanupRegistered();

    const contentHash = hashContent(sourceText, format);

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
