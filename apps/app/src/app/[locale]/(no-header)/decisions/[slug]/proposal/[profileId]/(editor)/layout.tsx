'use client';

import { useFeatureFlag } from '@/hooks/useFeatureFlag';
import { trpc } from '@op/api/client';
import { useMediaQuery } from '@op/hooks';
import { screens } from '@op/styles/constants';
import { notFound, useParams, usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';

import ErrorBoundary from '@/components/ErrorBoundary';
import { DocumentNotAvailable } from '@/components/decisions/DocumentNotAvailable';
import { ProposalEditor } from '@/components/decisions/proposalEditor';

/**
 * Shared layout for /edit and /version routes.
 *
 * Persists across navigations between child routes so the collaborative
 * editor, Yjs connection, and draft state are never remounted.
 * Reads `usePathname()` to decide whether the version history sidebar
 * should be shown.
 *
 * The `children` prop (child page content) is intentionally unused —
 * the child pages are empty stubs that exist only to define the URL.
 */
export default function ProposalEditorLayout({
  children: _children,
  aside,
}: {
  children: ReactNode;
  aside: ReactNode;
}) {
  return (
    <ErrorBoundary fallback={<DocumentNotAvailable />}>
      <ProposalEditorLayoutContent aside={aside} />
    </ErrorBoundary>
  );
}

function ProposalEditorLayoutContent({ aside }: { aside: ReactNode }) {
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useMediaQuery(`(max-width: ${screens.sm})`) ?? false;

  const isVersionRoute = pathname.endsWith('/version');
  const isVersionHistoryEnabled = useFeatureFlag('proposal_version_history');

  // -- Data fetching ---------------------------------------------------------

  const [decisionProfile] = trpc.decision.getDecisionBySlug.useSuspenseQuery({
    slug,
  });

  if (!decisionProfile?.processInstance) {
    notFound();
  }

  const instanceId = decisionProfile.processInstance.id;

  const [[proposal, instance]] = trpc.useSuspenseQueries((t) => [
    t.decision.getProposal({ profileId }),
    t.decision.getInstance({ instanceId }),
  ]);

  if (!proposal || !instance) {
    notFound();
  }

  // -- Version history navigation --------------------------------------------

  const baseHref = `/decisions/${slug}/proposal/${profileId}`;

  useEffect(() => {
    if (isVersionRoute && !isVersionHistoryEnabled) {
      router.replace(`${baseHref}/edit`, { scroll: false });
    }
  }, [router, baseHref, isVersionRoute, isVersionHistoryEnabled]);

  // -- Render ----------------------------------------------------------------

  return (
    <ProposalEditor
      instance={instance}
      backHref={`/decisions/${slug}`}
      proposal={proposal}
      headerMode={
        isVersionHistoryEnabled && isVersionRoute && !isMobile
          ? 'version'
          : 'edit'
      }
      isEditMode
      sidebarSlot={aside}
      versionHistoryHref={
        isVersionHistoryEnabled
          ? `${baseHref}${isVersionRoute ? '/edit' : '/version'}`
          : undefined
      }
    />
  );
}
