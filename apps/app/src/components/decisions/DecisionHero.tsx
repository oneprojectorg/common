import { GradientHeader, Header2 } from '@op/ui/Header';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

export function DecisionHero({
  title,
  description,
  variant = 'standard',
  children,
}: {
  title: string | ReactNode;
  description?: string | ReactNode;
  variant?: 'standard' | 'results';
  children?: ReactNode;
}) {
  return (
    <div className="gap-2 flex flex-col text-center">
      {variant === 'results' ? (
        <Header2 className="font-light font-serif text-title-xxl uppercase">
          {title}
        </Header2>
      ) : (
        <GradientHeader className="items-center align-middle uppercase">
          {title}
        </GradientHeader>
      )}

      {description && (
        <div
          className={cn(
            'gap-2 flex flex-col text-base',
            variant !== 'results' && 'text-neutral-charcoal',
          )}
        >
          {typeof description === 'string' ? <p>{description}</p> : description}
        </div>
      )}

      {children}
    </div>
  );
}
