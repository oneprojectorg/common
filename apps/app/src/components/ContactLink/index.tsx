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
    <div className={cn('h-8 gap-2 flex items-center', className)}>
      <div className="gap-1 flex items-center overflow-hidden">{children}</div>
      {button}
    </div>
  );
};
