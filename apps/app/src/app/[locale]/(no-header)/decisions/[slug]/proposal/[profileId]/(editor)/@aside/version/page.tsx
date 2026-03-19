'use client';

import { useParams, useRouter } from 'next/navigation';

import { ProposalEditorAside } from '@/components/decisions/ProposalEditorAside';

export default function VersionAsidePage() {
  const { profileId, slug } = useParams<{
    profileId: string;
    slug: string;
  }>();
  const router = useRouter();

  return (
    <ProposalEditorAside
      title="Version history"
      onClose={() =>
        router.replace(`/decisions/${slug}/proposal/${profileId}/edit`, {
          scroll: false,
        })
      }
      bodyClassName="pt-4"
    >
      <div className="mx-4 rounded bg-primary-tealWhite p-2">
        <p className="text-base text-neutral-black">Current version</p>
        <p className="text-base text-neutral-charcoal">Latest</p>
      </div>
    </ProposalEditorAside>
  );
}
