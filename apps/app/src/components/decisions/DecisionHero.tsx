import { GradientHeader, Header2 } from '@op/ui/Header';
import { cn } from '@op/ui/utils';
import { ReactNode } from 'react';

export function DecisionHero({
  title,
  description,
  variant = 'standard',
  gradient,
  children,
}: {
  title: string | ReactNode;
  description?: string | ReactNode;
  variant?: 'standard' | 'results';
  /** Override the default teal/green gradient on the gradient-style header. */
  gradient?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 text-center">
      {variant === 'results' ? (
        <Header2 className="font-serif text-title-xxl font-light uppercase">
          {title}
        </Header2>
      ) : (
        <GradientHeader
          className="items-center align-middle uppercase"
          gradient={gradient}
        >
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
