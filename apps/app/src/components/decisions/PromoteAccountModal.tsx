'use client';

import { useUser } from '@/utils/UserProvider';
import { Button } from '@op/ui/Button';
import { CheckIcon } from '@op/ui/CheckIcon';
import { Checkbox } from '@op/ui/Checkbox';
import { Header1 } from '@op/ui/Header';
import { Modal } from '@op/ui/Modal';
import { useQueryState } from 'nuqs';
import { useState } from 'react';
import { LuUser, LuUserPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * Promote an anonymous visitor to a full account.
 *
 * Shown when `?promote=1` is on the URL, which ProposalEditor sets after an
 * anonymous visitor submits their idea.
 *
 * "Create account" / "Log in" send the visitor to the real login page in
 * link mode (`/login?link=1`), which reuses our existing auth methods (Google,
 * email OTP) but *links* the chosen identity onto the current anonymous user
 * instead of creating a separate account — so the idea they just submitted
 * stays theirs (https://supabase.com/docs/guides/auth/auth-anonymous).
 * See LinkAccountPanel for the linking logic.
 */

export const PromoteAccountModal = () => {
  const { user } = useUser();
  const [promote, setPromote] = useQueryState('promote');
  // The just-submitted proposal's profileId, so we can return the visitor to
  // their own idea (the proposal view) after they finish creating an account.
  const [proposalId] = useQueryState('proposal');

  // Only anonymous sign-ins can be promoted — a full account has nothing to
  // upgrade, and a no-session visitor has no anon identity to attach an email
  // to yet. (`isAnonymous` is the session-derived flag, same as onboarding.ts.)
  const isAnonymous = Boolean(user?.isAnonymous);
  const isOpen = isAnonymous && promote === '1';

  const close = () => {
    void setPromote(null);
  };

  return (
    <Modal isOpen={isOpen} onOpenChange={(open) => (open ? null : close())}>
      <PromoteAccountModalContent
        onContinueAsGuest={close}
        proposalId={proposalId}
      />
    </Modal>
  );
};

const PromoteAccountModalContent = ({
  onContinueAsGuest,
  proposalId,
}: {
  onContinueAsGuest: () => void;
  proposalId: string | null;
}) => {
  const t = useTranslations();
  const [agreed, setAgreed] = useState(false);

  // Send them to the login page in link mode, returning to their idea once
  // linked. The current path is the decision; appending /proposal/<id> targets
  // the proposal view they just created (falls back to the decision page).
  //
  // TODO(anon-upgrade): "Create account" and "Already have an account? Log in"
  // intentionally share this link-mode entry for now. Link mode can't attach an
  // email/identity that already belongs to a full account, so an existing-account
  // user routed here will hit the (raw) Supabase collision error in
  // LinkAccountPanel. Productionize by routing "Log in" to normal /login and
  // deciding what happens to the abandoned anonymous draft.
  const goToLogin = () => {
    const base = window.location.pathname;
    const redirect = proposalId ? `${base}/proposal/${proposalId}` : base;
    window.location.assign(
      `/login?link=1&redirect=${encodeURIComponent(redirect)}`,
    );
  };

  return (
    <div className="flex flex-col gap-6 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <CheckIcon />
        <Header1 className="sm:text-title-base">
          {t('Your idea was submitted.')}
        </Header1>
        <p className="text-neutral-gray4">
          {t('Want to follow what happens next?')}
        </p>
      </div>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <LuUser className="size-5 text-neutral-charcoal" aria-hidden />
          <span className="font-medium">{t('Continue as a guest')}</span>
        </div>
        <p className="text-sm text-neutral-gray4">
          {t('Stay anonymous. React to comments with emoji.')}
        </p>
        {/* TODO(anon-upgrade): accepting this only gates the button — it does not
            persist ToS/privacy acceptance for the anonymous account anywhere.
            Either record it for the anon user or drop the checkbox on the guest
            path. */}
        <Checkbox isSelected={agreed} onChange={setAgreed}>
          <span className="text-sm">
            {t('I agree to the Terms of Service and Privacy Policy')}
          </span>
        </Checkbox>
        <Button
          color="secondary"
          className="w-full"
          isDisabled={!agreed}
          onPress={onContinueAsGuest}
        >
          {t('Continue as guest')}
        </Button>
      </section>

      <section className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex items-center gap-2">
          <LuUserPlus className="size-5 text-neutral-charcoal" aria-hidden />
          <span className="font-medium">{t('With an account')}</span>
        </div>
        <p className="text-sm text-neutral-gray4">
          {t(
            'Edit your idea before review begins, get notified when it moves to the next phase, and like, comment, and follow other ideas.',
          )}
        </p>
        <Button className="w-full" onPress={goToLogin}>
          {t('Create account')}
        </Button>
      </section>

      <p className="text-center text-sm text-neutral-gray4">
        {t('Already have an account?')}{' '}
        <button
          type="button"
          onClick={goToLogin}
          className="text-primary-teal underline"
        >
          {t('Log in')}
        </button>
      </p>
    </div>
  );
};
