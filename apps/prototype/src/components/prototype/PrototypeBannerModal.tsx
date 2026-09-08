'use client';

import { BannerImageField } from '@op/sense/BannerImageField';
import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { useEffect, useState } from 'react';

import type { PrototypeProcess } from './store';

/** A banner much bigger than this fills the storage the whole prototype runs on. */
const MAX_BANNER_BYTES = 5_000_000;

/**
 * PROTOTYPE ONLY — delete with the rest of `components/prototype`.
 *
 * The banner, on its own. Split out of `Settings` because it is the one setting
 * you judge by looking at the page rather than by reading a field: the way in
 * sits on the hero it changes, so the thing being decided is on screen behind
 * the dialog deciding it.
 *
 * The field itself is `BannerImageField` — the product's own, empty state and
 * filled state included — rather than a pair of buttons that only resemble it.
 */
export function PrototypeBannerModal({
  isOpen,
  onOpenChange,
  process,
  onChange,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  process: PrototypeProcess;
  onChange: (patch: (current: PrototypeProcess) => PrototypeProcess) => void;
}) {
  const [fileName, setFileName] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  /* Written straight through, so the hero behind the dialog shows the image as
     soon as it is picked — which is the only way to judge one. `Done` closes;
     removing is what undoes it. */
  const setBanner = (banner: string | undefined) =>
    onChange((current) => ({ ...current, banner }));

  useEffect(() => {
    if (isOpen) {
      setError(null);
    }
  }, [isOpen]);

  const read = (file: File) => {
    if (file.size > MAX_BANNER_BYTES) {
      setError('That image is too large — pick one under 5 MB.');

      return;
    }

    const reader = new FileReader();

    // A data URL rather than an object URL: this has to survive a reload, and
    // local storage is all there is to survive in.
    reader.onload = () => {
      setError(null);
      setFileName(file.name);
      setBanner(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="border-b">
          <DialogTitle>Edit banner</DialogTitle>
        </DialogHeader>

        <div className="p-6">
          <BannerImageField
            value={process.banner}
            fileName={fileName}
            error={error}
            copy={{
              label: 'Banner image',
              title: 'Upload banner image',
              description:
                'PNG, JPG, WebP or GIF · recommended 2400×800px · max 5MB',
              helperText:
                'The headline appears centered over a dark overlay. Avoid images with key subjects in the middle.',
              chooseFile: 'Choose file',
              remove: 'Remove the banner',
            }}
            onSelectFile={read}
            onRemove={() => {
              setFileName(undefined);
              setBanner(undefined);
            }}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
