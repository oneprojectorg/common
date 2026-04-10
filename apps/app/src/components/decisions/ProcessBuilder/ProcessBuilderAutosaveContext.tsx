'use client';

import { trpc } from '@op/api/client';
import { useDebouncedCallback } from '@op/hooks';
import { toast } from '@op/ui/Toast';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';

import {
  type ProcessBuilderInstanceData,
  type SaveStatus,
  useProcessBuilderStore,
} from './stores/useProcessBuilderStore';

const AUTOSAVE_DEBOUNCE_MS = 1000;

interface AutosaveActions {
  saveChanges: (data: Partial<ProcessBuilderInstanceData>) => void;
  /** Flushes any pending debounced save. Returns a promise that resolves
   *  when the in-flight mutation completes (or immediately if nothing pending). */
  flushPendingChanges: () => Promise<void>;
}

interface AutosaveStatus {
  status: SaveStatus;
  savedAt?: Date;
}

const ActionsContext = createContext<AutosaveActions | null>(null);
const StatusContext = createContext<AutosaveStatus>({ status: 'idle' });

export function useProcessBuilderAutosave(): AutosaveActions & {
  saveState: AutosaveStatus;
} {
  const actions = useContext(ActionsContext);
  if (!actions) {
    throw new Error(
      'useProcessBuilderAutosave must be used within ProcessBuilderAutosaveProvider',
    );
  }
  const saveState = useContext(StatusContext);
  return { ...actions, saveState };
}

export function ProcessBuilderAutosaveProvider({
  decisionProfileId,
  instanceId,
  isDraft,
  children,
}: {
  decisionProfileId: string;
  instanceId: string;
  isDraft: boolean;
  children: React.ReactNode;
}) {
  const utils = trpc.useUtils();
  const setInstanceData = useProcessBuilderStore((s) => s.setInstanceData);
  const setProposalTemplateSchema = useProcessBuilderStore(
    (s) => s.setProposalTemplateSchema,
  );
  const setRubricTemplateSchema = useProcessBuilderStore(
    (s) => s.setRubricTemplateSchema,
  );
  const setSaveStatus = useProcessBuilderStore((s) => s.setSaveStatus);
  const markSaved = useProcessBuilderStore((s) => s.markSaved);
  const saveState = useProcessBuilderStore((s) =>
    s.getSaveState(decisionProfileId),
  );

  // Tracks the in-flight mutation promise so flushPendingChanges can await it.
  const inflightRef = useRef<Promise<unknown> | null>(null);

  // Accumulates only the fields that changed since the last debounce fired.
  // This ensures saves are scoped — editing phases only sends phases, not
  // the full snapshot — so concurrent editors on different sections don't
  // overwrite each other.
  const dirtyFieldsRef = useRef<Partial<ProcessBuilderInstanceData>>({});

  const debouncedSaveRef = useRef<() => boolean>(null);
  const updateInstance = trpc.decision.updateDecisionInstance.useMutation({
    onSuccess: () => markSaved(decisionProfileId),
    onError: (error) => {
      setSaveStatus(decisionProfileId, 'error');
      toast.error({
        title: 'Failed to save changes',
        message: error.message,
      });
    },
    onSettled: () => {
      inflightRef.current = null;
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

      // Suppress unhandled rejection — errors are handled by the mutation's
      // onError callback. The promise is stored so flushPendingChanges can await it.
      inflightRef.current = updateInstance
        .mutateAsync({
          instanceId,
          ...payload,
        })
        .catch(() => {});
    } else {
      // Published: data is already in the store (written immediately by
      // saveChanges). Mark as saved for the UI indicator.
      markSaved(decisionProfileId);
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

      // Accumulate dirty fields for the next debounced save
      dirtyFieldsRef.current = { ...dirtyFieldsRef.current, ...data };

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

  const flushPendingChanges = useCallback(async () => {
    debouncedSave.flush();
    if (inflightRef.current) {
      try {
        await inflightRef.current;
      } catch {
        // Error already handled by onError callback
      }
    }
  }, [debouncedSave]);

  const actions = useMemo<AutosaveActions>(
    () => ({ saveChanges, flushPendingChanges }),
    [saveChanges, flushPendingChanges],
  );

  return (
    <ActionsContext.Provider value={actions}>
      <StatusContext.Provider value={saveState}>
        {children}
      </StatusContext.Provider>
    </ActionsContext.Provider>
  );
}
