'use client';

import type { Proposal } from '@op/common/client';
import { Button } from '@op/sense/Button';
import { useState } from 'react';
import { LuPencil, LuTrash2 } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { DeleteProposalDialog } from './DeleteProposalDialog';

export function ProposalCardReviseAction({
  editHref,
  className,
}: {
  editHref: string;
  className?: string;
}) {
  const t = useTranslations();
  const [navigating, setNavigating] = useState(false);

  return (
    <ButtonLink
      href={editHref}
      variant="default"
      size="sm"
      className={`w-full${className ? ` ${className}` : ''}`}
      onClick={() => setNavigating(true)}
      loading={navigating}
    >
      {t('Revise proposal')}
    </ButtonLink>
  );
}

/**
 * Edit/Delete actions for the proposal owner
 */
export function ProposalCardOwnerActions({
  proposal,
  editHref,
}: {
  proposal: Proposal;
  editHref: string;
}) {
  const t = useTranslations();
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  return (
    <div className="flex w-full items-center gap-4">
      <ButtonLink
        href={editHref}
        variant="outline"
        size="sm"
        className="flex-1"
      >
        <LuPencil className="size-4" />
        {t('Edit')}
      </ButtonLink>
      <DeleteProposalDialog
        proposalId={proposal.id}
        open={isDeleteModalOpen}
        onOpenChange={setIsDeleteModalOpen}
        trigger={
          <Button variant="destructive" size="sm" className="flex-1">
            <LuTrash2 className="size-4" />
            {t('Delete')}
          </Button>
        }
      />
    </div>
  );
}
