import { ButtonLink } from '@op/ui/Button';
import { EmptyState } from '@op/ui/EmptyState';
import { LuCircleAlert } from 'react-icons/lu';

import { TranslatedText } from '@/components/TranslatedText';

export const InviteError = () => {
  return (
    <EmptyState icon={<LuCircleAlert />}>
      <p>
        <TranslatedText text="This invite is no longer valid" />
      </p>
      <ButtonLink href="/">
        <TranslatedText text="Go back" />
      </ButtonLink>
    </EmptyState>
  );
};
