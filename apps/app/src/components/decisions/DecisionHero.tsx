import { GradientHeader, Header1 } from '@op/sense/Header';
import { cn } from '@op/sense/lib/utils';
import { ReactNode } from 'react';

export function DecisionHero({
  title,
  description,
  variant = 'standard',
  gradient,
  hasImage = false,
  children,
}: {
  title: string | ReactNode;
  description?: string | ReactNode;
  variant?: 'standard' | 'results';
  /** Override the default teal/green gradient on the gradient-style header. */
  gradient?: string;
  /**
   * Whether the hero sits over a banner image (DecisionHeroBanner). The
   * clipped gradient title and charcoal body lose contrast over the dark
   * scrim, so switch the text to white — same rule as the overview hero.
   */
  hasImage?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 text-center">
      {variant === 'results' ? (
        <Header1>
          <bdi>{title}</bdi>
        </Header1>
      ) : hasImage ? (
        <Header1 className="text-white">
          <bdi>{title}</bdi>
        </Header1>
      ) : (
        <GradientHeader gradient={gradient}>
          <Header1>
            <bdi>{title}</bdi>
          </Header1>
        </GradientHeader>
      )}

      {description && (
        <div
          className={cn(
            'flex flex-col gap-2 text-base',
            variant !== 'results' &&
              (hasImage ? 'text-white' : 'text-neutral-charcoal'),
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
