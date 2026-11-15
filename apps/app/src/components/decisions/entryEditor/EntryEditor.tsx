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
import { ProposalFormRenderer } from '../proposalEditor/ProposalFormRenderer';
import { getProposalEditorTemplate } from '../proposalEditor/getProposalEditorTemplate';
import { handleMutationError } from '../proposalEditor/handleMutationError';
import { useProposalCollabToken } from '../proposalEditor/useProposalCollabToken';
import {
  type ProposalDraftFields,
  useProposalDraft,
} from '../proposalEditor/useProposalDraft';
import { useProposalValidation } from '../proposalEditor/useProposalValidation';
import { decisionRootHref } from '../proposalHrefs';
import { type EntryOrigin, EntryOriginColumn } from './EntryOriginColumn';

interface EntryEditorProps {
  instance: ProcessInstance;
  /** The entry: a proposal developed from `origins`. */
  proposal: Proposal;
  decisionSlug: string;
  /** At least one. */
  origins: EntryOrigin[];
}

/**
 * The entry editor: the entry's origins on one side, read only, and the entry
 * form on the other, with Advance in the header.
 *
 * The form is the proposal editor's collaborative stack, driven by the entry's
 * own template. Advance validates the form on the client and then submits the
 * entry with `submitDevelopedProposal`. When the server refuses edits to the
 * entry (`isEditable` is false, for example once it is submitted and the phase
 * closes editing), the form renders read only from the submitted document.
 */
export function EntryEditor({
  instance,
  proposal,
  decisionSlug,
  origins,
}: EntryEditorProps) {
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
    <EntryOriginColumn
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

  if (!proposal.isEditable) {
    return (
      <EntryEditorFrame
        backHref={backHref}
        origin={originColumn}
        entry={
          <EntryColumn proposal={proposal} isReadOnly>
            <ProposalFormRenderer
              fields={getEntryFormFields(template)}
              draft={getReadOnlyDraft(proposal)}
              decisionProfileId={instance.profileId ?? null}
              onFieldChange={() => {}}
              mode="preview-version"
              previewVersionFragmentContents={getSubmittedFragments(proposal)}
            />
          </EntryColumn>
        }
      />
    );
  }

  return (
    <CollaborativeEntryEditor
      instance={instance}
      proposal={proposal}
      template={template}
      backHref={backHref}
      originColumn={originColumn}
    />
  );
}

function CollaborativeEntryEditor({
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
      <EntryForm
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
function EntryForm({
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
  const utils = trpc.useUtils();
  const { ydoc } = useCollaborativeDoc();
  const formRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isAdvancing, setIsAdvancing] = useState(false);

  const fields = useMemo(() => getEntryFormFields(template), [template]);
  const { validate } = useProposalValidation(ydoc, template);
  const { draft, draftRef, buildProposalData, handleFieldChange } =
    useProposalDraft({ proposal, isEditMode: true, collaborationDocId });

  const updateProposal = trpc.decision.updateProposal.useMutation({
    onError: (error) => handleMutationError(error, 'update', t),
  });
  const submitEntry = trpc.decision.submitDevelopedProposal.useMutation({
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

    // Validated as submit validates: the category set at create lives in the
    // stored data, not in a fragment.
    const storedData = buildProposalData(draftRef.current);
    const result = validate({
      category: storedData.category,
      budget: storedData.budget,
    });

    if (!result.valid) {
      const fieldErrors = getErrorsByField(result.errors);
      const renderedKeys = new Set(fields.map((field) => field.key));
      // A failing key with no field on screen is named in the toast, so no
      // failure is ever left unexplained.
      const unshownErrors = Object.entries(fieldErrors)
        .filter(([key]) => !renderedKeys.has(key))
        .map(([, message]) => message);

      setErrors(fieldErrors);
      toast.error(t('decisions.entryEditor.notReadyTitle'), {
        description:
          unshownErrors.length > 0
            ? unshownErrors.join(' ')
            : t('decisions.entryEditor.notReadyDescription'),
      });
      focusFirstInvalidField(formRef.current, fields, fieldErrors);
      return;
    }

    setErrors({});
    setIsAdvancing(true);

    try {
      const current = draftRef.current;

      // Autosave is debounced, so the title and system fields are saved now:
      // submit reads them from the row.
      await updateProposal.mutateAsync({
        proposalId: proposal.id,
        data: {
          title: current.title,
          proposalData: buildProposalData(current),
        },
      });
      await submitEntry.mutateAsync({ proposalId: proposal.id });

      void utils.decision.listProposals.invalidate({
        processInstanceId: proposal.processInstanceId,
      });
      void utils.decision.getProposal.invalidate({
        profileId: proposal.profileId,
      });

      toast.success(t('decisions.entryEditor.advancedTitle'), {
        description: t('decisions.entryEditor.advancedDescription', {
          title: current.title || t('decisions.develop.untitledEntry'),
        }),
      });
      router.push(backHref);
    } catch {
      // Reported and toasted by the mutations' `onError`.
    } finally {
      setIsAdvancing(false);
    }
  };

  return (
    <EntryEditorFrame
      backHref={backHref}
      status={<EntrySaveStatus />}
      action={
        isDraft ? (
          <Button onClick={() => void handleAdvance()} loading={isAdvancing}>
            {t('decisions.entryEditor.advanceAction')}
          </Button>
        ) : null
      }
      origin={originColumn}
      entry={
        <EntryColumn proposal={proposal}>
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

/** The header and the two columns. */
function EntryEditorFrame({
  backHref,
  status,
  action,
  origin,
  entry,
}: {
  backHref: string;
  status?: ReactNode;
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

      {/* The form pane is the one shown first on a phone: Advance acts on it. */}
      <SplitPane className="mx-auto max-w-6xl" defaultMobileTabId="entry">
        <SplitPane.Pane
          id="origin"
          label={t('decisions.entryEditor.proposalTab')}
        >
          {origin}
        </SplitPane.Pane>
        <SplitPane.Pane id="entry" label={t('decisions.entryEditor.entryTab')}>
          {entry}
        </SplitPane.Pane>
      </SplitPane>
    </div>
  );
}

/** The entry column: heading, intro or status, then the form. */
function EntryColumn({
  proposal,
  isReadOnly = false,
  children,
}: {
  proposal: Proposal;
  isReadOnly?: boolean;
  children: ReactNode;
}) {
  const t = useTranslations('decisions');
  const isDraft = proposal.status === ProposalStatus.DRAFT;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Header2>{t('entryEditor.heading')}</Header2>
        {isDraft ? (
          <p className="text-base text-foreground">{t('entryEditor.intro')}</p>
        ) : (
          <div>
            <Badge variant="success">{t('develop.entryReadyStatus')}</Badge>
          </div>
        )}
        {isReadOnly ? (
          <p className="text-base text-muted-foreground">
            {t('entryEditor.readOnlyNotice')}
          </p>
        ) : null}
      </div>
      {children}
    </div>
  );
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
function EntrySaveStatus() {
  const t = useTranslations('decisions.entryEditor');
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
 * The template's fields minus the category. An entry's category is copied
 * from its origin at create and kept in the stored data; the form hides
 * category options that name a district, so the field would show no choices.
 */
function getEntryFormFields(template: ProposalTemplateSchema) {
  return compileProposalSchema(template).filter(
    (field) => field.key !== 'category',
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

/** The submitted document's fragments, keyed by field. */
function getSubmittedFragments(
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
