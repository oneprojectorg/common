'use client';

import { logger } from '@op/logging/client';
import { Button } from '@op/sense/Button';
import { useEffect, useState } from 'react';
import { LuCheck, LuCopy } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

const COPIED_CONFIRMATION_MS = 2000;

export const CopyEmailButton = ({ email }: { email: string }) => {
  const t = useTranslations();
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!isCopied) {
      return;
    }
    const timeout = setTimeout(
      () => setIsCopied(false),
      COPIED_CONFIRMATION_MS,
    );
    return () => clearTimeout(timeout);
  }, [isCopied]);

  const handleCopyClick = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setIsCopied(true);
    } catch (error) {
      logger.warn('Could not copy the profile email', { error });
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleCopyClick}>
      {isCopied ? <LuCheck /> : <LuCopy />}
      <span aria-live="polite">
        {isCopied ? t('profile.copiedLabel') : t('Copy')}
      </span>
    </Button>
  );
};
