'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { type ProcessInstance, ProposalStatus } from '@op/api/encoders';
import {
  type Proposal,
  type ProposalDataInput,
  type ProposalTemplateSchema,
  type SchemaValidationResult,
  parseProposalData,
} from '@op/common/client';
import {
  type ReactNode,
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import {
  CollaborativeDocProvider,
  useCollaborativeDoc,
  useOptionalCollaborativeDoc,
} from '../../collaboration';
import { compileProposalSchema } from '../forms/proposal';
import type { FieldDescriptor } from '../forms/types';
import { schemaHasOptions } from '../proposalTemplate';
import { ProposalFormRenderer } from './ProposalFormRenderer';
import { useOptionalVersionPreview } from './VersionPreviewContext';
import { handleMutationError } from './handleMutationError';
import { useProposalCollabToken } from './useProposalCollabToken';
import { type ProposalDraftFields, useProposalDraft } from './useProposalDraft';
import { useProposalValidation } from './useProposalValidation';

interface ProposalFormState {
  /** System fields (title, category, budget, location) as edited locally. */
  draft: ProposalDraftFields;
  /** The proposal is a draft that the edit page can submit. */
  isDraft: boolean;
  fields: FieldDescriptor[];
}

interface ProposalFormActions {
  updateField: (key: string, value: unknown) => void;
  validate: () => SchemaValidationResult;
  /** Persists the current draft now. Rejects when the update fails. */
  save: () => Promise<void>;
}

interface ProposalFormMeta {
  decisionProfileId: string | null;
}

interface ProposalFormContextValue {
  state: ProposalFormState;
  actions: ProposalFormActions;
  meta: ProposalFormMeta;
}

// Create a version snapshot after 60 seconds without local edits.
const VERSION_INTERVAL_SECONDS = 60;

const ProposalFormContext = createContext<ProposalFormContextValue | null>(
  null,
);

/**
 * Owns the proposal form: the collaborative document, the draft of the system
 * fields, validation and saving. Reuses a `CollaborativeDocProvider` mounted
 * above it, else mounts one and shows `fallback` until it syncs.
 */
export function ProposalFormProvider({
  instance,
  proposal,
  isEditMode,
  fallback,
  children,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
  isEditMode: boolean;
  fallback: ReactNode;
  children: ReactNode;
}) {
  const { user } = useRequiredUser();
  const t = useTranslations();

  const getToken = useProposalCollabToken(proposal.profileId);

  const collaborationDocId = useMemo(() => {
    const { collaborationDocId: existingId } = parseProposalData(
      proposal?.proposalData,
    );

    if (existingId) {
      return existingId;
    }

    throw new Error(
      'Legacy proposals without collaboration documents cannot be edited',
    );
  }, [proposal?.proposalData]);

  const userName =
    user.profile?.name ?? t('decisions.proposals.anonymousAuthor');

  const proposalTemplate = proposal.proposalTemplate ?? null;

  if (!proposalTemplate) {
    throw new Error('Proposal template not found');
  }

  const existingCollab = useOptionalCollaborativeDoc();

  const inner = (
    <ProposalFormStateProvider
      instance={instance}
      proposal={proposal}
      isEditMode={isEditMode}
      collaborationDocId={collaborationDocId}
      proposalTemplate={proposalTemplate}
    >
      {children}
    </ProposalFormStateProvider>
  );

  if (existingCollab) {
    return inner;
  }

  return (
    <CollaborativeDocProvider
      docId={collaborationDocId}
      getToken={getToken}
      userName={userName}
      fallback={fallback}
    >
      {inner}
    </CollaborativeDocProvider>
  );
}

export function useProposalForm(): ProposalFormContextValue {
  const context = use(ProposalFormContext);

  if (!context) {
    throw new Error('useProposalForm must be used within ProposalFormProvider');
  }

  return context;
}

/** The live fields, or the version selected in `VersionPreviewContext`. */
export function ProposalFormFields() {
  const {
    state: { draft, fields },
    actions: { updateField },
    meta: { decisionProfileId },
  } = useProposalForm();
  const versionPreview = useOptionalVersionPreview();

  return (
    <ProposalFormRenderer
      fields={fields}
      draft={draft}
      decisionProfileId={decisionProfileId}
      onFieldChange={updateField}
      mode={versionPreview ? 'preview-version' : 'edit-collaborative'}
      previewVersionFragmentContents={versionPreview?.fragmentContents}
    />
  );
}

/** Inside `CollaborativeDocProvider`, so it can read the Yjs document. */
function ProposalFormStateProvider({
  instance,
  proposal,
  isEditMode,
  collaborationDocId,
  proposalTemplate,
  children,
}: {
  instance: ProcessInstance;
  proposal: Proposal;
  isEditMode: boolean;
  collaborationDocId: string;
  proposalTemplate: ProposalTemplateSchema;
  children: ReactNode;
}) {
  const t = useTranslations();
  const { ydoc, provider, isSynced, isAccessDenied } = useCollaborativeDoc();
  const isPreviewMode = Boolean(useOptionalVersionPreview());
  const pendingVersionTimeoutRef = useRef<number | null>(null);

  const isDraft = isEditMode && proposal?.status === ProposalStatus.DRAFT;

  const { draft, draftRef, handleFieldChange } = useProposalDraft({
    proposal,
    isEditMode,
    collaborationDocId,
    isAutoSaveBlocked: isAccessDenied,
  });

  const templateRef = useRef(proposalTemplate);
  templateRef.current = proposalTemplate;

  const fields = compileProposalSchema(proposalTemplate);

  const { validate } = useProposalValidation(ydoc, proposalTemplate);

  const updateProposalMutation = trpc.decision.updateProposal.useMutation({
    onError: (error) => handleMutationError(error, 'update', t),
  });

  useEffect(() => {
    if (!provider || !isSynced || isPreviewMode) {
      return;
    }

    const scheduleVersionOnLocalChange = (transaction: { local: boolean }) => {
      if (!transaction.local) {
        return;
      }

      if (pendingVersionTimeoutRef.current !== null) {
        window.clearTimeout(pendingVersionTimeoutRef.current);
      }

      pendingVersionTimeoutRef.current = window.setTimeout(() => {
        pendingVersionTimeoutRef.current = null;

        provider.createVersion(undefined, true);
      }, VERSION_INTERVAL_SECONDS * 1000);
    };

    ydoc.on('afterTransaction', scheduleVersionOnLocalChange);

    return () => {
      ydoc.off('afterTransaction', scheduleVersionOnLocalChange);

      if (pendingVersionTimeoutRef.current !== null) {
        window.clearTimeout(pendingVersionTimeoutRef.current);
        pendingVersionTimeoutRef.current = null;
      }
    };
  }, [isPreviewMode, isSynced, provider, ydoc]);

  // Reads the refs at call time: the user can keep typing while a host screen
  // waits on a confirmation dialog.
  const save = useCallback(async () => {
    const currentDraft = draftRef.current;
    const template = templateRef.current;

    const categorySchema = template.properties?.category;
    const hasCategories =
      typeof categorySchema === 'object' && schemaHasOptions(categorySchema);

    const proposalData: ProposalDataInput = {
      ...parseProposalData(proposal.proposalData),
      collaborationDocId,
      category: hasCategories
        ? currentDraft.category.length > 0
          ? currentDraft.category
          : undefined
        : undefined,
      budget: currentDraft.budget ?? undefined,
    };

    await updateProposalMutation.mutateAsync({
      proposalId: proposal.id,
      data: {
        title: currentDraft.title,
        proposalData,
        ...(!isDraft ? { checkpointVersion: { type: 'update' } } : {}),
      },
    });
  }, [collaborationDocId, proposal, isDraft, updateProposalMutation, draftRef]);

  const value: ProposalFormContextValue = {
    state: { draft, isDraft, fields },
    actions: { updateField: handleFieldChange, validate, save },
    meta: { decisionProfileId: instance.profileId ?? null },
  };

  return <ProposalFormContext value={value}>{children}</ProposalFormContext>;
}
