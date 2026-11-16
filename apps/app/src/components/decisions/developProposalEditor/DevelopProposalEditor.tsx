'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { type ProcessInstance, ProposalStatus } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalTemplateSchema,
  parseProposalData,
  resolveReviewSettings,
} from '@op/common/client';
import { Badge } from '@op/sense/Badge';
import { Button } from '@op/sense/Button';
import { Header2 } from '@op/sense/Header';
import { SplitPane } from '@op/sense/SplitPane';
import { toast } from '@op/sense/Toast';
import type { JSONContent } from '@tiptap/react';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';

import { useRouter, useTranslations } from '@/lib/i18n';

import { UserAvatarMenu } from '../../SiteHeader';
import {
  CollaborativeDocProvider,
  useCollaborativeDoc,
} from '../../collaboration';
import { DecisionSubpageHeader } from '../DecisionSubpageHeader';
import { ProposalEditorSkeleton } from '../ProposalEditorSkeleton';
import { compileProposalSchema } from '../forms/proposal';
import type { FieldDescriptor } from '../forms/types';
import {
  ProposalFormRenderer,
  showsInlineError,
} from '../proposalEditor/ProposalFormRenderer';
import { getProposalEditorTemplate } from '../proposalEditor/getProposalEditorTemplate';
import { handleMutationError } from '../proposalEditor/handleMutationError';
import { useProposalCollabToken } from '../proposalEditor/useProposalCollabToken';
import {
  type ProposalDraftFields,
  useProposalDraft,
} from '../proposalEditor/useProposalDraft';
import { useProposalValidation } from '../proposalEditor/useProposalValidation';
import { decisionRootHref } from '../proposalHrefs';
import { type DevelopOrigin, DevelopOriginColumn } from './DevelopOriginColumn';

interface DevelopProposalEditorProps {
  instance: ProcessInstance;
  /** The entry: a proposal developed from `origins`. */
  proposal: Proposal;
  decisionSlug: string;
  /** At least one. */
  origins: DevelopOrigin[];
  /** Decided once by the route: develop access and the server's `isEditable`. */
  isEditable: boolean;
}

/**
 * The develop editor: the entry's origins on one side, read only, and the
 * entry form on the other, with Advance in the header.
 *
 * The form is the proposal editor's collaborative stack, driven by the
 * entry's own template. Advance validates the form on the client, saves it,
 * and then advances the entry with `submitDevelopedProposal`. When the entry
 * is not editable, the form renders read only from the stored document.
 */
export function DevelopProposalEditor({
  instance,
  proposal,
  decisionSlug,
  origins,
  isEditable,
}: DevelopProposalEditorProps) {
  const backHref = `/decisions/${decisionSlug}/current`;

  const template = getProposalEditorTemplate({
    proposal,
    instanceTemplate: instance.instanceData.proposalTemplate,
  });

  if (!template) {
    throw new Error('Proposal template not found');
  }

  const phases = instance.instanceData.phases ?? [];
  const currentIndex = phases.findIndex(
    (phase) => phase.phaseId === instance.currentStateId,
  );
  const originPhaseId =
    currentIndex > 0 ? (phases[currentIndex - 1]?.phaseId ?? null) : null;

  // Mirrors the server's `canReadPhaseReviews` on the origin phase.
  const canReadReviews =
    Boolean(instance.access?.admin) ||
    (Boolean(instance.access?.review) &&
      !!originPhaseId &&
      resolveReviewSettings(instance.instanceData ?? {}, originPhaseId)
        .openReviews);

  const originColumn = (
    <DevelopOriginColumn
      origins={origins}
      decisionRoot={decisionRootHref({
        decisionSlug,
        slug: decisionSlug,
        instanceId: instance.id,
      })}
      originPhaseId={originPhaseId}
      canReadReviews={canReadReviews}
    />
  );

  if (!isEditable) {
    return (
      <DevelopEditorFrame
        backHref={backHref}
        action={<AdvancedBadge proposal={proposal} />}
        origin={originColumn}
        entry={
          <EntryColumn proposal={proposal} isEditable={false}>
            <ProposalFormRenderer
              fields={compileProposalSchema(template)}
              draft={getReadOnlyDraft(proposal)}
              decisionProfileId={instance.profileId ?? null}
              onFieldChange={() => {}}
              mode="preview-version"
              previewVersionFragmentContents={getStoredFragments(proposal)}
            />
          </EntryColumn>
        }
      />
    );
  }

  return (
    <CollaborativeDevelopForm
      instance={instance}
      proposal={proposal}
      template={template}
      backHref={backHref}
      originColumn={originColumn}
    />
  );
}

