'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
// viewerStyles subpath, not the @op/sense/RichTextEditor barrel: the barrel
// re-exports a hook (useEffect) and importing it from a server-rendered tree
// breaks the RSC build.
import { viewerProseStyles } from '@op/sense/RichTextEditor/viewerStyles';
import he from 'he';

import { useTranslations } from '@/lib/i18n';

interface ProposalInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
}

export function ProposalInfoModal({
  isOpen,
  onClose,
  title,
  content,
}: ProposalInfoModalProps) {
  const t = useTranslations();

  // This is a hack for people powered needing translated content before we support it in user-generated content
  const translatedContent = !!content.match('INFOTRANSLATION');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="grid-rows-[auto_minmax(0,1fr)_auto] overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            <bdi>{title}</bdi>
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto px-6 py-4">
          <div
            dir="auto"
            className={viewerProseStyles}
            dangerouslySetInnerHTML={{
              __html: translatedContent
                ? he.decode(t('INFOTRANSLATION'))
                : content,
            }}
          />
        </div>

        <DialogFooter>
          <Button onClick={onClose}>{t('OK')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
