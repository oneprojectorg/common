'use client';

import { useUser } from '@/utils/UserProvider';
import { useEffect, useRef } from 'react';

import { useTranslations } from '@/lib/i18n';

import { type SectionProps, getContentComponentFlat } from './contentRegistry';
import { type SectionId } from './navigationConfig';
import { useNavigationConfig } from './useNavigationConfig';
import { useProcessNavigation } from './useProcessNavigation';
import { useProcessPhases } from './useProcessPhases';

export function ProcessBuilderContent({
  decisionProfileId,
  instanceId,
  decisionName,
}: SectionProps) {
  const t = useTranslations();
  const navigationConfig = useNavigationConfig(instanceId, decisionProfileId);

  const phases = useProcessPhases(instanceId, decisionProfileId);

  const { currentSection } = useProcessNavigation(navigationConfig, phases);

  const access = useUser();
  const isAdmin = access.getPermissionsForProfile(decisionProfileId).admin;

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let el: HTMLElement | null = wrapperRef.current;
    while (el) {
      const { overflowY } = getComputedStyle(el);
      if (overflowY === 'auto' || overflowY === 'scroll') {
        if (el.scrollTop !== 0) {
          el.scrollTo({ top: 0 });
        }
        break;
      }
      el = el.parentElement;
    }
  }, [currentSection?.id]);

  if (!isAdmin) {
    throw new Error('UNAUTHORIZED');
  }

  const ContentComponent = getContentComponentFlat(
    currentSection?.id as SectionId | undefined,
  );

  if (!ContentComponent) {
    return <div>{t('Section not found')}</div>;
  }

  return (
    // `contents` keeps the wrapper layout-neutral so children's `h-full`
    // still cascades from the outer `<main>`. The ref exists solely to
    // anchor the scroll-reset effect above.
    <div ref={wrapperRef} className="contents">
      <ContentComponent
        decisionProfileId={decisionProfileId}
        instanceId={instanceId}
        decisionName={decisionName}
      />
    </div>
  );
}
