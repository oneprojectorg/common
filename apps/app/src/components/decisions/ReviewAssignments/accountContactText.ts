import type { AccountContact } from '@op/common/client';

/** The text an admin sees for how to reach a reviewer; null for anonymous. */
export function accountContactText(
  contact: AccountContact | null,
): string | null {
  if (!contact) {
    return null;
  }

  switch (contact.type) {
    case 'email':
      return contact.email;
    case 'phone':
      return contact.phone;
  }
}
