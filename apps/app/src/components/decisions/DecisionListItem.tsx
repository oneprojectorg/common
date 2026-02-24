'use client';

import { trpc } from '@op/api/client';
import { DecisionProfile, ProcessStatus } from '@op/api/encoders';
import { Button } from '@op/ui/Button';
import { DialogTrigger } from '@op/ui/Dialog';
import { Menu, MenuItem } from '@op/ui/Menu';
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@op/ui/Modal';
import { OptionMenu } from '@op/ui/OptionMenu';
import { toast } from '@op/ui/Toast';
import { cn } from '@op/ui/utils';
import { useState } from 'react';
import { LuCalendar, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n';

import { TranslatedText } from '../TranslatedText';
import { DecisionCardHeader } from './DecisionCardHeader';

const formatDateShort = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const isClosingSoon = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const daysUntilClose = Math.ceil(
    (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );
  return daysUntilClose >= 0 && daysUntilClose <= 7;
};

export const DecisionListItem = ({ item }: { item: DecisionProfile }) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const { processInstance } = item;
  const isDraft = processInstance.status === ProcessStatus.DRAFT;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const canDelete = processInstance.access?.delete;

  const deleteMutation = trpc.decision.deleteDecision.useMutation({
    onSuccess: () => {
      toast.success({ message: t('Decision deleted successfully') });
      utils.decision.listDecisionProfiles.invalidate();
    },
    onError: () => {
      toast.error({ message: t('Failed to delete decision') });
    },
  });

  // Get current phase from instanceData phases
  const currentPhase = processInstance.instanceData?.phases?.find(
    (phase) => phase.phaseId === processInstance.currentStateId,
  );
  const currentPhaseName = isDraft ? 'Draft' : currentPhase?.name;
  const closingDate = isDraft ? undefined : currentPhase?.endDate;

  // For drafts show owner; for published prefer steward, fall back to owner
  const displayProfile = isDraft
    ? processInstance.owner
    : (processInstance.steward ?? processInstance.owner);

  const handleDeleteConfirm = () => {
    deleteMutation.mutate({ instanceId: processInstance.id });
    setShowDeleteModal(false);
  };

  return (
    <>
      <div className="flex items-center gap-0 rounded-lg border sm:rounded-none sm:border-0 sm:border-b sm:border-b-neutral-gray1">
        <Link
          href={`/decisions/${item.slug}${isDraft ? '/edit' : ''}`}
          className="flex flex-1 flex-col gap-4 p-4 hover:bg-primary-tealWhite hover:no-underline sm:flex-row sm:items-center sm:justify-between"
        >
          <DecisionCardHeader
            name={processInstance.name || item.name}
            currentState={currentPhaseName}
            stewardName={displayProfile?.name}
            stewardAvatarPath={displayProfile?.avatarImage?.name}
            chipClassName={
              isDraft ? 'bg-neutral-gray1 text-neutral-charcoal' : undefined
            }
          >
            {closingDate && (
              <div className="flex flex-wrap items-center gap-2 py-1 text-xs sm:gap-6">
                <DecisionClosingDate closingDate={closingDate} />
              </div>
            )}
          </DecisionCardHeader>

          <div className="flex items-end gap-4 text-neutral-black sm:items-center sm:gap-12">
            <DecisionStat
              number={processInstance.participantCount ?? 0}
              label="Participants"
            />
            <DecisionStat
              number={processInstance.proposalCount ?? 0}
              label="Proposals"
            />
          </div>
        </Link>

        {canDelete && (
          <div className="flex items-center pr-2">
            <OptionMenu variant="outline" className="rounded-md">
              <Menu className="min-w-28 p-2">
                <MenuItem
                  key="delete"
                  onAction={() => setShowDeleteModal(true)}
                  className="text-functional-red"
                >
                  <LuTrash2 className="size-4" />
                  {t('Delete')}
                </MenuItem>
              </Menu>
            </OptionMenu>
          </div>
        )}
      </div>

      <DialogTrigger
        isOpen={showDeleteModal}
        onOpenChange={(open) => !open && setShowDeleteModal(false)}
      >
        <Modal
          isDismissable
          isOpen={showDeleteModal}
          onOpenChange={(open) => !open && setShowDeleteModal(false)}
        >
          <ModalHeader>{t('Delete Decision')}</ModalHeader>
          <ModalBody>
            <p>
              {t(
                'Are you sure you want to delete this decision? This action cannot be undone.',
              )}
            </p>
          </ModalBody>
          <ModalFooter>
            <Button color="secondary" onPress={() => setShowDeleteModal(false)}>
              {t('Cancel')}
            </Button>
            <Button
              color="destructive"
              onPress={handleDeleteConfirm}
              isDisabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? t('Deleting...') : t('Delete')}
            </Button>
          </ModalFooter>
        </Modal>
      </DialogTrigger>
    </>
  );
};

