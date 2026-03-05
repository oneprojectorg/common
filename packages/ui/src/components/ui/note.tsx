import { LuCircleAlert, LuCircleCheck, LuInfo } from 'react-icons/lu';

import { cn } from '../../lib/utils';

export interface NoteProps extends React.HtmlHTMLAttributes<HTMLDivElement> {
  intent?: 'default' | 'info' | 'warning' | 'danger' | 'success';
  indicator?: boolean;
  contentClassName?: string;
}

export function Note({
  indicator = true,
  intent = 'default',
  className,
  contentClassName,
  ...props
}: NoteProps) {
  const iconMap: Record<
    string,
    React.ComponentType<{ className?: string }> | null
  > = {
    info: LuInfo,
    warning: LuCircleAlert,
    danger: LuCircleAlert,
    success: LuCircleCheck,
    default: null,
  };

  const IconComponent = iconMap[intent] || null;

  return (
    <div
      data-slot="note"
      className={cn([
        'grid w-full grid-cols-[auto_1fr] overflow-hidden rounded-lg border p-4 text-base/6 backdrop-blur-2xl sm:text-sm/6',
        '*:[a]:hover:underline **:[strong]:font-medium',
        intent === 'default' && 'bg-muted/50 text-secondary-fg',
        intent === 'info' &&
          'bg-info-subtle text-info-subtle-fg **:[.text-muted-fg]:text-info-subtle-fg/70',
        intent === 'warning' &&
          'bg-warning-subtle text-warning-subtle-fg **:[.text-muted-fg]:text-warning-subtle-fg/80',
        intent === 'danger' &&
          'bg-danger-subtle text-danger-subtle-fg **:[.text-muted-fg]:text-danger-subtle-fg/80',
        intent === 'success' &&
          'bg-success-subtle text-success-subtle-fg **:[.text-muted-fg]:text-success-subtle-fg/80',
        className,
      ])}
      {...props}
    >
      {IconComponent && indicator && (
        <div
          className={cn(
            'me-3 grid size-8 place-content-center rounded-full border-2',
            intent === 'warning' && 'border-warning-subtle-fg/40',
            intent === 'success' && 'border-success-subtle-fg/40',
            intent === 'danger' && 'border-danger-subtle-fg/40',
            intent === 'info' && 'border-info-subtle-fg/40',
          )}
        >
          <div
            className={cn(
              'grid size-6 place-content-center rounded-full border-2',
              intent === 'warning' && 'border-warning-subtle-fg/85',
              intent === 'success' && 'border-success-subtle-fg/85',
              intent === 'danger' && 'border-danger-subtle-fg/85',
              intent === 'info' && 'border-info-subtle-fg/85',
            )}
          >
            <IconComponent className="size-5 shrink-0" />
          </div>
        </div>
      )}
      <div
        className={cn(
          'text-pretty group-has-data-[slot=icon]:col-start-2',
          contentClassName,
        )}
      >
        {props.children}
      </div>
    </div>
  );
}
