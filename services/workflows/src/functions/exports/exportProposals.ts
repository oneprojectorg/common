import { createClient } from 'redis';

import { listProposals } from '@op/common/services/decision';
import { generateProposalsCsv } from '@op/common/services/decision/exports';
import { db } from '@op/db/client';
import { users } from '@op/db/schema';
import { Events, inngest } from '@op/events';
import { createSBServerClient } from '@op/supabase/server';
import { eq } from 'drizzle-orm';

const REDIS_URL = process.env.REDIS_URL;

// Create Redis client for status updates
let redis: ReturnType<typeof createClient> | null = null;

if (REDIS_URL) {
  redis = createClient({
    url: REDIS_URL,
    disableOfflineQueue: true,
  });

  redis.on('error', (err) => {
    console.error('Redis Client Error in export workflow:', err);
  });

  // Connect to Redis
  if (!redis.isOpen) {
    redis.connect().catch(console.error);
  }
}

// Helper to update export status in Redis
async function updateExportStatus(exportId: string, data: any) {
  if (!redis) {
    console.warn('Redis not available, cannot update export status');
    return;
  }

  const key = `export:proposal:${exportId}`;
  const ttl = 24 * 60 * 60; // 24 hours in seconds

  try {
    // Get existing data
    const existing = await redis.get(key);
    const existingData = existing ? JSON.parse(existing) : {};

    // Merge with new data
    const updated = { ...existingData, ...data };

    // Save to Redis with TTL
    await redis.setEx(key, ttl, JSON.stringify(updated));
  } catch (error) {
    console.error('Failed to update export status:', error);
  }
}

const { proposalExportRequested } = Events;

export const exportProposals = inngest.createFunction(
  {
    id: 'exportProposals',
  },
  { event: proposalExportRequested.name },
  async ({ event, step }) => {
    // Validate event data
    const { exportId, processInstanceId, userId, format, filters } =
      proposalExportRequested.schema.parse(event.data);

    // Step 1: Update status to processing
    await step.run('update-status-processing', async () => {
      await updateExportStatus(exportId, {
        status: 'processing',
        exportId,
        processInstanceId,
        userId,
        format,
        filters,
        createdAt: new Date().toISOString(),
      });
    });

    try {
      // Step 2: Fetch proposals
      const proposals = await step.run('fetch-proposals', async () => {
        // Get user from database
        const userRecord = await db.query.users.findFirst({
          where: eq(users.id, userId),
        });

        if (!userRecord) {
          throw new Error('User not found');
        }

        const result = await listProposals({
          input: {
            processInstanceId,
            categoryId: filters.categoryId,
            submittedByProfileId: filters.submittedByProfileId,
            status: filters.status,
            dir: filters.dir,
            limit: 1000, // High limit for exports
            authUserId: userId,
          },
          user: userRecord as any,
        });

        return result.proposals;
      });

      // Step 3: Generate file based on format
      const { content, extension, mimeType } = await step.run(
        'generate-file',
        async () => {
          if (format === 'csv') {
            return {
              content: await generateProposalsCsv(proposals),
              extension: 'csv',
              mimeType: 'text/csv',
            };
          }

          throw new Error(`Unsupported format: ${format}`);
        },
      );

      // Step 4: Upload to Supabase storage
      const { fileName, signedUrl } = await step.run(
        'upload-to-storage',
        async () => {
          const supabase = await createSBServerClient();
          const timestamp = Date.now();
          const fileName = `proposals_export_${timestamp}.${extension}`;
          const filePath = `exports/proposals/${processInstanceId}/${fileName}`;

          // Upload CSV to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from('assets')
            .upload(filePath, Buffer.from(content), {
              contentType: mimeType,
              upsert: false,
            });

          if (uploadError) {
            throw new Error(`Storage upload failed: ${uploadError.message}`);
          }

          // Generate 24-hour signed URL
          const { data: urlData, error: urlError } = await supabase.storage
            .from('assets')
            .createSignedUrl(filePath, 60 * 60 * 24); // 24 hours

          if (urlError || !urlData) {
            throw new Error(
              `Failed to create signed URL: ${urlError?.message}`,
            );
          }

          return {
            fileName,
            signedUrl: urlData.signedUrl,
          };
        },
      );

      // Step 5: Update status to completed
      await step.run('update-status-completed', async () => {
        await updateExportStatus(exportId, {
          status: 'completed',
          fileName,
          signedUrl,
          urlExpiresAt: new Date(
            Date.now() + 24 * 60 * 60 * 1000,
          ).toISOString(),
          completedAt: new Date().toISOString(),
        });
      });

      return { exportId, status: 'completed' };
    } catch (error) {
      // Update status to failed
      await step.run('update-status-failed', async () => {
        await updateExportStatus(exportId, {
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date().toISOString(),
        });
      });

      throw error;
    }
  },
);
