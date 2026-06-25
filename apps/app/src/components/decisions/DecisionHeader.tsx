'use client';

import { useTrackPageView } from '@/hooks/useTrackPageView';
import { getDecisionCommonProperties } from '@op/analytics/client-utils';
import { trpc } from '@op/api/client';
import {
  type InstanceData,
  type ProcessInstance,
  type ProcessPhase,
} from '@op/api/encoders';
import { type ReactNode } from 'react';

import { useTranslations } from '@/lib/i18n';

import { DecisionInstanceHeader } from '@/components/decisions/DecisionInstanceHeader';
import { DecisionStepperBar } from '@/components/decisions/DecisionStepperBar';

interface DecisionHeaderBaseProps {
  instanceId: string;
  /** Decision profile slug for building the edit link */
  decisionSlug?: string;
  /** Whether the current user has admin access to this decision */
  isAdmin?: boolean;
  /** Title from the decision profile */
  profileName?: string;
}

interface StandardDecisionHeaderProps extends DecisionHeaderBaseProps {
  useLegacy?: false;
  /** Whether the current user can read decision updates */
  canReadUpdates?: boolean;
  /** Center-column content, e.g. the Overview / Current Phase toggle */
  centerSlot?: ReactNode;
  /** Whether to render the phase stepper below the header bar (default true) */
  showStepper?: boolean;
  /**
   * When provided, the header renders from this prop instead of a client
   * `getInstance` query — used by the (decision-view) layout, which already has
   * the instance from loadDecision. Omitted by the canonical /decisions/[slug]
   * page, which falls back to the query.
   */
  processInstance?: ProcessInstance;
}

/** Legacy getInstance endpoint (for the /profile/[slug]/decisions/[id] route). */
interface LegacyDecisionHeaderProps extends DecisionHeaderBaseProps {
  useLegacy: true;
  /** Profile slug for the back button */
  slug: string;
}

type DecisionHeaderProps =
  | StandardDecisionHeaderProps
  | LegacyDecisionHeaderProps;

/**
 * Header bar + optional phase stepper for a decision. Render inside a
 * DecisionTranslationProvider — the stepper relies on it for phase-name
 * translations. Decorative/hero backgrounds are owned by the page (e.g. the
 * results hero); the header bar itself renders on white.
 */
export function DecisionHeader(props: DecisionHeaderProps) {
  const { instanceId } = props;

  useTrackPageView(
    'process_viewed',
    getDecisionCommonProperties({ decisionInstanceId: instanceId }),
    [instanceId],
  );

  if (props.useLegacy) {
    return <LegacyDecisionHeaderContent {...props} />;
  }
  if (props.processInstance) {
    return (
      <DecisionHeaderFromProps
        {...props}
        processInstance={props.processInstance}
      />
    );
  }
  return <DecisionHeaderContent {...props} />;
}

/**
 * Maps the encoded instanceData phases to the ProcessPhase shape the stepper
 * consumes. Shared by the query and prop header variants.
 */
function toProcessPhases(
  instanceData: InstanceData | undefined,
): ProcessPhase[] {
  return (instanceData?.phases ?? []).map((p) => ({
    id: p.phaseId,
    name: p.name || '',
    description: p.description,
    phase: {
      startDate: p.startDate,
      endDate: p.endDate,
    },
    advancementMethod: p.rules?.advancement?.method,
  }));
}

/** Presentational header bar + optional stepper, fed by either variant below. */
function DecisionHeaderView({
  instanceId,
  decisionSlug,
  isAdmin,
  canReadUpdates,
  centerSlot,
  showStepper = true,
  title,
  phases,
  currentStateId,
}: StandardDecisionHeaderProps & {
  title: string;
  phases: ProcessPhase[];
  currentStateId: string;
}) {
  return (
    <>
      <DecisionInstanceHeader
        backTo={{ href: '/decisions' }}
        title={title}
        decisionSlug={decisionSlug}
        isAdmin={isAdmin}
        canReadUpdates={canReadUpdates}
        centerSlot={centerSlot}
      />
      {showStepper ? (
        <DecisionStepperBar
          phases={phases}
          currentStateId={currentStateId}
          instanceId={instanceId}
          isAdmin={isAdmin}
        />
      ) : null}
    </>
  );
}

/** Query variant: canonical /decisions/[slug] page (no instance passed in). */
function DecisionHeaderContent(props: StandardDecisionHeaderProps) {
  const t = useTranslations();
  const [instance] = trpc.decision.getInstance.useSuspenseQuery({
    instanceId: props.instanceId,
  });

  return (
    <DecisionHeaderView
      {...props}
      title={
        props.profileName ||
        instance.name ||
        instance.instanceData?.templateName ||
        instance.process?.name ||
        t('Untitled')
      }
      phases={toProcessPhases(instance.instanceData)}
      currentStateId={instance.currentStateId || ''}
    />
  );
}

/** Prop variant: (decision-view) layout passes the instance from loadDecision. */
function DecisionHeaderFromProps(
  props: StandardDecisionHeaderProps & { processInstance: ProcessInstance },
) {
  const t = useTranslations();
  const { processInstance: instance } = props;

  return (
    <DecisionHeaderView
      {...props}
      title={
        props.profileName ||
        instance.name ||
        instance.instanceData?.templateName ||
        instance.process?.name ||
        t('Untitled')
      }
      phases={toProcessPhases(instance.instanceData)}
      currentStateId={instance.currentStateId || ''}
    />
  );
}

function LegacyDecisionHeaderContent({
  instanceId,
  decisionSlug,
  isAdmin,
  slug,
  profileName,
}: LegacyDecisionHeaderProps) {
  const [instance] = trpc.decision.getLegacyInstance.useSuspenseQuery({
    instanceId,
  });

  const instancePhases = instance.instanceData?.phases ?? [];
  const processSchema = instance.process?.processSchema;
  const templateStates = processSchema?.states ?? [];

  const phases: ProcessPhase[] = instancePhases.map((p) => {
    const templateState = templateStates.find((s) => s.id === p.phaseId);
    return {
      id: p.phaseId,
      name: templateState?.name ?? '',
      description: templateState?.description,
      type: templateState?.type,
      phase: templateState?.phase || {
        startDate: p.startDate,
        endDate: p.endDate,
      },
    };
  });

  return (
    <>
      <DecisionInstanceHeader
        backTo={{ href: `/profile/${slug}?tab=decisions` }}
        title={profileName || instance.name || instance.process?.name || ''}
        decisionSlug={decisionSlug}
        isAdmin={isAdmin}
      />
      <DecisionStepperBar
        phases={phases}
        currentStateId={instance.currentStateId || ''}
        instanceId={instanceId}
        isAdmin={isAdmin}
      />
    </>
  );
}
