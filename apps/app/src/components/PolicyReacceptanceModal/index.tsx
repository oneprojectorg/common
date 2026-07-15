'use client';

import { useMaybeUser } from '@/utils/UserProvider';
import { shouldReacceptPolicies } from '@/utils/policyReacceptance';
import { trpc } from '@op/api/client';
import { Button } from '@op/ui/Button';
import { Checkbox } from '@op/ui/Checkbox';
import { Header1 } from '@op/ui/Header';
import { Modal, ModalBody } from '@op/ui/Modal';
import { toast } from '@op/ui/Toast';
import { type ReactNode, useState } from 'react';
import { LuArrowLeft } from 'react-icons/lu';

import { useTranslations } from '@/lib/i18n';

import { CommunityCommitmentsContent } from '@/components/CommunityCommitmentsContent';
import { PrivacyPolicyContent } from '@/components/PrivacyPolicyContent';
import { ToSContent } from '@/components/ToSContent';

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
      toast.error({
        title: t("That didn't work"),
        message: t('Please try submitting the form again.'),
      });
    }
  };

  return (
    <Modal
      isOpen
      isDismissable={false}
      isKeyboardDismissDisabled
      className="h-screen max-h-none w-screen max-w-none overflow-y-auto sm:h-auto sm:max-h-[80vh] sm:w-[34rem] sm:max-w-[34rem]"
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
    </Modal>
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
    <ModalBody className="gap-6 p-8 sm:px-10 sm:py-10">
      <div className="flex flex-col gap-2 text-center">
        <Header1>{t("We've updated our policies.")}</Header1>
        <p className="text-base text-neutral-charcoal">
          {t('Review the changes and accept to keep using Common.')}
        </p>
      </div>

      <section className="flex flex-col gap-2 rounded-xl border border-neutral-gray1 bg-neutral-offWhite p-4">
        <span className="font-serif text-title-sm text-neutral-charcoal">
          {t("What's changed")}
        </span>
        <p className="text-base text-neutral-charcoal">
          {t(
            'Common now works with a third-party service that automatically reviews content posted on the platform to keep the community safe and uphold our Code of Conduct. Our Terms of Use and Privacy Policy now explain how this works and what it means for your data.',
          )}
        </p>
      </section>

      <div className="flex flex-col gap-4">
        <Checkbox size="small" isSelected={agreed} onChange={onAgreedChange}>
          <span className="text-sm">
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
        </Checkbox>

        <Button
          className="w-full"
          isDisabled={!agreed}
          isLoading={isSubmitting}
          onPress={onAgree}
        >
          {t('Agree and continue')}
        </Button>
      </div>
    </ModalBody>
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
      <div className="sticky top-0 z-30 flex min-h-16 items-center border-b bg-white px-4">
        <button
          type="button"
          onClick={onBack}
          className="flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 text-neutral-charcoal outline-hidden hover:bg-neutral-gray1 focus-visible:ring-2 focus-visible:ring-primary-teal"
        >
          <LuArrowLeft className="size-5" aria-hidden />
          {t('Back')}
        </button>
        <span className="pointer-events-none absolute inset-x-0 text-center font-serif text-title-sm">
          {documentTitle[document]}
        </span>
      </div>
      <ModalBody>
        <Content />
      </ModalBody>
    </>
  );
};

// Opens a policy document inside the modal without toggling the consent checkbox
// it sits inside (stop the press from reaching the surrounding React Aria
// Checkbox).
const PolicyLink = ({
  onOpen,
  children,
}: {
  onOpen: () => void;
  children: ReactNode;
}) => (
  <button
    type="button"
    className="cursor-pointer text-primary-teal underline"
    onClick={(e) => {
      e.stopPropagation();
      onOpen();
    }}
    onPointerDown={(e) => e.stopPropagation()}
  >
    {children}
  </button>
);
