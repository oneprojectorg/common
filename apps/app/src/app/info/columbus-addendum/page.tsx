import { useTranslations } from '@/lib/i18n';

import { ColumbusAddendumContent } from '@/components/ColumbusAddendumContent';
import { FormContainer } from '@/components/form/FormContainer';
import { FormHeader } from '@/components/form/FormHeader';

const ColumbusAddendumPage = () => {
  const t = useTranslations();
  return (
    <FormContainer className="max-w-lg">
      <FormHeader text={t('Columbus Addendum')}></FormHeader>
      <ColumbusAddendumContent />
    </FormContainer>
  );
};

export default ColumbusAddendumPage;
