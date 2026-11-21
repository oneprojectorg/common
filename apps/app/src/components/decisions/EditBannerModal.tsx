'use client';

import { Button } from '@op/sense/Button';
import { cn } from '@op/sense/lib/utils';
import { useState } from 'react';
import { LuImage } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { BannerUploadModal } from './BannerUploadModal';

interface EditBannerModalProps {
  instanceId: string;
  /** Stored storage path of the current hero image, if any. */
  heroImagePath?: string;
  /** Defaults to "Edit banner". */
  label?: string;
  size?: 'default' | 'sm';
  /** Runs after the banner is saved or removed; without it the page reloads. */
  onChange?: () => void;
  className?: string;
}

/**
 * The banner control in the hero's top end corner. Desktop only by default: on
 * the public overview the admin bar and bottom sheet (AdminOverviewBar) take
 * over on mobile.
 */
export function EditBannerModal({
  instanceId,
  heroImagePath,
  label,
  size,
  onChange,
  className,
}: EditBannerModalProps) {
  const t = useTranslations('decisions.processBuilder');
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size={size}
        className={cn('absolute end-4 top-4 z-10 hidden md:flex', className)}
        onClick={() => setIsOpen(true)}
      >
        <LuImage className="size-4" aria-hidden="true" />
        {label ?? t('editBannerTitle')}
      </Button>
      <BannerUploadModal
        instanceId={instanceId}
        heroImagePath={heroImagePath}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        onChange={onChange}
      />
    </>
  );
}
