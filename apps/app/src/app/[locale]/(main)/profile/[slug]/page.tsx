 'use client';

import { notFound, useParams, useSearchParams } from 'next/navigation';

import { Profile } from '@/components/screens/Profile';

const ProfilePage = () => {
  const { slug } = useParams<{ slug: string }>();
  const searchParams = useSearchParams();

  if (!slug) {
    notFound();
  }

  return <Profile slug={slug} initialTab={searchParams.get('tab') ?? undefined} />;
};

export default ProfilePage;
