'use client';

import { useUser } from '@/utils/UserProvider';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import { Dialog, DialogContent } from '@op/sense/Dialog';
import { Field, FieldLabel } from '@op/sense/Field';
import { Header2 } from '@op/sense/Header';
import { CheckIcon } from '@op/sense/icons';
import { useQueryState } from 'nuqs';
import { type ReactNode, useState } from 'react';
import { LuUserRoundMinus, LuUserRoundPlus } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

/**
 * Promote an anonymous visitor to a full account. Shown when `?promote=1` is on
 * the URL (set by ProposalEditor after an anon visitor submits their idea).
 *
 * "Create account" / "Log in" route to `/login?link=1`, which *links* an email
 * identity onto the anon user (keeping their idea) rather than creating a new
 * account. See LinkAccountPanel.
 */

export const PromoteAccountModal = () => {
  const { user } = useUser();
  const [promote, setPromote] = useQueryState('promote');
  // The just-submitted proposal's profileId, so we can return the visitor to
  // their own idea (the proposal view) after they finish creating an account.
  const [proposalId] = useQueryState('proposal');

  // Only anonymous sign-ins can be promoted; a full account has nothing to
  // upgrade. (`isAnonymous` is session-derived, same as onboarding.ts.)
  const isAnonymous = Boolean(user?.isAnonymous);
  const isOpen = isAnonymous && promote === '1';

  const close = () => {
    void setPromote(null);
  };

  return (
    <Dialog open={isOpen}>
      <DialogContent
        showCloseButton={false}
        className="justify-center sm:max-w-lg"
      >
        <PromoteAccountModalContent
          onContinueAsGuest={close}
          proposalId={proposalId}
        />
      </DialogContent>
    </Dialog>
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

  // Login in link mode, returning to the proposal once linked (falls back to the
  // decision page).
  //
  // TODO(anon-upgrade): "Create account" and "Log in" share this link-mode entry.
  // An existing full account can't be linked, so that user hits the raw Supabase
  // collision error in LinkAccountPanel — route "Log in" to /login and handle the
  // abandoned anon draft.
  const goToLogin = () => {
    // Proposal routes hang off /decisions/[slug], not the /current tab.
    const base = window.location.pathname
      .replace(/\/+$/, '')
      .replace(/\/current$/, '');
    const redirect = proposalId ? `${base}/proposal/${proposalId}` : base;
    window.location.assign(
      `/login?link=1&redirect=${encodeURIComponent(redirect)}`,
    );
  };

  return (
    <div className="flex flex-col gap-6 p-8 sm:px-12 sm:pt-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <CheckIcon />
        <div className="flex flex-col gap-2">
          <Header2>{t('Your idea was submitted.')}</Header2>
          <p className="text-base">{t('Want to follow what happens next?')}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-white p-4 text-start">
          <div className="flex items-center gap-1">
            <LuUserRoundMinus className="size-4 text-foreground" aria-hidden />
            <span className="font-serif text-label">
              {t('Continue as a guest')}
            </span>
          </div>
          <p className="text-base">
            {t('Stay anonymous. React to comments with emoji.')}
          </p>
          {/* TODO(anon-upgrade): this checkbox only gates the button; ToS/privacy
              acceptance isn't persisted for the anon account. Pending team
              decision on what accepting terms means for an anonymous user. */}
          <Field orientation="horizontal">
            <Checkbox
              id="promote-tos"
              checked={agreed}
              onCheckedChange={setAgreed}
            />
            <FieldLabel htmlFor="promote-tos">
              <span className="text-sm">
                {t.rich(
                  'I agree to the <tos>Terms of Service</tos> and <privacy>Privacy Policy</privacy>.',
                  {
                    tos: (chunks: ReactNode) => (
                      <PolicyLink href="/info/tos">{chunks}</PolicyLink>
                    ),
                    privacy: (chunks: ReactNode) => (
                      <PolicyLink href="/info/privacy">{chunks}</PolicyLink>
                    ),
                  },
                )}
              </span>
            </FieldLabel>
          </Field>
          <Button
            variant="outline"
            className="w-full"
            disabled={!agreed}
            onClick={onContinueAsGuest}
          >
            {t('Continue as guest')}
          </Button>
        </section>

        <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-muted p-4 text-start">
          <div className="flex items-center gap-1">
            <LuUserRoundPlus className="size-4 text-foreground" aria-hidden />
            <span className="font-serif text-label">
              {t('With an account')}
            </span>
          </div>
          <p className="text-base">
            {t(
              'Edit your idea before review begins, get notified when it moves to the next phase, and like, comment, and follow other ideas.',
            )}
          </p>
          <Button className="w-full" onClick={goToLogin}>
            {t('Create account')}
          </Button>
        </section>
      </div>

      {/* TODO(anon-upgrade): restore "Already have an account? Log in" once we
          support linking an email that already belongs to a full account. */}
    </div>
  );
};

// Opens a policy page in a new tab without toggling the consent checkbox it
// sits inside (stop the click from reaching the surrounding Checkbox).
const PolicyLink = ({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="text-primary underline"
    onClick={(e) => e.stopPropagation()}
    onPointerDown={(e) => e.stopPropagation()}
  >
    {children}
  </a>
);