export const ProfileDecisionListItem = ({
  item,
  className,
}: {
  item: DecisionProfile;
  className?: string;
}) => {
  const { processInstance } = item;

  // Get current phase from instanceData phases
  const currentPhase = processInstance.instanceData?.phases?.find(
    (phase) => phase.phaseId === processInstance.currentStateId,
  );
  const currentPhaseName = currentPhase?.name;
  const closingDate = currentPhase?.endDate;

  return (
    <Link
      href={`/decisions/${item.slug}`}
      className={cn('flex flex-col gap-4 pb-4 hover:no-underline', className)}
    >
      <DecisionCardHeader
        name={processInstance.name || item.name}
        currentState={currentPhaseName}
      >
        <div className="flex flex-col flex-wrap gap-2 py-1 text-xs sm:flex-row sm:items-center sm:justify-between">
          {closingDate && <DecisionClosingDate closingDate={closingDate} />}
          <div className="flex items-end gap-4 text-neutral-black">
            <DecisionStat
              number={processInstance.participantCount ?? 0}
              label="Participants"
              className="sm:flex-row sm:items-end sm:gap-1"
            />
            <DecisionStat
              number={processInstance.proposalCount ?? 0}
              label="Proposals"
              className="sm:flex-row sm:items-end sm:gap-1"
            />
          </div>
        </div>
      </DecisionCardHeader>
    </Link>
  );
};

export const LegacyDecisionListItem = ({
  name,
  href,
  currentStateName,
  closingDate,
  ownerName,
  ownerAvatarPath,
  participantCount = 0,
  proposalCount = 0,
}: {
  name: string;
  href: string;
  currentStateName?: string | null;
  closingDate?: string | null;
  ownerName?: string | null;
  ownerAvatarPath?: string | null;
  participantCount?: number;
  proposalCount?: number;
}) => {
  return (
    <Link
      href={href}
      className="flex flex-col gap-4 rounded-lg border p-4 hover:bg-primary-tealWhite hover:no-underline sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0 sm:border-b sm:border-b-neutral-gray1"
    >
      <DecisionCardHeader
        name={name}
        currentState={currentStateName}
        stewardName={ownerName}
        stewardAvatarPath={ownerAvatarPath}
      >
        {closingDate && (
          <div className="flex flex-wrap items-center gap-2 py-1 text-xs sm:gap-6">
            <DecisionClosingDate closingDate={closingDate} />
          </div>
        )}
      </DecisionCardHeader>

      <div className="flex items-end gap-4 text-neutral-black sm:items-center sm:gap-12">
        <DecisionStat number={participantCount} label="Participants" />
        <DecisionStat number={proposalCount} label="Proposals" />
      </div>
    </Link>
  );
};

const DecisionStat = ({
  number,
  label,
  className,
}: {
  number: number;
  label: string;
  className?: string;
}) => (
  <div
    className={cn(
      'flex items-end gap-1 sm:flex-col sm:items-center sm:gap-0',
      className,
    )}
  >
    <span className="font-serif text-title-base">{number}</span>
    <span className="text-sm">
      <TranslatedText text={label} />
    </span>
  </div>
);

const DecisionClosingDate = ({ closingDate }: { closingDate: string }) => {
  return (
    <div className="flex items-center gap-1">
      <LuCalendar
        className={`size-4 ${isClosingSoon(closingDate) ? 'text-functional-red' : 'text-neutral-charcoal'}`}
      />
      <span
        className={cn(
          isClosingSoon(closingDate)
            ? 'text-functional-red'
            : 'text-neutral-charcoal',
          'text-sm',
        )}
      >
        <TranslatedText text="Closes" /> {formatDateShort(closingDate)}
      </span>
    </div>
  );
};
