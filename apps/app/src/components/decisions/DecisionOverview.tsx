'use client';

import { trpc } from '@op/api/client';
import { ButtonLink } from '@op/ui/Button';

import { useTranslations } from '@/lib/i18n';

import { ProposalHtmlContent } from './ProposalHtmlContent';
import { decisionOverviewMock } from './decisionOverviewMock';

interface DecisionOverviewProps {
  instanceId: string;
  slug: string;
  decisionSlug?: string;
  decisionProfileId?: string | null;
}

/**
 * Overview tab for a decision process (/decisions/[slug]/overview). The shared
 * header + view toggle come from the (decision-view) layout; this renders the
 * hero, the phases sidebar slot, and the About body.
 *
 * Overview content (headline, subhead, About HTML) is mocked
 * until `instanceData.overview` exists on the API — swap at the `overview`
 * read below.
 */
export function DecisionOverviewSuspense({
  instanceId,
  decisionSlug,
}: DecisionOverviewProps) {
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({ instanceId });

  const overview = decisionOverviewMock;
  const headline = overview.headline ?? instance.name ?? '';
  const content = overview.content ?? instance.description ?? undefined;

  return (
    <div className="flex w-full flex-col">
      <OverviewHero
        headline={headline}
        subhead={overview.subhead}
        decisionSlug={decisionSlug}
      />
      {/* 12-col grid mirroring the Figma layout grid: sidebar spans 4 cols,
          body spans 7 starting at col 6. Stacks to one column below md. */}
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 gap-12 px-6 py-12 md:grid-cols-12 md:gap-x-6">
        {/* Phases timeline lands here in a follow-up PR */}
        <div className="md:col-span-4" />
        <div className="min-w-0 md:col-span-7 md:col-start-6">
          <OverviewAbout content={content} />
        </div>
      </div>
    </div>
  );
}

const OverviewHero = ({
  headline,
  subhead,
  decisionSlug,
}: {
  headline: string;
  subhead?: string;
  decisionSlug?: string;
}) => {
  const t = useTranslations();
  const currentPhaseHref = decisionSlug
    ? `/decisions/${decisionSlug}/current`
    : undefined;

  return (
    // Gradient stands in until overview header images exist — same radial
    // gradient as the results-view decision header.
    <section className="w-full bg-redPurple">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-6 py-16 text-center text-neutral-offWhite sm:py-24">
        <div className="flex flex-col items-center gap-2">
          <h1 className="font-serif text-title-xl font-light sm:text-title-xxl">
            <bdi>{headline}</bdi>
          </h1>
          {subhead ? (
            <p dir="auto" className="text-base">
              {subhead}
            </p>
          ) : null}
        </div>
        {currentPhaseHref ? (
          <div className="flex w-full flex-wrap justify-center gap-4">
            <ButtonLink color="secondary" href={currentPhaseHref}>
              {t('Browse proposals')}
            </ButtonLink>
            <ButtonLink color="primary" href={currentPhaseHref}>
              {t('Submit a proposal')}
            </ButtonLink>
          </div>
        ) : null}
      </div>
    </section>
  );
};

const OverviewAbout = ({ content }: { content?: string }) => {
  const t = useTranslations();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-serif text-title-lg text-neutral-black">
        {t('About the process')}
      </h2>
      {content ? <ProposalHtmlContent html={content} /> : null}
    </section>
  );
};
