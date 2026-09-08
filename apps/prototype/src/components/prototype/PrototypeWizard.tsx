'use client';

import { toast } from '@op/sense/Toast';

import { useRouter, useTranslations } from '@/lib/i18n';

import { CreateProcessWizard } from '@/components/decisions/CreateProcessWizard';

import { saveDraft } from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The wizard with its one side effect swapped: instead of creating a process
 * through the API it writes the draft to local storage and opens the resulting
 * process page, so the walkthrough continues past the last step.
 */
export function PrototypeWizard() {
  const t = useTranslations();
  const router = useRouter();

  return (
    <CreateProcessWizard
      onExit={() => router.push('/prototype/decisions')}
      onComplete={(draft) => {
        /* The draft names phases by translation key; store what the reader
           will see. `phaseName` is the participant-facing one — `name` is the
           pitch the admin read while choosing the piece. */
        const id = saveDraft(
          draft,
          draft.pieces.map((piece) => t(piece.phaseName ?? piece.name)),
        );

        toast.success(`Prototype: created "${draft.name}"`);
        router.push(`/prototype/decisions/${id}`);
      }}
    />
  );
}
