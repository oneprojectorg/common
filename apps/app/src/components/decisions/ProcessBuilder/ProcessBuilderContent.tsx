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
        el.scrollTo({ top: 0 });
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
    <div ref={wrapperRef} className="contents">
      <ContentComponent
        decisionProfileId={decisionProfileId}
        instanceId={instanceId}
        decisionName={decisionName}
      />
    </div>
  );
}
