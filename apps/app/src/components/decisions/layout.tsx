'use client';

import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { LuArrowLeft, LuCheck } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { LocaleChooser } from '../LocaleChooser';
import { UserAvatarMenu } from '../SiteHeader';

interface ProposalEditorLayoutProps {
  children: ReactNode;
  backHref: string;
  title: string;
  onSubmitProposal: () => void;
  isSubmitting: boolean;
  isEditMode?: boolean;
  isDraft?: boolean;
  /** Optional slot for presence indicators (avatar stack) */
  presenceSlot?: ReactNode;
}

export function ProposalEditorLayout({
  children,
  backHref,
  title,
  onSubmitProposal,
  isSubmitting,
  isEditMode = false,
  isDraft = false,
  presenceSlot,
}: ProposalEditorLayoutProps) {
  const router = useRouter();
  const t = useTranslations();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="grid grid-cols-3 items-center gap-2 border-b px-4 py-4 sm:px-6">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-2 text-primary-teal hover:text-primary-tealBlack"
        >
          <LuArrowLeft className="size-6 text-neutral-charcoal sm:size-4 sm:text-primary-teal" />
          <span className="hidden sm:block">Back</span>
        </button>

        <div className="flex justify-center text-lg font-medium text-neutral-black">
          <span className="hidden sm:block">
            {title ? title : 'Untitled Proposal'}
          </span>
        </div>

        <div className="flex items-center justify-end gap-4">
          {presenceSlot}
          <Button
            color="primary"
            variant="icon"
            size="small"
            onPress={onSubmitProposal}
            isDisabled={isSubmitting}
            className="px-4 py-2"
          >
            {isSubmitting ? <LoadingSpinner /> : <LuCheck />}
            {isEditMode && !isDraft ? (
              <>
                <span className="inline lg:hidden">{t('Update')}</span>
                <span className="hidden lg:inline">{t('Update Proposal')}</span>
              </>
            ) : (
              <>
                <span className="hidden sm:block">{t('Submit Proposal')}</span>
                <span className="sm:hidden">{t('Submit')}</span>{' '}
              </>
            )}
          </Button>
          <LocaleChooser />
          <UserAvatarMenu className="hidden sm:block" />
        </div>
      </div>

      {children}
    </div>
  );
}
