import { EmptyState } from '@op/ui/EmptyState';
import { LuFolderOpen, LuLock } from 'react-icons/lu';

import { TranslatedText } from '@/components/TranslatedText';

type Variant = 'admin-empty' | 'member-empty' | 'no-access';

export const ResourceEmptyState = ({ variant }: { variant: Variant }) => {
  if (variant === 'no-access') {
    return (
      <EmptyState icon={<LuLock />}>
        <TranslatedText text="You don't have access to this resource collection" />
      </EmptyState>
    );
  }

  if (variant === 'admin-empty') {
    return (
      <EmptyState icon={<LuFolderOpen />}>
        <p className="text-sm">
          <TranslatedText text="No resources yet" />
        </p>
        <p className="text-sm text-neutral-gray4">
          <TranslatedText text="Add your first resource" />
        </p>
      </EmptyState>
    );
  }

  return (
    <EmptyState icon={<LuFolderOpen />}>
      <TranslatedText text="No resources yet" />
    </EmptyState>
  );
};
