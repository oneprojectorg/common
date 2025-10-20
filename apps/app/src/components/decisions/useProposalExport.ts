import { trpc } from '@op/api/client';
import { toast } from '@op/ui/Toast';
import { useEffect, useState } from 'react';

export const useProposalExport = () => {
  const [exportId, setExportId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloadReady, setIsDownloadReady] = useState(false);

  const exportMutation = trpc.decision.export.useMutation();

  // Use nil UUID when no exportId to satisfy UUID validation
  const { data: exportStatus } = trpc.decision.getExportStatus.useQuery(
    { exportId: exportId || '' },
    {
      enabled: !!exportId && isExporting,
      refetchInterval: 2000,
      gcTime: 0, // Don't cache query results
      staleTime: 0, // Always fetch fresh data
      retry: false, // Don't retry validation errors
    },
  );

  // Handle status changes
  useEffect(() => {
    if (!exportStatus || exportStatus.status === 'not_found') {
      return;
    }

    if (exportStatus.status === 'completed') {
      setIsExporting(false);
      setIsDownloadReady(true);
    }

    if (exportStatus.status === 'failed') {
      setIsExporting(false);
      setIsDownloadReady(false);
      toast.error({
        title: 'Export failed',
        message:
          'errorMessage' in exportStatus
            ? exportStatus.errorMessage
            : 'Unknown error occurred',
      });
    }
  }, [exportStatus]);

  const startExport = async (
    filters: {
      processInstanceId: string;
      categoryId?: string;
      dir?: 'asc' | 'desc';
      proposalFilter?: 'all' | 'my' | 'shortlisted' | 'my-ballot';
    },
    format: 'csv' = 'csv',
  ) => {
    // Clear any previous export state before starting new one
    setExportId(null);
    setIsExporting(true);
    setIsDownloadReady(false);

    try {
      const { exportId: newExportId } = await exportMutation.mutateAsync({
        ...filters,
        format,
      });

      setExportId(newExportId);

      toast.status({
        code: 200,
        message: `Generating ${format.toUpperCase()} export...`,
      });
    } catch (error) {
      setIsExporting(false);
      toast.error({
        title: 'Failed to start export',
        message: 'Please try again later.',
      });
    }
  };

  const reset = () => {
    setExportId(null);
    setIsExporting(false);
    setIsDownloadReady(false);
  };

  // Extract download URL and filename when ready
  const downloadUrl =
    exportStatus?.status === 'completed' && 'signedUrl' in exportStatus
      ? exportStatus.signedUrl
      : null;

  const downloadFileName =
    exportStatus?.status === 'completed' && 'fileName' in exportStatus
      ? exportStatus.fileName
      : 'proposals_export.csv';

  return {
    startExport,
    isExporting,
    isDownloadReady,
    downloadUrl,
    downloadFileName,
    exportStatus,
    reset,
  };
};
