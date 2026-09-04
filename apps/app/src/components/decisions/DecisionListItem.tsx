'use client';

import { trpc } from '@op/api/client';
import { DecisionProfile, ProcessStatus } from '@op/api/encoders';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLinkItem,
  DropdownMenuTrigger,
} from '@op/sense/DropdownMenu';
import { StatusBadge } from '@op/sense/StatusBadge';
import { toast } from '@op/sense/Toast';
import { cn } from '@op/sense/lib/utils';
import { useLocale } from 'next-intl';
import { useState } from 'react';
import { LuCalendar, LuEllipsis } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';
import { Link } from '@/lib/i18n';
import type { TranslationKey } from '@/lib/i18n';

import { DecisionCardHeader } from './DecisionCardHeader';
import { DuplicateProcessModal } from './DuplicateProcessModal';

const formatDateShort = (dateString: string, locale: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString(locale, {
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

export const DecisionListItem = ({
  item,
  className,
}: {
  item: DecisionProfile;
  className?: string;
}) => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const { processInstance } = item;
  const isDraft = processInstance.status === ProcessStatus.DRAFT;
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const canManage = processInstance.access?.admin === true;
  const canDelete = isDraft && (processInstance.access?.delete || canManage);

  const deleteMutation = trpc.decision.deleteDecision.useMutation({
    onSuccess: () => {
      toast.success(t('Decision deleted successfully'));
      utils.decision.listDecisionProfiles.invalidate();
    },
    onError: () => {
      toast.error(t('Failed to delete decision'));
    },
  });

  // Get current phase from instanceData phases
  const currentPhase = processInstance.instanceData?.phases?.find(
    (phase) => phase.phaseId === processInstance.currentStateId,
  );
  // A draft carries none of the running-process metadata (Figma 17827:9692): no
  // phase chip, no closing date, no counts — just the name, its owner, and a
  // Draft badge where the metrics sit.
  const currentPhaseName = isDraft ? undefined : currentPhase?.name;
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
      <div className="flex items-start rounded-lg border hover:bg-muted sm:items-center sm:rounded-none sm:border-0">
        <Link
          href={`/decisions/${item.slug}${isDraft ? '/edit' : ''}`}
          className={cn(
            'flex flex-1 flex-col gap-4 p-4 hover:no-underline sm:flex-row sm:items-center sm:justify-between',
            className,
          )}
        >
          <DecisionCardHeader
            name={processInstance.name || item.name || t('Untitled')}
            currentState={currentPhaseName}
            stewardName={displayProfile?.name}
            stewardAvatarPath={displayProfile?.avatarImage?.name}
          >
            {closingDate && <DecisionClosingDate closingDate={closingDate} />}
          </DecisionCardHeader>

          {isDraft ? (
            <StatusBadge variant="inactive" icon={false}>
              {t('Draft')}
            </StatusBadge>
          ) : (
            <div className="flex items-end gap-4 sm:items-center sm:gap-10">
              <DecisionStat
                number={processInstance.participantCount ?? 0}
                label="Participants"
              />
              <DecisionStat
                number={processInstance.proposalCount ?? 0}
                label="Proposals"
              />
            </div>
          )}
        </Link>

        {(canManage || canDelete) && (
          <div className="flex items-center pe-4 pt-4 sm:ps-8 sm:pt-0">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    aria-label={t('Decision options')}
                    variant="ghost"
                    size="icon"
                  />
                }
              >
                <LuEllipsis className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="bottom" align="end">
                {canManage && (
                  <DropdownMenuLinkItem
                    closeOnClick
                    render={<Link href={`/decisions/${item.slug}/edit`} />}
                  >
                    {t('Settings')}
                  </DropdownMenuLinkItem>
                )}
                {canManage && (
                  <DropdownMenuItem onClick={() => setShowDuplicateModal(true)}>
                    {t('Duplicate')}
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => setShowDeleteModal(true)}
                    variant="destructive"
                  >
                    {t('Delete')}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Manual state instead of DialogTrigger because the trigger is a dropdown
         menu item inside a menu popover — DialogTrigger conflicts with menu
         focus/close behavior */}
      {showDuplicateModal && (
        <DuplicateProcessModal
          item={item}
          onClose={() => setShowDuplicateModal(false)}
        />
      )}

      <Dialog
        open={showDeleteModal}
        onOpenChange={(open) => !open && setShowDeleteModal(false)}
      >
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>
              {isDraft
                ? t('Delete draft?')
                : t('Delete {name}?', {
                    name: processInstance.name || item.name,
                  })}
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 py-4">
            <p>
              {isDraft
                ? t(
                    "This draft will be permanently deleted and can't be recovered.",
                  )
                : t(
                    "This decision will be permanently deleted and can't be recovered.",
                  )}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              {isDraft ? t('Keep draft') : t('Cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending
                ? t('Deleting...')
                : isDraft
                  ? t('Delete draft')
                  : t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
        {/* `w-full` so this takes its own line under the phase chip, which now
            shares the header's last row. */}
        <div className="flex w-full flex-col flex-wrap gap-2 sm:flex-row sm:items-center sm:justify-between">
          {closingDate && <DecisionClosingDate closingDate={closingDate} />}
          <div className="flex items-end gap-4">
            <DecisionStat
              number={processInstance.participantCount ?? 0}
              label="Participants"
              className="sm:flex-row"
            />
            <DecisionStat
              number={processInstance.proposalCount ?? 0}
              label="Proposals"
              className="sm:flex-row"
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
      className="flex flex-col gap-4 rounded-lg border p-4 hover:bg-muted hover:no-underline sm:flex-row sm:items-center sm:justify-between sm:rounded-none sm:border-0 sm:border-b"
    >
      <DecisionCardHeader
        name={name}
        currentState={currentStateName}
        stewardName={ownerName}
        stewardAvatarPath={ownerAvatarPath}
      >
        {closingDate && <DecisionClosingDate closingDate={closingDate} />}
      </DecisionCardHeader>

      <div className="flex items-end gap-4 sm:items-center sm:gap-10">
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
  label: TranslationKey;
  className?: string;
}) => {
  const t = useTranslations();

  return (
    <div className={cn('flex items-center gap-1 sm:flex-col', className)}>
      <span className="font-serif text-title">{number}</span>
      <span className="text-sm text-muted-foreground">{t(label)}</span>
    </div>
  );
};

const DecisionClosingDate = ({ closingDate }: { closingDate: string }) => {
  const t = useTranslations();
  const locale = useLocale();
  const closingSoon = isClosingSoon(closingDate);

  return (
    <div
      className={cn(
        'flex items-center gap-2 text-sm',
        closingSoon ? 'text-destructive' : 'text-muted-foreground',
      )}
    >
      <LuCalendar className="size-4" aria-hidden />
      {t('Closes on {date}', { date: formatDateShort(closingDate, locale) })}
    </div>
  );
};
