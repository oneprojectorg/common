'use client';

import { trpc } from '@op/api/client';
import type { proposalEncoder } from '@op/api/encoders';
import { Menu, MenuItem } from '@op/ui/Menu';
import { OptionMenu } from '@op/ui/OptionMenu';
import { toast } from '@op/ui/Toast';
import { LuCheck, LuX } from 'react-icons/lu';
import { z } from 'zod';

import { useTranslations } from '@/lib/i18n';

type Proposal = z.infer<typeof proposalEncoder>;

interface ProposalCardMenuProps {
  proposal: Proposal;
}

export function ProposalCardMenu({ proposal }: ProposalCardMenuProps) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  const updateStatusMutation = trpc.decision.updateProposalStatus.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      if (proposal.processInstance?.id) {
        await utils.decision.listProposals.cancel({
          processInstanceId: proposal.processInstance.id,
        });
      }

      // Snapshot the previous value
      const previousListData = proposal.processInstance?.id
        ? utils.decision.listProposals.getData({
            processInstanceId: proposal.processInstance.id,
          })
        : null;

      // Optimistically update list data
      if (previousListData && proposal.processInstance?.id) {
        const optimisticListData = {
          ...previousListData,
          proposals: previousListData.proposals.map((p) =>
            p.id === proposal.id
              ? {
                  ...p,
                  status: variables.status,
                }
              : p
          ),
        };
        utils.decision.listProposals.setData(
          { processInstanceId: proposal.processInstance.id },
          optimisticListData
        );
      }

      return { previousListData };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previousListData && proposal.processInstance?.id) {
        utils.decision.listProposals.setData(
          { processInstanceId: proposal.processInstance.id },
          context.previousListData
        );
      }

      toast.error({
        message: error.message || t('Failed to update proposal status'),
      });
    },
    onSuccess: (_, variables) => {
      const statusMessage = variables.status === 'approved'
        ? t('Proposal approved successfully')
        : t('Proposal rejected successfully');

      toast.success({
        message: statusMessage,
      });
    },
    onSettled: () => {
      // Always refetch after error or success
      if (proposal.processInstance?.id) {
        utils.decision.listProposals.invalidate({
          processInstanceId: proposal.processInstance.id,
        });
      }
    },
  });

  const handleApprove = () => {
    updateStatusMutation.mutate({
      proposalId: proposal.id,
      status: 'approved',
    });
  };

  const handleReject = () => {
    updateStatusMutation.mutate({
      proposalId: proposal.id,
      status: 'rejected',
    });
  };

  const isLoading = updateStatusMutation.isPending;

  return (
    <OptionMenu className="absolute right-2 top-2 aria-expanded:bg-neutral-gray1">
      <Menu className="min-w-48 p-2">
        <MenuItem
          key="approve"
          onAction={handleApprove}
          className="px-3 py-2 text-functional-green"
          isDisabled={isLoading || proposal.status === 'approved'}
        >
          <LuCheck className="size-4" />
          {t('Approve Proposal')}
        </MenuItem>
        <MenuItem
          key="reject"
          onAction={handleReject}
          className="px-3 py-2 text-functional-red"
          isDisabled={isLoading || proposal.status === 'rejected'}
        >
          <LuX className="size-4" />
          {t('Reject Proposal')}
        </MenuItem>
      </Menu>
    </OptionMenu>
  );
}