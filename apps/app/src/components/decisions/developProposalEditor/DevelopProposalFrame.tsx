'use client';

import { Header2 } from '@op/sense/Header';
import { SplitPane } from '@op/sense/SplitPane';
import type { ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '../../SiteHeader';
import { DecisionSubpageHeader } from '../DecisionSubpageHeader';

interface DevelopProposalFrameProps {
  backHref: string;
  actions?: ReactNode;
  origin: ReactNode;
  originLabel: string;
  heading: string;
  description?: string;
  notice?: ReactNode;
  children: ReactNode;
}

/**
 * The develop screen: a header over the origin pane and the form pane. The
 * form is the first tab on a narrow screen.
 */
export function DevelopProposalFrame({
  backHref,
  actions,
  origin,
  originLabel,
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
      <SplitPane className="mx-auto w-full max-w-7xl" defaultMobileTabId="form">
        <SplitPane.Pane
          id="origin"
          label={originLabel}
          className="sm:ps-6 sm:pt-8"
        >
          {origin}
        </SplitPane.Pane>
        <SplitPane.Pane id="form" label={heading} className="sm:pe-6 sm:pt-8">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <Header2>
                <bdi>{heading}</bdi>
              </Header2>
              {description ? (
                <p className="text-base text-foreground">
                  <bdi>{description}</bdi>
                </p>
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
