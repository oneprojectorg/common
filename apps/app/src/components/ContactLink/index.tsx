import { cn } from '@op/ui/utils';

export const ContactLink = ({
  className,
  button,
  children,
}: {
  className?: string;
  button?: React.ReactNode;
  children: React.ReactNode;
}) => {
  return (
    <div className={cn('flex h-8 items-center gap-2', className)}>
      <div className="flex items-center gap-1 overflow-hidden">{children}</div>
      {button}
    </div>
  );
};
