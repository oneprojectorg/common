'use client';

import { Header2 } from '@op/sense/Header';
import { SplitPane } from '@op/sense/SplitPane';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '../../SiteHeader';
import { DecisionSubpageHeader } from '../DecisionSubpageHeader';

interface DevelopProposalFrameProps {
  backHref: string;
  /** Header controls placed before the language chooser and avatar menu. */
  actions?: ReactNode;
  /** The source proposal, shown in the first pane. */
  source: ReactNode;
  sourceLabel: string;
  heading: string;
  description?: string;
  /** A line under the heading and description, such as a read-only notice. */
  notice?: ReactNode;
  /** The proposal's fields. */
  children: ReactNode;
}

/**
 * The develop screen around a proposal developed from sources: a header, the
 * source pane and the form pane side by side. The form pane is the first tab
 * on a narrow screen.
 */
export function DevelopProposalFrame({
  backHref,
  actions,
  source,
  sourceLabel,
  heading,
  description,
  notice,
  children,
}: DevelopProposalFrameProps) {
  const t = useTranslations();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <DecisionSubpageHeader
        backHref={backHref}
        backLabel={t('Back')}
        accountSlot={<UserAvatarMenu className="hidden sm:block" />}
      >
        {actions}
      </DecisionSubpageHeader>
      <SplitPane className="mx-auto w-full max-w-6xl" defaultMobileTabId="form">
        <SplitPane.Pane id="source" label={sourceLabel} className="sm:pt-8">
          {source}
        </SplitPane.Pane>
        <SplitPane.Pane id="form" label={heading} className="sm:pt-8">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <Header2>{heading}</Header2>
              {description ? (
                <p className="text-base text-foreground">{description}</p>
              ) : null}
              {notice}
            </div>
            {children}
          </div>
        </SplitPane.Pane>
      </SplitPane>
    </div>
  );
}
