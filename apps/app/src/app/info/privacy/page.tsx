import { useTranslations } from '@/lib/i18n';

import { PrivacyPolicyContent } from '@/components/PrivacyPolicyContent';
import { PrivacyPolicyContentShort } from '@/components/PrivacyPolicyContent/PrivacyPolicyContentShort';
import { FormContainer } from '@/components/form/FormContainer';
import { FormHeader } from '@/components/form/FormHeader';

const PrivacyPage = () => {
  const t = useTranslations();
  return (
    <FormContainer className="px-4 sm:max-w-[32rem] max-w-[100vw]">
      <FormHeader text={t('Privacy Policy Overview')}></FormHeader>
      <PrivacyPolicyContentShort />

      <FormHeader text={t('Privacy Policy')}></FormHeader>
      <PrivacyPolicyContent />
    </FormContainer>
  );
};

export default PrivacyPage;
