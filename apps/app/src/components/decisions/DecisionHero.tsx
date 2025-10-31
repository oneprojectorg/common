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
    <div className="flex flex-col gap-2 text-center">
      {variant === 'results' ? (
        <Header2 className="font-serif text-title-xxl font-light">
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
            'flex flex-col gap-2 text-base',
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
