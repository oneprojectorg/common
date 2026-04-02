 'use client';

import { notFound, useParams } from 'next/navigation';

import { Profile } from '@/components/screens/Profile';

const OrganizationPage = () => {
  const { slug } = useParams<{ slug: string }>();

  if (!slug) {
    notFound();
  }

  return <Profile slug={slug} />;
};

export default OrganizationPage;
