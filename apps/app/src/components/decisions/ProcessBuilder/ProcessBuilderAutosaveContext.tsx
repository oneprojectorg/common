'use client';

import { trpc } from '@op/api/client';
import { ProcessStatus } from '@op/api/encoders';
import { useDebouncedCallback } from '@op/hooks';
import { toast } from '@op/sense/Toast';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import { useTranslations } from '@/lib/i18n';

import { toOverviewInput, toPhasesInput } from './headlinePatch';
import {
  type ProcessBuilderInstanceData,
  type SaveStatus,
  useProcessBuilderStore,
} from './stores/useProcessBuilderStore';

const AUTOSAVE_DEBOUNCE_MS = 1000;

interface AutosaveActions {
  saveChanges: (data: Partial<ProcessBuilderInstanceData>) => void;
  /** Flushes any pending debounced save. Returns true if all pending saves
   *  completed successfully, false if a save failed (error already toasted). */
  flushPendingChanges: () => Promise<boolean>;
}

interface AutosaveStatus {
  status: SaveStatus;
  savedAt?: Date;
}

const ActionsContext = createContext<AutosaveActions | null>(null);
const StatusContext = createContext<AutosaveStatus>({ status: 'idle' });

export function useProcessBuilderAutosave(): AutosaveActions & {
  autosaveStatus: AutosaveStatus;
} {
  const actions = useContext(ActionsContext);
  if (!actions) {
    throw new Error(
      'useProcessBuilderAutosave must be used within ProcessBuilderAutosaveProvider',
    );
  }
  const autosaveStatus = useContext(StatusContext);
  return { ...actions, autosaveStatus };
}

