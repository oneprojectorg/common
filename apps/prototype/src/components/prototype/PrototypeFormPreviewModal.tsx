'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';

import { type PrototypePhase, type PrototypeProcess, phaseCopy } from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Where the participant's view of the form will go. Deliberately empty: a
 * hand-built mock of the real form would be a second implementation to keep in
 * step with the first, and the thing worth reviewing right now is that the way
 * in exists and lands here.
 */
export function PrototypeFormPreviewModal({
  isOpen,
  onOpenChange,
  process,
  phase,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  process: PrototypeProcess;
  phase: PrototypePhase;
}) {
  const what = phaseCopy(process, phase.phaseType).bodyTitle.toLowerCase();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 items-center justify-center px-6 py-16">
          <DialogDescription className="text-center text-base">
            A preview of the {what} would be here.
          </DialogDescription>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
