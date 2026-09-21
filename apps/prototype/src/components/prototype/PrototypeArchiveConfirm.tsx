'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@op/sense/AlertDialog';

import { archiveProcess, type PrototypeProcess } from './store';

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * Confirmation both archive surfaces share. Archiving affects people mid-take
 * and has no undo, so it asks first. From Settings it stacks over that dialog;
 * a terminal two-button alert over a dialog is fine, and an inline confirm
 * read worse.
 */
export function PrototypeArchiveConfirm({
  process,
  isOpen,
  onOpenChange,
  onArchived,
}: {
  process: PrototypeProcess;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the record is archived. Caller reloads, navigates, toasts. */
  onArchived: () => void;
}) {
  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      {/* size="sm": the design-system alert layout — centered header, footer
          split into two half-width buttons (Figma node 21169-26033). */}
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Archive &ldquo;{process.name}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            People may be taking part in it right now. It moves to the Archived
            tab and cannot be unarchived.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              onOpenChange(false);
              archiveProcess(process.id);
              onArchived();
            }}
          >
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