export function ProcessBuilderAutosaveProvider({
  decisionProfileId,
  instanceId,
  isDraft: isDraftInitial,
  children,
}: {
  decisionProfileId: string;
  instanceId: string;
  /** SSR snapshot, used only until the live query resolves — the status
   *  can change mid-session (another tab/admin launches the process). */
  isDraft: boolean;
  children: React.ReactNode;
}) {
  const t = useTranslations();
  const utils = trpc.useUtils();

  // Already cached by section queries — no extra request.
  const { data: liveInstance } = trpc.decision.getInstance.useQuery({
    instanceId,
  });
  const isDraft = liveInstance
    ? liveInstance.status === ProcessStatus.DRAFT
    : isDraftInitial;
  const setInstanceData = useProcessBuilderStore((s) => s.setInstanceData);
  const setProposalTemplateSchema = useProcessBuilderStore(
    (s) => s.setProposalTemplateSchema,
  );
  const setRubricTemplateSchema = useProcessBuilderStore(
    (s) => s.setRubricTemplateSchema,
  );
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);
  const clearDirtyFields = useProcessBuilderStore((s) => s.clearDirtyFields);
  const currentStatus = useProcessBuilderStore((s) =>
    s.getSaveState(decisionProfileId),
  );

  // Unsaved published-process edits live only in memory — warn before the
  // page unloads. In-app navigation is client-side and never triggers this.
  useEffect(() => {
    const warnUnsaved = (e: BeforeUnloadEvent) => {
      if (isDraft) {
        return;
      }
      const dirty = useProcessBuilderStore.getState().dirty[decisionProfileId];
      if (dirty && Object.keys(dirty).length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', warnUnsaved);
    return () => window.removeEventListener('beforeunload', warnUnsaved);
  }, [decisionProfileId, isDraft]);

  // Drop the store persisted by versions that used localStorage
  useEffect(() => {
    try {
      localStorage.removeItem('process-builder');
    } catch {
      // localStorage unavailable — nothing to clean
    }
  }, []);

  // Tracks the in-flight mutation promise so flushPendingChanges can await it.
  const inflightRef = useRef<Promise<unknown> | null>(null);

  // Accumulates only the fields that changed since the last debounce fired.
  // This ensures saves are scoped — editing phases only sends phases, not
  // the full snapshot — so edits in one section don't overwrite changes
  // the user made in another section.
  const dirtyFieldsRef = useRef<Partial<ProcessBuilderInstanceData>>({});

  const debouncedSaveRef = useRef<() => boolean>(null);
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => markSaved(decisionProfileId),
    onError: (error) => {
      setSaveStatus(decisionProfileId, 'error');
      toast.error(t('Failed to save changes'), {
        description: error.message,
      });
    },
    onSettled: () => {
      inflightRef.current = null;
      // Another save is queued — let its onSettled invalidate instead,
      // avoiding a stale refetch that could overwrite optimistic updates.
      if (debouncedSaveRef.current?.()) {
        return;
      }
      void utils.decision.getInstance.invalidate({ instanceId });
    },
  });

  const debouncedSave = useDebouncedCallback(() => {
    const payload = dirtyFieldsRef.current;
    dirtyFieldsRef.current = {};

    if (Object.keys(payload).length === 0) {
      return;
    }

    if (isDraft) {
      setSaveStatus(decisionProfileId, 'saving');

      // Store the raw promise so flushPendingChanges can detect failure.
      // Suppress unhandled rejection separately — errors are surfaced by
      // the mutation's onError callback (toast + status).
      const promise = updateInstance.mutateAsync({
        instanceId,
        ...payload,
        // An emptied headline field goes out as an explicit clear; `''` is
        // rejected by the endpoint.
        ...(payload.overview && {
          overview: toOverviewInput(payload.overview),
        }),
        ...(payload.phases && { phases: toPhasesInput(payload.phases) }),
      });
      inflightRef.current = promise;
      promise
        .then(() => {
          // Keep the persisted dirty map holding unsaved/failed edits only.
          clearDirtyFields(decisionProfileId, payload);
        })
        .catch(() => {
          // Error toasted by onError. Restore the payload so the next save
          // retries it (newer edits win); no scheduled retry — a rejecting
          // payload would loop.
          dirtyFieldsRef.current = {
            ...payload,
            ...dirtyFieldsRef.current,
            config: { ...payload.config, ...dirtyFieldsRef.current.config },
          };
        });
    } else {
      // Published: edits stay in the persisted dirty map until "Update
      // Process". No save indicator — nothing reached the server yet.
    }
  }, AUTOSAVE_DEBOUNCE_MS);
  debouncedSaveRef.current = () => debouncedSave.isPending();

  // Flush on provider unmount (page exit)
  useEffect(() => {
    return () => {
      debouncedSave.flush();
    };
  }, [debouncedSave]);

  const saveChanges = useCallback(
    (data: Partial<ProcessBuilderInstanceData>) => {
      // Write to the store immediately for responsive UI — survives
      // navigation between sections even if the debounce hasn't fired.
      const { proposalTemplate, rubricTemplate, ...rest } = data;

      if (Object.keys(rest).length > 0) {
        setInstanceData(decisionProfileId, rest);
      }
      if (proposalTemplate !== undefined) {
        setProposalTemplateSchema(decisionProfileId, proposalTemplate);
      }
      if (rubricTemplate !== undefined) {
        setRubricTemplateSchema(decisionProfileId, rubricTemplate);
      }

      // Accumulate dirty fields for the next debounced save.
      // Deep-merge config so rapid cross-section edits don't overwrite
      // each other's config sub-fields within the debounce window.
      dirtyFieldsRef.current = {
        ...dirtyFieldsRef.current,
        ...data,
        config: data.config
          ? { ...dirtyFieldsRef.current.config, ...data.config }
          : dirtyFieldsRef.current.config,
      };

      debouncedSave();
    },
    [
      decisionProfileId,
      setInstanceData,
      setProposalTemplateSchema,
      setRubricTemplateSchema,
      debouncedSave,
    ],
  );

  const flushPendingChanges = useCallback(async (): Promise<boolean> => {
    debouncedSave.flush();
    if (inflightRef.current) {
      try {
        await inflightRef.current;
      } catch {
        // Error already surfaced via onError toast — tell caller it failed
        return false;
      }
    }
    return true;
  }, [debouncedSave]);

  const actions = useMemo<AutosaveActions>(
    () => ({ saveChanges, flushPendingChanges }),
    [saveChanges, flushPendingChanges],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <StatusContext.Provider value={currentStatus}>
        {children}
      </StatusContext.Provider>
    </ActionsContext.Provider>
  );
}
