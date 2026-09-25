import type { ReactNode } from 'react';
import type { IconType } from 'react-icons';

/** Not sense `Alert`: that has no accent variant and forces `role="alert"`. */
export function Callout({
  icon: Icon,
  title,
  children,
}: {
  icon: IconType;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-accent p-4">
      <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">
        {title ? <p className="text-base font-strong">{title}</p> : null}
        <p
          className={
            title
              ? 'mt-1 text-sm text-muted-foreground'
              : 'text-sm text-foreground'
          }
        >
          {children}
        </p>
      </div>
    </div>
  );
}
