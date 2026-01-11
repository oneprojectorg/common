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
}

export function ProposalEditorLayout({
  children,
  backHref,
  title,
  onSubmitProposal,
  isSubmitting,
  isEditMode = false,
}: ProposalEditorLayoutProps) {
  const router = useRouter();
  const t = useTranslations();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="gap-2 px-4 py-4 sm:px-6 grid grid-cols-3 items-center border-b">
        <button
          onClick={() => router.push(backHref)}
          className="gap-2 flex items-center text-primary-teal hover:text-primary-tealBlack"
        >
          <LuArrowLeft className="sm:text-primary-teal size-6 sm:size-4 text-neutral-charcoal" />
          <span className="sm:block hidden">Back</span>
        </button>

        <div className="font-medium flex justify-center text-lg text-neutral-black">
          <span className="sm:block hidden">
            {title ? title : 'Untitled Proposal'}
          </span>
        </div>

        <div className="gap-8 flex items-center justify-end">
          <Button
            color="primary"
            variant="icon"
            size="small"
            onPress={onSubmitProposal}
            isDisabled={isSubmitting}
            className="px-4 py-2"
          >
            {isSubmitting ? <LoadingSpinner /> : <LuCheck />}
            {isEditMode ? (
              <>
                <span className="lg:hidden inline">{t('Update')}</span>
                <span className="lg:inline hidden">{t('Update Proposal')}</span>
              </>
            ) : (
              <>
                <span className="sm:block hidden">{t('Submit Proposal')}</span>
                <span className="sm:hidden">{t('Submit')}</span>{' '}
              </>
            )}
          </Button>
          <LocaleChooser />
          <UserAvatarMenu className="sm:block hidden" />
        </div>
      </div>

      {children}
    </div>
  );
}
