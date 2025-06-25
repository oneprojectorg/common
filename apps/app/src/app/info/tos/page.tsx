import { useTranslations } from '@/lib/i18n';

import { ToSContent } from '@/components/ToSContent';
import { ToSContentShort } from '@/components/ToSContent/ToSContentShort';
import { FormContainer } from '@/components/form/FormContainer';
import { FormHeader } from '@/components/form/FormHeader';

const ToSPage = () => {
  const t = useTranslations();
  return (
    <FormContainer className="max-w-[32rem]">
      <FormHeader text={t('Terms of Use Overview')}></FormHeader>
      <ToSContentShort />
      <FormHeader text={t('Terms of Use')}></FormHeader>
      <ToSContent />
    </FormContainer>
  );
};

export default ToSPage;
