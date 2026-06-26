'use client';

import { Button } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { Header2 } from '@op/ui/Header';
import { LuTriangleAlert } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * Full-canvas error fallback for the proposal editor route. Shown by the
 * route's error boundary when the proposal/instance data fails to load or
 * the editor throws while initialising. Distinct from the toast-driven
 * mutation/validation errors handled inside the editor itself.
 */
export function ProposalEditorError() {
  const t = useTranslations();

  return (
    <div className="flex h-screen w-full items-center justify-center bg-white px-6">
      <EmptyState
        className="max-w-md"
        icon={<LuTriangleAlert className="size-5" />}
      >
        <Header2 className="text-center">
          {t("We couldn't load this proposal")}
        </Header2>
        <p className="text-center text-sm text-neutral-gray4">
          {t(
            'Something went wrong on our end. Please check your connection and try again.',
          )}
        </p>
        <Button onPress={() => window.location.reload()} color="primary">
          {t('Try again')}
        </Button>
      </EmptyState>
    </div>
  );
}
