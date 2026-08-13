import { useTranslations } from '@/lib/i18n';

import { PrivacyPolicyContent } from '@/components/PrivacyPolicyContent';
import { FormContainer } from '@/components/form/FormContainer';
import { FormHeader } from '@/components/form/FormHeader';

const PrivacyPage = () => {
  const t = useTranslations();
  return (
    <FormContainer className="max-w-[100vw] px-4 sm:max-w-lg">
      <FormHeader text={t('Privacy Policy')}></FormHeader>
      <PrivacyPolicyContent />
    </FormContainer>
  );
};

export default PrivacyPage;
