'use client';

import { useMaybeUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@op/sense/Dialog';
import { Header3 } from '@op/sense/Header';
import { toast } from '@op/sense/Toast';
import { type ReactNode, useRef, useState } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CommunityCommitmentsContent } from '@/components/CommunityCommitmentsContent';
import { PrivacyPolicyContent } from '@/components/PrivacyPolicyContent';
import { ToSContent } from '@/components/ToSContent';

import { shouldReacceptPolicies } from './eligibility';

type PolicyDocument = 'terms' | 'privacy' | 'conduct';

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

const PolicyReacceptanceModalContent = () => {
  const t = useTranslations();
  const utils = trpc.useUtils();
  const reaccept = trpc.account.completeOnboarding.useMutation();
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAgree = async () => {
    setIsSubmitting(true);
    try {
      // Reuse completeOnboarding: it stamps onboardedAt to now and records
      // tos/privacy acceptance, which moves the user past the re-acceptance
      // cutoff so this gate stops showing. Invalidating getMyAccount refetches
      // the account that drives eligibility, closing the modal.
      await reaccept.mutateAsync({ tos: true, privacy: true });
      await utils.account.getMyAccount.invalidate();
    } catch {
      setIsSubmitting(false);
      toast.error(t("That didn't work"), {
        description: t('Please try submitting the form again.'),
      });
    }
  };

  return (
    // Controlled `open` with no `onOpenChange`: Escape and the backdrop have
    // nowhere to write, so the gate can't be dismissed.
    <Dialog open disablePointerDismissal>
      {/* Column, not the default grid, so the body scrolls rather than the
          whole card. */}
      <DialogContent
        showCloseButton={false}
        className="flex flex-col overflow-hidden p-0 sm:max-w-lg"
      >
        <PolicyReacceptanceMain
          agreed={agreed}
          onAgreedChange={setAgreed}
          onAgree={handleAgree}
          isSubmitting={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};

const PolicyReacceptanceMain = ({
  agreed,
  onAgreedChange,
  onAgree,
  isSubmitting,
}: {
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
  onAgree: () => void;
  isSubmitting: boolean;
}) => {
  const t = useTranslations();

  return (
    <>
      {/* No divider, no room reserved for a close button, and centred: the
          slot's chrome is for a titled dialog with an X, which this isn't. */}
      <DialogHeader className="shrink-0 border-b-0 px-8 pe-8 pt-8 pb-0 text-center sm:px-10 sm:pt-10">
        <DialogTitle className="text-headline">
          {t("We've updated our policies.")}
        </DialogTitle>
        {/* Not muted: this line is content, not a subtitle. */}
        <DialogDescription className="text-foreground">
          {t('Review the changes and accept to keep using Common.')}
        </DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-8 py-6 sm:px-10">
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-4">
          <Header3>{t("What's changed")}</Header3>
          <p>
            {t(
              'Common now works with a third-party service that automatically reviews content posted on the platform to keep the community safe and uphold our Code of Conduct. Our Terms of Use and Privacy Policy now explain how this works and what it means for your data.',
            )}
          </p>
        </div>

        <div className="flex items-start gap-2">
          <Checkbox
            aria-labelledby="policy-consent-label"
            checked={agreed}
            onCheckedChange={onAgreedChange}
          />
          <span id="policy-consent-label" className="-mt-1 text-base">
            {t.rich(
              'I have read and agree to the <terms>Terms of Use</terms>, <privacy>Privacy Policy</privacy>, and <conduct>Code of Conduct</conduct>.',
              {
                terms: (chunks: ReactNode) => (
                  <PolicyDocumentDialog document="terms" trigger={chunks} />
                ),
                privacy: (chunks: ReactNode) => (
                  <PolicyDocumentDialog document="privacy" trigger={chunks} />
                ),
                conduct: (chunks: ReactNode) => (
                  <PolicyDocumentDialog document="conduct" trigger={chunks} />
                ),
              },
            )}
          </span>
        </div>
      </div>

      {/* Untinted and undivided, and the button keeps its own full width rather
          than being pushed to the inline end. */}
      <DialogFooter className="shrink-0 border-t-0 bg-transparent px-8 pt-0 pb-8 sm:flex-col sm:px-10 sm:pb-10">
        <Button
          className="w-full"
          disabled={!agreed}
          loading={isSubmitting}
          onClick={onAgree}
        >
          {t('Agree and continue')}
        </Button>
      </DialogFooter>
    </>
  );
};

const documentContent: Record<PolicyDocument, () => ReactNode> = {
  terms: ToSContent,
  privacy: PrivacyPolicyContent,
  conduct: CommunityCommitmentsContent,
};

/**
 * A policy document, in its own dialog nested over the gate.
 *
 * Nested rather than swapping the gate's content, so base-ui owns the focus:
 * opening scopes focus into the document and closing returns it to the link
 * that opened it. Swapping unmounted that link mid-press, dropping focus to the
 * body with nothing announced.
 *
 * The trigger sits next to (not inside) the consent Checkbox's label, so
 * pressing a link never toggles it.
 */
const PolicyDocumentDialog = ({
  document,
  trigger,
}: {
  document: PolicyDocument;
  trigger: ReactNode;
}) => {
  const t = useTranslations();
  const documentTitle: Record<PolicyDocument, string> = {
    terms: t('Terms of Use'),
    privacy: t('Privacy Policy'),
    conduct: t('Code of Conduct'),
  };
  const Content = documentContent[document];
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            variant="link"
            size="inline"
            className="underline hover:no-underline"
          >
            {trigger}
          </Button>
        }
      />
      {/* Focus the body, not the first link buried in the legal text — base-ui
          would otherwise scroll the document to wherever that link sits. */}
      <DialogContent
        showCloseButton={false}
        initialFocus={scrollRef}
        className="flex flex-col overflow-hidden p-0 sm:max-w-[36rem]"
      >
        <DialogHeader className="relative min-h-16 shrink-0 flex-row items-center px-4 py-0 pe-4">
          {/* Back rather than a close X: this reads as a drill-down from the
              gate, and it's the nested dialog's DialogClose either way. */}
          <DialogClose
            render={
              <Button variant="ghost" size="icon" aria-label={t('Back')} />
            }
          >
            <LuArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
          </DialogClose>
          {/* Centred on the header, not on the Back button beside it, so
              `relative` above is load-bearing. */}
          <DialogTitle className="pointer-events-none absolute inset-x-0 text-center">
            {documentTitle[document]}
          </DialogTitle>
        </DialogHeader>
        <div
          ref={scrollRef}
          tabIndex={-1}
          className="min-h-0 flex-1 overflow-y-auto px-6 py-4 outline-none"
        >
          <Content />
        </div>
      </DialogContent>
    </Dialog>
  );
};
