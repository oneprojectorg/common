'use client';

import { Header1 } from '@op/sense/Header';
import { Spinner } from '@op/sense/Spinner';
import { useParams } from 'next/navigation';

import { useRouter } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { PrototypeProcessOverview } from './PrototypeProcessOverview';
import {
  type PrototypeProcess,
  updateProcess,
  usePrototypeProcess,
} from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Owns which state the process page is in. A draft opens in edit mode — that is
 * where the wizard lands you — and a published process opens read-only, with
 * Edit process turning editing on. Edits are written straight to local storage and
 * the page re-read, so leaving and coming back shows what was set up.
 */
export function PrototypeProcessPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { process, isResolved, reload } = usePrototypeProcess(params.id);

  if (!isResolved) {
    return (
      <div className="flex justify-center p-16" aria-live="polite">
        <Spinner />
      </div>
    );
  }

  if (!process) {
    return (
      <div className="flex flex-col items-start gap-4 p-8 sm:p-14">
        <Header1 className="text-headline">Not in this browser</Header1>
        <p className="text-muted-foreground">
          Prototype processes live in local storage, so a link to one only opens
          on the machine that created it.
        </p>
        <ButtonLink href="/prototype/decisions">Back to decisions</ButtonLink>
      </div>
    );
  }

  /**
   * There is no mode to be in: a draft is being set up, and a live process is
   * just itself — which is also what makes launching work, since flipping the
   * status is the whole of the transition.
   */
  const editing = process.status === 'draft';

  const change = (patch: (current: PrototypeProcess) => PrototypeProcess) => {
    updateProcess(process.id, patch);
    reload();
  };

  return (
    <>
      <PrototypeProcessOverview
        process={process}
        isEditing={editing}
        onStopEditing={() => router.push('/prototype/decisions')}
        onChange={change}
        onOpenPhase={(phaseId) =>
          router.push(`/prototype/decisions/${process.id}/phases/${phaseId}`)
        }
      />
    </>
  );
}
