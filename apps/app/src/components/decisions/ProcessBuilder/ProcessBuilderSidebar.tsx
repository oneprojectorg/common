'use client';

import { MenuItem } from '@op/ui/Menu';
import { Sidebar } from '@op/ui/Sidebar';
import { cn } from '@op/ui/utils';
import { useQueryState } from 'nuqs';
import { Menu } from 'react-aria-components';

import { useTranslations } from '@/lib/i18n';

export const ProcessBuilderSidebar = () => {
  const [section, setSection] = useQueryState('section');
  const t = useTranslations();

  const navSections = [
    { slug: 'overview', label: t('Overview') },
    { slug: 'phases', label: t('Phases') },
    { slug: 'categories', label: t('Proposal Categories') },
    { slug: 'voting', label: t('Voting') },
  ];

  return (
    <Sidebar className="border-r p-8">
      <Menu className="flex flex-col gap-1">
        {navSections.map(({ slug, label }) => (
          <SidebarLink
            key={slug}
            isCurrent={section === slug}
            onPress={() => setSection(slug)}
            label={label}
          />
        ))}
      </Menu>
    </Sidebar>
  );
};

const SidebarLink = ({
  label,
  isCurrent,
  onPress,
}: {
  label: string;
  isCurrent: boolean;
  onPress: () => void;
}) => {
  return (
    <MenuItem
      className={cn(isCurrent && 'bg-neutral-offWhite')}
      onAction={onPress}
    >
      {label}
    </MenuItem>
  );
};
