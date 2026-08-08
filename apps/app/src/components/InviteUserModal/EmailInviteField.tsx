'use client';

import { useRequiredUser } from '@/utils/UserProvider';
import { Field, FieldDescription, FieldLabel } from '@op/sense/Field';
import { InputGroup, InputGroupTextarea } from '@op/sense/InputGroup';
import { Tag, TagGroup } from '@op/sense/TagGroup';
import { toast } from '@op/sense/Toast';
import type { KeyboardEvent, ReactNode } from 'react';
import { useId } from 'react';

import { useTranslations } from '@/lib/i18n';

import { parseEmails, shouldParseEmails } from './emailUtils';

const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

interface EmailInviteFieldProps {
  /** Raw text still in the box — everything not yet accepted as a chip. */
  emails: string;
  setEmails: (emails: string) => void;
  /** Accepted addresses, shown as removable chips. */
  emailBadges: string[];
  setEmailBadges: (badges: string[]) => void;
  /** Domain used in the empty-state placeholder when the org has none. */
  fallbackDomain: string;
  /** Optional helper text under the box. */
  description?: ReactNode;
}

/**
 * The "Send to" chips input shared by both invite tabs: type addresses, and a
 * comma or line break turns the valid ones into chips. Invalid and duplicate
 * addresses stay in the box and are reported by toast, so nothing is lost.
 */
export const EmailInviteField = ({
  emails,
  setEmails,
  emailBadges,
  setEmailBadges,
  fallbackDomain,
  description,
}: EmailInviteFieldProps) => {
  const t = useTranslations();
  const { user } = useRequiredUser();
  const id = useId();
  const domain = user.currentOrganization?.domain || fallbackDomain;

  const removeEmailBadge = (emailToRemove: string) => {
    setEmailBadges(emailBadges.filter((email) => email !== emailToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!shouldParseEmails(e.key)) {
      return;
    }

    e.preventDefault();

    if (!emails.trim()) {
      return;
    }

    const { emails: parsedEmails, hasLineBreaks } = parseEmails(emails);
    const validEmails: string[] = [];
    const invalidEmails: string[] = [];
    const duplicateEmails: string[] = [];

    parsedEmails.forEach((email) => {
      if (!isValidEmail(email)) {
        invalidEmails.push(email);
      } else if (emailBadges.includes(email)) {
        duplicateEmails.push(email);
      } else {
        validEmails.push(email);
      }
    });

    if (validEmails.length > 0) {
      setEmailBadges([...emailBadges, ...validEmails]);
    }

    // Anything rejected stays in the box, in the separator style it arrived in.
    setEmails(invalidEmails.join(hasLineBreaks ? '\n' : ', '));

    if (invalidEmails.length > 0) {
      toast.error(
        invalidEmails.length === 1 ? t('Invalid email') : t('Invalid emails'),
        {
          description: `"${invalidEmails.join('", "')}" ${invalidEmails.length === 1 ? t('is not a valid email address') : t('are not valid email addresses')}`,
        },
      );
    }

    if (duplicateEmails.length > 0) {
      toast.error(
        duplicateEmails.length === 1
          ? t('Duplicate email')
          : t('Duplicate emails'),
        {
          description: `"${duplicateEmails.join('", "')}" ${duplicateEmails.length === 1 ? t('has already been added') : t('have already been added')}`,
        },
      );
    }
  };

  return (
    <Field>
      <FieldLabel htmlFor={id}>{t('Send to')}</FieldLabel>
      {/* The group owns the border and the focus ring, so the textarea inside
          stays chrome-less as the chips wrap alongside it. */}
      <InputGroup className="min-h-20 flex-wrap items-start gap-2 p-2">
        <TagGroup aria-label={t('Selected emails')}>
          {emailBadges.map((email) => (
            <Tag
              key={email}
              size="lg"
              onRemove={() => removeEmailBadge(email)}
              removeLabel={t('Remove {email}', { email })}
            >
              {email}
            </Tag>
          ))}
        </TagGroup>
        <InputGroupTextarea
          id={id}
          value={emails}
          onChange={(e) => setEmails(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            emailBadges.length === 0
              ? `name1@${domain}, name2@${domain}, ...`
              : t('Type emails followed by a comma or line break...')
          }
          className="min-h-0 min-w-50 flex-1 px-0 py-0 pt-1"
          rows={1}
        />
      </InputGroup>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
    </Field>
  );
};
