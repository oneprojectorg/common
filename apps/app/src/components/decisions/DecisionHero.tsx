import { GradientHeader, Header1 } from '@op/ui/Header';
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
        <Header1 className="font-serif font-light uppercase md:text-title-xxl">
          <bdi>{title}</bdi>
        </Header1>
      ) : (
        <GradientHeader className="uppercase" gradient={gradient}>
          <Header1 className="md:text-title-xxl">
            <bdi>{title}</bdi>
          </Header1>
        </GradientHeader>
      )}

      {description && (
        <div
          className={cn(
            'flex flex-col gap-2 text-base',
            variant !== 'results' && 'text-neutral-charcoal',
          )}
        >
          {typeof description === 'string' ? (
            <p dir="auto">{description}</p>
          ) : (
            description
          )}
        </div>
      )}

      {children}
    </div>
  );
}
