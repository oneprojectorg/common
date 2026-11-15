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
import { LuArrowLeft } from 'react-icons/lu';

import { useRouter, useTranslations } from '@/lib/i18n';

import { ButtonLink } from '../../ButtonLink';
import { UserAvatarMenu } from '../../SiteHeader';
import {
  CollaborativeDocProvider,
  useCollaborativeDoc,
} from '../../collaboration';
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
              fields={compileProposalSchema(template)}
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

  const fields = useMemo(() => compileProposalSchema(template), [template]);
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

    const result = validate();

    if (!result.valid) {
      setErrors(result.errors);
      toast.error(t('decisions.entryEditor.notReadyTitle'), {
        description: t('decisions.entryEditor.notReadyDescription'),
      });
      focusFirstInvalidField(formRef.current, fields, result.errors);
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
    <div className="flex h-screen flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-editor-topbar shrink-0 items-center justify-between gap-2 border-b bg-background px-4 sm:px-6">
        <ButtonLink href={backHref} variant="link" className="shrink-0">
          <LuArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
          {t('Back')}
        </ButtonLink>
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {status}
          {action}
          <UserAvatarMenu className="hidden sm:block" />
        </div>
      </header>

      {/* The form pane is the one shown first on a phone: Advance acts on it. */}
      <SplitPane
        className="mx-auto w-full max-w-6xl"
        defaultMobileTabId="entry"
      >
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
            <Badge variant="success">{t('develop.entrySubmittedStatus')}</Badge>
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

/**
 * Whether the shared document has reached the server. Empty until the first
 * local edit, then "Saving…" while edits are unsynced and "Saved" once they
 * all are.
 */
function EntrySaveStatus() {
  const t = useTranslations('decisions.entryEditor');
  const { provider } = useCollaborativeDoc();
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');

  useEffect(() => {
    const handleUnsyncedChanges = ({ number }: { number: number }) => {
      setState(number > 0 ? 'saving' : 'saved');
    };

    provider.on('unsyncedChanges', handleUnsyncedChanges);
    return () => {
      provider.off('unsyncedChanges', handleUnsyncedChanges);
    };
  }, [provider]);

  return (
    <span aria-live="polite" className="truncate text-sm text-muted-foreground">
      {state === 'saving'
        ? t('savingStatus')
        : state === 'saved'
          ? t('savedStatus')
          : null}
    </span>
  );
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
