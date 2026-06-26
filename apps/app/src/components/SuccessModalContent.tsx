import { CheckIcon } from '@op/ui/CheckIcon';
import { Header1 } from '@op/ui/Header';
import { cn } from '@op/ui/utils';
import type { ReactNode } from 'react';

/**
 * Body layout for a centered success/confirmation modal: icon + title +
 * optional subtitle, followed by whatever the modal wants to render. Goes
 * inside a `<Modal>` from `@op/ui/Modal`.
 */
export const SuccessModalContent = ({
  title,
  subtitle,
  children,
  icon = <CheckIcon />,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) => (
  <div className={cn('flex flex-col gap-6 p-12', className)}>
    <div className="flex flex-col items-center gap-4 text-center">
      {icon}
      <div className="flex flex-col gap-2">
        <Header1 className="text-neutral-black">{title}</Header1>
        {subtitle && (
          <p className="text-base text-neutral-charcoal">{subtitle}</p>
        )}
      </div>
    </div>
    {children}
  </div>
);
