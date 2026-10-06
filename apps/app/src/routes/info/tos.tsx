import { createFileRoute } from '@tanstack/react-router';

import { useTranslations } from '@/lib/i18n';

import { ToSContent } from '@/components/ToSContent';
import { FormContainer } from '@/components/form/FormContainer';
import { FormHeader } from '@/components/form/FormHeader';

export const Route = createFileRoute('/info/tos')({
  component: ToSPage,
});

function ToSPage() {
  const t = useTranslations();
  return (
    <FormContainer className="max-w-lg">
      <FormHeader text={t('Terms of Service')}></FormHeader>
      <ToSContent />
    </FormContainer>
  );
}
