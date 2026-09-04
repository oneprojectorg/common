'use client';

import { Button } from '@op/sense/Button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { RichTextViewer } from '@op/sense/RichTextEditor';
import { viewerProseStyles } from '@op/sense/RichTextEditor/viewerStyles';
import { Spinner } from '@op/sense/Spinner';
import he from 'he';
import { useParams } from 'next/navigation';

import { useTranslations } from '@/lib/i18n';

import { getViewerExtensions } from '../RichTextEditor/editorConfig';
import { useCreateProposal } from './useCreateProposal';

export const DecisionActionBar = ({
  instanceId,
  description,
  label,
  markup = false,
  showSubmitButton = false,
}: {
  instanceId: string;
  description?: string;
  label?: string;
  markup?: boolean;
  showSubmitButton?: boolean;
}) => {
  const t = useTranslations();
  const { slug } = useParams<{ slug: string }>();

  const {
    createProposal: handleCreateProposal,
    isCreating,
    isReady,
  } = useCreateProposal({
    instanceId,
    navigateTo: (proposal) =>
      `/decisions/${slug}/proposal/${proposal.profileId}/edit`,
    canSubmitProposal: showSubmitButton,
  });

  return (
    <div className="flex w-full justify-center">
      <div className="flex w-full max-w-48 flex-col items-center justify-center gap-4 sm:flex-row">
        {description ? (
          <Dialog>
            <DialogTrigger
              render={
                <Button variant="outline" className="w-full">
                  {label ?? t('Learn more')}
                </Button>
              }
            />

            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{label ?? t('About the process')}</DialogTitle>
              </DialogHeader>
              <div className="max-h-[70vh] overflow-y-auto px-6 py-4">
                {markup && description ? (
                  <div
                    dir="auto"
                    className={viewerProseStyles}
                    dangerouslySetInnerHTML={{
                      __html: he.decode(description),
                    }}
                  />
                ) : (
                  <RichTextViewer
                    extensions={getViewerExtensions()}
                    content={description}
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        ) : null}

        {showSubmitButton && (
          <Button
            className="w-full"
            disabled={!isReady || isCreating}
            onClick={handleCreateProposal}
          >
            {isCreating ? <Spinner /> : null}
            {t('Start a proposal')}
          </Button>
        )}
      </div>
    </div>
  );
};