function CollaborativeDevelopForm({
  instance,
  proposal,
  template,
  backHref,
  originColumn,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
  template: ProposalTemplateSchema;
  backHref: string;
  originColumn: ReactNode;
}) {
  const t = useTranslations();
  const { user } = useRequiredUser();
  const getToken = useProposalCollabToken(proposal.profileId);
  const { collaborationDocId } = parseProposalData(proposal.proposalData);

  if (!collaborationDocId) {
    throw new Error(
      'Legacy proposals without collaboration documents cannot be edited',
    );
  }

  return (
    <CollaborativeDocProvider
      docId={collaborationDocId}
      getToken={getToken}
      userName={user.profile?.name ?? t('decisions.proposals.anonymousAuthor')}
      fallback={<ProposalEditorSkeleton />}
    >
      <DevelopEntryForm
        instance={instance}
        proposal={proposal}
        template={template}
        backHref={backHref}
        originColumn={originColumn}
        collaborationDocId={collaborationDocId}
      />
    </CollaborativeDocProvider>
  );
}

/** Inside `CollaborativeDocProvider`, so it can validate the shared document. */
function DevelopEntryForm({
  instance,
  proposal,
  template,
  backHref,
  originColumn,
  collaborationDocId,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
  template: ProposalTemplateSchema;
  backHref: string;
  originColumn: ReactNode;
  collaborationDocId: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { ydoc } = useCollaborativeDoc();
  const formRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAdvancing, setIsAdvancing] = useState(false);

  const fields = useMemo(() => compileProposalSchema(template), [template]);
  const { validate } = useProposalValidation(ydoc, template);
  const { draft, draftRef, buildProposalData, handleFieldChange } =
    useProposalDraft({ proposal, isEditMode: true, collaborationDocId });

  // No manual invalidation: both mutations register the `decisionProposals`
  // and `decisionProposal` channels, which refresh the develop lists and this
  // entry.
  const updateProposal = trpc.decision.updateProposal.useMutation({
    onError: (error) => handleMutationError(error, 'update', t),
  });
  const advanceEntry = trpc.decision.submitDevelopedProposal.useMutation({
    onError: (error) => handleMutationError(error, 'submit', t),
  });

  const isDraft = proposal.status === ProposalStatus.DRAFT;

  const onFieldChange = (key: string, value: unknown) => {
    handleFieldChange(key, value);
    // An edit answers that field's error; the others stay until the next try.
    setErrors((previous) => {
      if (!(key in previous)) {
        return previous;
      }
      const { [key]: _answered, ...rest } = previous;
      return rest;
    });
  };

  const handleAdvance = async () => {
    if (isAdvancing) {
      return;
    }

    // Validated as the server validates: it lays the stored category and
    // budget over the fragments, and a category set at create is in the
    // stored data until the field is edited.
    const storedData = buildProposalData(draftRef.current);
    const result = validate({
      category: storedData.category,
      budget: storedData.budget,
    });

    if (!result.valid) {
      const fieldErrors = getErrorsByField(result.errors);
      const inlineKeys = new Set(
        fields.filter(showsInlineError).map((field) => field.key),
      );
      // A message no field shows inline goes in the toast, so no failure is
      // left unexplained.
      const otherMessages = Object.entries(fieldErrors)
        .filter(([key]) => !inlineKeys.has(key))
        .map(([, message]) => message);

      setErrors(fieldErrors);
      toast.error(t('decisions.developEditor.notReadyTitle'), {
        description:
          otherMessages.length > 0
            ? otherMessages.join(' ')
            : t('decisions.developEditor.notReadyDescription'),
      });
      focusFirstInvalidField(formRef.current, fields, fieldErrors);
      return;
    }

    setErrors({});
    setIsAdvancing(true);

    try {
      const current = draftRef.current;

      // Autosave is debounced, so the title and system fields are saved now:
      // advance reads them from the row.
      await updateProposal.mutateAsync({
        proposalId: proposal.id,
        data: {
          title: current.title,
          proposalData: buildProposalData(current),
        },
      });
      await advanceEntry.mutateAsync({ proposalId: proposal.id });

      toast.success(
        t('decisions.developEditor.advancedToast', {
          title: current.title || t('decisions.develop.untitledEntry'),
        }),
      );
      router.push(backHref);
    } catch {
      // Reported and toasted by the mutations' `onError`.
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <DevelopEditorFrame
      backHref={backHref}
      status={<DevelopSaveStatus />}
      action={
        isDraft ? (
          <Button onClick={() => void handleAdvance()} loading={isAdvancing}>
            {t('decisions.developEditor.advanceAction')}
          </Button>
        ) : (
          <AdvancedBadge proposal={proposal} />
        )
      }
      origin={originColumn}
      entry={
        <EntryColumn proposal={proposal} isEditable>
          <div ref={formRef}>
            <ProposalFormRenderer
              fields={fields}
              draft={draft}
              decisionProfileId={instance.profileId ?? null}
              onFieldChange={onFieldChange}
              errors={errors}
            />
          </div>
        </EntryColumn>
      }
    />
  );
}

/** The header and the two panes. */
function DevelopEditorFrame({
  backHref,
  status,
  action,
  origin,
  entry,
}: {
  backHref: string;
  status?: ReactNode;
  /** The header's action slot: Advance, or the status once advanced. */
  action?: ReactNode;
  origin: ReactNode;
  entry: ReactNode;
}) {
  const t = useTranslations();

  return (
    // The review screen's shell: a viewport-high column, the decision subpage
    // header, and a centred split pane whose panes scroll on their own.
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <DecisionSubpageHeader
        backHref={backHref}
        backLabel={t('Back')}
        accountSlot={<UserAvatarMenu className="hidden sm:block" />}
      >
        {status}
        {action}
      </DecisionSubpageHeader>

      {/* The entry pane is the one shown first on a phone: Advance acts on it. */}
      <SplitPane className="mx-auto max-w-6xl" defaultMobileTabId="entry">
        <SplitPane.Pane
          id="origin"
          label={t('decisions.developEditor.proposalTab')}
        >
          {origin}
        </SplitPane.Pane>
        <SplitPane.Pane
          id="entry"
          label={t('decisions.developEditor.entryHeading')}
        >
          {entry}
        </SplitPane.Pane>
      </SplitPane>
    </div>
  );
}

/** The entry pane: heading, intro or read-only notice, then the form. */
function EntryColumn({
  proposal,
  isEditable,
  children,
}: {
  proposal: Proposal;
  isEditable: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('decisions.developEditor');
  const isDraft = proposal.status === ProposalStatus.DRAFT;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        {/* A fixed word for now: the phase's entry form name replaces it when
            the entry form lands. */}
        <Header2>{t('entryHeading')}</Header2>
        {isEditable && isDraft ? (
          <p className="text-base text-foreground">{t('intro')}</p>
        ) : null}
        {isEditable ? null : (
          <p className="text-base text-muted-foreground">
            {t('readOnlyNotice')}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}

/** Shown in place of Advance once the entry is advanced; nothing before. */
function AdvancedBadge({ proposal }: { proposal: Proposal }) {
  const t = useTranslations('decisions.developEditor');

  if (proposal.status === ProposalStatus.DRAFT) {
    return null;
  }

  return <Badge variant="success">{t('advancedStatus')}</Badge>;
}

/** How long edits stay unsynced before "Saving…" shows. */
const SAVING_SHOW_DELAY_MS = 800;
/** How long "Saving…" stays once shown, so it never blinks. */
const SAVING_MIN_VISIBLE_MS = 800;

/**
 * Whether the shared document has reached the server. Empty until the first
 * local edit, then "Saved". "Saving…" shows only when edits stay unsynced for
 * a moment, and then for a minimum time, so typing does not make the status
 * (or the live region) change on every keystroke. Both labels share one grid
 * cell, so switching between them does not shift the header.
 */
function DevelopSaveStatus() {
  const t = useTranslations('decisions.developEditor');
  const { provider } = useCollaborativeDoc();
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    let showTimer: number | null = null;
    let settleTimer: number | null = null;
    let savingShownAt: number | null = null;

    const clearTimer = (timer: number | null) => {
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };

    const handleUnsyncedChanges = ({ number }: { number: number }) => {
      if (number > 0) {
        clearTimer(settleTimer);
        settleTimer = null;
        if (savingShownAt === null && showTimer === null) {
          showTimer = window.setTimeout(() => {
            showTimer = null;
            savingShownAt = Date.now();
            setState('saving');
          }, SAVING_SHOW_DELAY_MS);
        }
        return;
      }

      clearTimer(showTimer);
      showTimer = null;

      if (savingShownAt === null) {
        setState('saved');
        return;
      }

      const remaining = SAVING_MIN_VISIBLE_MS - (Date.now() - savingShownAt);
      clearTimer(settleTimer);
      settleTimer = window.setTimeout(
        () => {
          settleTimer = null;
          savingShownAt = null;
          setState('saved');
        },
        Math.max(remaining, 0),
      );
    };

    provider.on('unsyncedChanges', handleUnsyncedChanges);
    return () => {
      provider.off('unsyncedChanges', handleUnsyncedChanges);
      clearTimer(showTimer);
      clearTimer(settleTimer);
    };
  }, [provider]);

  return (
    <span className="grid text-sm whitespace-nowrap text-muted-foreground">
      {/* Width reservers: the cell is as wide as the longer label. */}
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {t('savingStatus')}
      </span>
      <span aria-hidden className="invisible col-start-1 row-start-1">
        {t('savedStatus')}
      </span>
      <span aria-live="polite" className="col-start-1 row-start-1 text-end">
        {state === 'saving'
          ? t('savingStatus')
          : state === 'saved'
            ? t('savedStatus')
            : null}
      </span>
    </span>
  );
}

/**
 * One message per top-level field: a nested key such as `budget.amount`
 * belongs to the `budget` field.
 */
function getErrorsByField(
  errors: Record<string, string>,
): Record<string, string> {
  const byField: Record<string, string> = {};

  for (const [key, message] of Object.entries(errors)) {
    const field = key.split('.')[0] ?? key;
    byField[field] ??= message;
  }

  return byField;
}

const FOCUSABLE_CONTROL =
  '[contenteditable="true"], input:not([type="hidden"]), textarea, button';

/**
 * Focuses the control of the first field, in render order, that failed
 * validation. The renderer puts the title first, then budget and category,
 * then the template's own fields.
 */
function focusFirstInvalidField(
  form: HTMLElement | null,
  fields: FieldDescriptor[],
  errors: Record<string, string>,
) {
  if (!form) {
    return;
  }

  const renderOrder = [
    'title',
    'budget',
    'category',
    ...fields.filter((field) => !field.isSystem).map((field) => field.key),
  ];
  const firstKey = renderOrder.find((key) => key in errors);

  if (!firstKey) {
    return;
  }

  const field = form.querySelector(
    `[data-testid="field-${CSS.escape(firstKey)}"]`,
  );
  const control = field?.matches(FOCUSABLE_CONTROL)
    ? field
    : field?.querySelector(FOCUSABLE_CONTROL);

  if (control instanceof HTMLElement) {
    control.focus();
  }
}

/** The read-only renderer reads fragments, not the draft; this fills the type. */
function getReadOnlyDraft(proposal: Proposal): ProposalDraftFields {
  return {
    title: proposal.profile.name ?? '',
    category: [],
    budget: null,
    location: null,
  };
}

/** The stored document's fragments, keyed by field. */
function getStoredFragments(
  proposal: Proposal,
): Record<string, JSONContent | null> {
  if (proposal.documentContent?.type !== 'json') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(proposal.documentContent.fragments).map(
      ([key, fragment]) => [key, isJsonContent(fragment) ? fragment : null],
    ),
  );
}

function isJsonContent(value: unknown): value is JSONContent {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
