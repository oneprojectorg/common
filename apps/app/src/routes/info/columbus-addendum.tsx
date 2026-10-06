import { createFileRoute } from '@tanstack/react-router';

import { useTranslations } from '@/lib/i18n';

import { ColumbusAddendumContent } from '@/components/ColumbusAddendumContent';
import { FormContainer } from '@/components/form/FormContainer';
import { FormHeader } from '@/components/form/FormHeader';

export const Route = createFileRoute('/info/columbus-addendum')({
  component: ColumbusAddendumPage,
});

function ColumbusAddendumPage() {
  const t = useTranslations('shell');
  return (
    <FormContainer className="max-w-lg">
      <FormHeader text={t('columbusAddendumTitle')}></FormHeader>
      <ColumbusAddendumContent />
    </FormContainer>
  );
}
