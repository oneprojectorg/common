'use client';

import { Button } from '@op/ui/Button';
import { LoadingSpinner } from '@op/ui/LoadingSpinner';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ReactNode } from 'react';
import { LuCheck } from 'react-icons/lu';

import { UserAvatarMenu } from '../SiteHeader';

interface ProposalEditorLayoutProps {
  children: ReactNode;
  backHref: string;
  title: string;
  onSubmitProposal: () => void;
  isSubmitting: boolean;
}

export function ProposalEditorLayout({
  children,
  backHref,
  title,
  onSubmitProposal,
  isSubmitting,
}: ProposalEditorLayoutProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-gray1 px-6 py-4">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-2 text-sm text-primary-teal hover:text-primary-tealBlack"
        >
          <ChevronLeft className="h-4 w-4" />
          Back
        </button>

        <div className="flex-1 text-center text-lg font-medium text-neutral-black">
          {title}
        </div>

        <div className="flex items-center gap-8">
          <Button
            color="primary"
            variant="icon"
            onPress={onSubmitProposal}
            isDisabled={isSubmitting}
            className="px-4 py-2"
          >
            {isSubmitting ? <LoadingSpinner /> : <LuCheck />}
            Submit Proposal
          </Button>
          <UserAvatarMenu />
        </div>
      </div>

      {children}
    </div>
  );
}
