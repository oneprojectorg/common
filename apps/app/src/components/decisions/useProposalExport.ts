import { useEffect, useState } from 'react';

import { trpc } from '@op/api/client';
import { toast } from '@op/ui/Toast';

export const useProposalExport = () => {
  const [exportId, setExportId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const exportMutation = trpc.decision.export.useMutation();

  const { data: exportStatus } = trpc.decision.getExportStatus.useQuery(
    { exportId: exportId! },
    {
      enabled: !!exportId && isExporting,
      refetchInterval: 2000, // Poll every 2 seconds
    },
  );

  // Handle status changes
  useEffect(() => {
    if (!exportStatus || exportStatus.status === 'not_found') {
      return;
    }

    if (exportStatus.status === 'completed') {
      setIsExporting(false);

      // Auto-download the file
      if ('signedUrl' in exportStatus && exportStatus.signedUrl) {
        window.open(exportStatus.signedUrl, '_blank');
        toast.success({
          title: 'Export ready!',
          message: 'Your CSV file is being downloaded.',
        });
      }
    }

    if (exportStatus.status === 'failed') {
      setIsExporting(false);
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
    setIsExporting(true);

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
  };

  return {
    startExport,
    isExporting,
    exportStatus,
    reset,
  };
};
