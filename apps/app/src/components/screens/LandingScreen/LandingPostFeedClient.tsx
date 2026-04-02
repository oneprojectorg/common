'use client';

import { HydrationBoundary } from '@tanstack/react-query';
import { Surface } from '@op/ui/Surface';

import ErrorBoundary from '@/components/ErrorBoundary';
import { PostUpdate } from '@/components/PostUpdate';
import { TranslatedText } from '@/components/TranslatedText';

import { Feed } from './Feed';

export const LandingPostFeedClient = ({
  showPostUpdate,
  state,
}: {
  showPostUpdate: boolean;
  state: unknown;
}) => {
  return (
    <>
      {showPostUpdate ? (
        <>
          <Surface className="mb-8 border-0 p-0 pt-5 sm:mb-4 sm:border sm:p-4">
            <PostUpdate label={<TranslatedText text="Post" />} />
          </Surface>
          <hr />
        </>
      ) : null}
      <div className="mt-4 sm:mt-0">
        <ErrorBoundary
          fallback={
            <div className="flex flex-col items-center justify-center py-8">
              <span className="text-neutral-charcoal">
                <TranslatedText text="Unable to load posts. Please try refreshing." />
              </span>
            </div>
          }
        >
          <HydrationBoundary state={state}>
            <Feed />
          </HydrationBoundary>
        </ErrorBoundary>
      </div>
    </>
  );
};
