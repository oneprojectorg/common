import { useTranslations } from '@/lib/i18n';

import { PrivacyPolicyContent } from '@/components/PrivacyPolicyContent';
import { FormContainer } from '@/components/form/FormContainer';
import { FormHeader } from '@/components/form/FormHeader';

const ToSPage = () => {
  const t = useTranslations();
  return (
    <FormContainer className="max-w-[32rem]">
      <FormHeader text={t('Privacy Policy')}></FormHeader>
      <PrivacyPolicyContent />
    </FormContainer>
  );
};

export default ToSPage;
