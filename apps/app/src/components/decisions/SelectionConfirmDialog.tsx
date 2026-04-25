'use client';

import type { Proposal } from '@op/common/client';
import { Button } from '@op/ui/Button';
import { Dialog, DialogTrigger } from '@op/ui/Dialog';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';

import { useTranslations } from '@/lib/i18n';

import {
  ProposalCard,
  ProposalCardCategory,
  ProposalCardContent,
  ProposalCardHeader,
} from './ProposalCard';

interface SelectionConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  proposals: Proposal[];
  count: number;
  phaseName: string;
  onConfirm: () => void;
  isSubmitting: boolean;
  triggerDisabled: boolean;
}

export const SelectionConfirmDialog = ({
  isOpen,
  onOpenChange,
  proposals,
  count,
  phaseName,
  onConfirm,
  isSubmitting,
  triggerDisabled,
}: SelectionConfirmDialogProps) => {
  const t = useTranslations();

  return (
    <DialogTrigger isOpen={isOpen} onOpenChange={onOpenChange}>
      <Button isDisabled={triggerDisabled} variant="primary">
        {t('Confirm decisions')}
      </Button>

      <Modal isDismissable>
        <Dialog className="h-full">
          <ModalHeader>{t('Confirm advancing proposals')}</ModalHeader>
          <ModalBody>
            <SelectedProposalsReview
              proposals={proposals}
              count={count}
              phaseName={phaseName}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              className="w-full"
              color="primary"
              onPress={onConfirm}
              isDisabled={isSubmitting}
            >
              {isSubmitting ? t('Submitting...') : t('Publish')}
            </Button>
          </ModalFooter>
        </Dialog>
      </Modal>
    </DialogTrigger>
  );
};

const SelectedProposalsReview = ({
  proposals,
  count,
  phaseName,
}: {
  proposals: Proposal[];
  count: number;
  phaseName: string;
}) => {
  const t = useTranslations();

  return (
    <div className="space-y-4">
      <p className="text-base text-neutral-charcoal">
        {t(
          'These {numProposals} proposals will move on to the {phaseName} phase',
          { numProposals: count, phaseName },
        )}
      </p>

      <div className="space-y-2">
        <div className="text-sm tracking-wider text-neutral-gray4 uppercase">
          {t('PROPOSALS TO ADVANCE')}
        </div>

        {proposals.map((proposal) => (
          <ProposalCard className="bg-neutral-offWhite p-3" key={proposal.id}>
            <ProposalCardContent>
              <ProposalCardHeader
                className="flex-row flex-wrap justify-between"
                proposal={proposal}
              />
              <div className="flex items-center gap-2">
                <span className="text-sm text-neutral-charcoal">
                  {proposal.submittedBy?.name}
                </span>
                <ProposalCardCategory proposal={proposal} />
              </div>
            </ProposalCardContent>
          </ProposalCard>
        ))}
      </div>
    </div>
  );
};
