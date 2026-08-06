'use client';

import { useMaybeUser } from '@/utils/UserProvider';
import { trpc } from '@op/api/client';
import { Button } from '@op/sense/Button';
import { Checkbox } from '@op/sense/Checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@op/sense/Dialog';
import { toast } from '@op/sense/Toast';
import { type ReactNode, useState } from 'react';
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
  const [activeDocument, setActiveDocument] = useState<PolicyDocument | null>(
    null,
  );
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
      {/* Column, not the default grid, so each view can put the scroll on its
          own body instead of on the whole card. */}
      <DialogContent
        showCloseButton={false}
        className="flex flex-col overflow-hidden p-0 sm:max-w-[36rem]"
      >
        {activeDocument ? (
          <PolicyDocumentView
            document={activeDocument}
            onBack={() => setActiveDocument(null)}
          />
        ) : (
          <PolicyReacceptanceMain
            agreed={agreed}
            onAgreedChange={setAgreed}
            onOpenDocument={setActiveDocument}
            onAgree={handleAgree}
            isSubmitting={isSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

const PolicyReacceptanceMain = ({
  agreed,
  onAgreedChange,
  onOpenDocument,
  onAgree,
  isSubmitting,
}: {
  agreed: boolean;
  onAgreedChange: (value: boolean) => void;
  onOpenDocument: (document: PolicyDocument) => void;
  onAgree: () => void;
  isSubmitting: boolean;
}) => {
  const t = useTranslations();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-8 sm:px-10 sm:py-10">
      <div className="flex flex-col gap-2 text-center">
        <DialogTitle className="text-headline">
          {t("We've updated our policies.")}
        </DialogTitle>
        <p>{t('Review the changes and accept to keep using Common.')}</p>
      </div>

      <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-4">
        <span className="font-serif text-title">{t("What's changed")}</span>
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
                <PolicyLink onOpen={() => onOpenDocument('terms')}>
                  {chunks}
                </PolicyLink>
              ),
              privacy: (chunks: ReactNode) => (
                <PolicyLink onOpen={() => onOpenDocument('privacy')}>
                  {chunks}
                </PolicyLink>
              ),
              conduct: (chunks: ReactNode) => (
                <PolicyLink onOpen={() => onOpenDocument('conduct')}>
                  {chunks}
                </PolicyLink>
              ),
            },
          )}
        </span>
      </div>

      <Button
        className="w-full"
        disabled={!agreed}
        loading={isSubmitting}
        onClick={onAgree}
      >
        {t('Agree and continue')}
      </Button>
    </div>
  );
};

const documentContent: Record<PolicyDocument, () => ReactNode> = {
  terms: ToSContent,
  privacy: PrivacyPolicyContent,
  conduct: CommunityCommitmentsContent,
};

const PolicyDocumentView = ({
  document,
  onBack,
}: {
  document: PolicyDocument;
  onBack: () => void;
}) => {
  const t = useTranslations();
  const documentTitle: Record<PolicyDocument, string> = {
    terms: t('Terms of Use'),
    privacy: t('Privacy Policy'),
    conduct: t('Code of Conduct'),
  };
  const Content = documentContent[document];

  return (
    <>
      <DialogHeader className="relative min-h-16 shrink-0 flex-row items-center px-4 py-0 pe-4">
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('Back')}
          onClick={onBack}
        >
          <LuArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden />
        </Button>
        {/* Centred on the header, not on the Back button beside it, so `relative`
            above is load-bearing. */}
        <DialogTitle className="pointer-events-none absolute inset-x-0 text-center">
          {documentTitle[document]}
        </DialogTitle>
      </DialogHeader>
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <Content />
      </div>
    </>
  );
};

// Sits next to (not inside) the consent Checkbox's label, so pressing a link
// never toggles it.
const PolicyLink = ({
  onOpen,
  children,
}: {
  onOpen: () => void;
  children: ReactNode;
}) => (
  <Button variant="link" size="inline" onClick={onOpen}>
    {children}
  </Button>
);
