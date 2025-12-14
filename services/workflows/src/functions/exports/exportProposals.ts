import { get, set } from '@op/cache';
import {
  assertUserByAuthId,
  generateProposalsCsv,
  listProposals,
} from '@op/common';
import { Events, inngest } from '@op/events';
import { createSBServiceClient } from '@op/supabase/server';

type ProposalFromList = Awaited<
  ReturnType<typeof listProposals>
>['proposals'][number];

// Helper to get cache key for export status
const getExportCacheKey = (exportId: string) => `export:proposal:${exportId}`;

// Helper to update export status in cache
const updateExportStatus = async (exportId: string, updates: any) => {
  const key = getExportCacheKey(exportId);
  const existing = await get(key);
  const updated = { ...(existing || {}), ...updates };
  await set(key, updated, 2 * 60 * 60); // 2 hours
};

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
        const userRecord = await assertUserByAuthId(userId);

        const result = await listProposals({
          input: {
            processInstanceId,
            categoryId: filters.categoryId,
            submittedByProfileId: filters.submittedByProfileId,
            status: filters.status,
            dir: filters.dir,
            limit: 1000, // High limit for exports
            authUserId: userId,
            skipAccessCheck: true, // Access already verified when export was created
          },
          user: userRecord as any,
        });

        return result.proposals;
      });

      const { content, extension, mimeType } = await step.run(
        'generate-file',
        async () => {
          if (format === 'csv') {
            return {
              content: await generateProposalsCsv(
                proposals as ProposalFromList[],
              ),
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
          // Use service role client to bypass RLS in background job
          const supabase = createSBServiceClient();
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

          // Generate 2-hour signed URL
          const { data: urlData, error: urlError } = await supabase.storage
            .from('assets')
            .createSignedUrl(filePath, 2 * 60 * 60); // 2 hours

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
