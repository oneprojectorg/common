import { useTranslations } from '@/lib/i18n';

import { CommunityCommitmentsContent } from '@/components/CommunityCommitmentsContent';
import { FormContainer } from '@/components/form/FormContainer';
import { FormHeader } from '@/components/form/FormHeader';

const CommunityCommitmentsPage = () => {
  const t = useTranslations();
  return (
    <FormContainer className="max-w-lg">
      <FormHeader text={t('Community Commitments')}></FormHeader>
      <CommunityCommitmentsContent />
    </FormContainer>
  );
};

export default CommunityCommitmentsPage;
