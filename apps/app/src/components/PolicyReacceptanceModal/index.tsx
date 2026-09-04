'use client';

import { useMaybeUser } from '@/utils/UserProvider';
import dynamic from 'next/dynamic';

import { shouldReacceptPolicies } from './eligibility';

// Loaded only for the users the gate actually shows to. The body pulls in the
// full Terms of Use, Privacy Policy, and Code of Conduct, and this component
// mounts in both authed layouts — statically importing it put all three
// documents in the first-paint bundle of every authed page.
const PolicyReacceptanceModalContent = dynamic(
  () =>
    import('./PolicyReacceptanceModalContent').then(
      (module) => module.PolicyReacceptanceModalContent,
    ),
  { ssr: false },
);

/**
 * App-wide gate shown to already-onboarded users when the Terms of Use, Privacy
 * Policy, and Code of Conduct are updated. It is non-dismissable: eligible users
 * must re-accept before continuing. Mounted inside each authed layout's
 * `UserProvider`; `useMaybeUser` returns undefined for public visitors so the
 * gate is inert there.
 */
export const PolicyReacceptanceModal = () => {
  const user = useMaybeUser();

  if (!shouldReacceptPolicies(user)) {
    return null;
  }

  return <PolicyReacceptanceModalContent />;
};
