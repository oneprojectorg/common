import { GradientHeader, Header1 } from '@op/sense/Header';
import { cn } from '@op/sense/lib/utils';
import { ReactNode } from 'react';

import { DecisionTranslateLink } from './DecisionTranslateLink';

export function DecisionHero({
  title,
  titleSlot,
  description,
  gradient,
  hasImage = false,
  showTranslateLink = true,
  className,
  children,
}: {
  title: string | ReactNode;
  /** Replaces the default heading, for a title that renders its own `h1`. */
  titleSlot?: ReactNode;
  description?: string | ReactNode;
  /** Override the default teal/green gradient on the gradient-style header. */
  gradient?: string;
  /**
   * Whether the hero sits over a banner image (DecisionHeroBanner). The
   * clipped gradient title and charcoal body lose contrast over the dark
   * scrim, so switch the text to white — same rule as the overview hero.
   */
  hasImage?: boolean;
  /** Hide the translate link on pages that render no translated content. */
  showTranslateLink?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-2 text-center', className)}>
      {showTranslateLink ? <DecisionTranslateLink hasImage={hasImage} /> : null}
      {titleSlot ??
        (hasImage ? (
          <Header1 className="text-white">
            <bdi>{title}</bdi>
          </Header1>
        ) : (
          <GradientHeader gradient={gradient}>
            <Header1>
              <bdi>{title}</bdi>
            </Header1>
          </GradientHeader>
        ))}

      {description && (
        <div
          className={cn(
            'flex flex-col gap-2 text-base',
            hasImage ? 'text-white' : 'text-foreground',
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
