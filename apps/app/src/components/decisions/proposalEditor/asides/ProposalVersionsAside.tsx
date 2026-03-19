'use client';

import { useTranslations } from '@/lib/i18n';

import { ProposalEditorAside } from '../../ProposalEditorAside';

interface ProposalVersionsAsideProps {
  onClose: () => void;
}

/**
 * Sidebar panel for proposal version history.
 */
export function ProposalVersionsAside({ onClose }: ProposalVersionsAsideProps) {
  const t = useTranslations();

  return (
    <ProposalEditorAside
      title={t('Version history')}
      onClose={onClose}
      bodyClassName="pt-4"
    >
      <div className="mx-4 rounded bg-primary-tealWhite p-2">
        <p className="text-base text-neutral-black">{t('Current version')}</p>
        <p className="text-base text-neutral-charcoal">{t('Latest')}</p>
      </div>
    </ProposalEditorAside>
  );
}
