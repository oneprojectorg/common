export function resolveSubmitRedirect({
  didSubmitDraft,
  isAnonymous,
  profileId,
  backHref,
}: {
  didSubmitDraft: boolean;
  isAnonymous: boolean;
  profileId: string | undefined;
  backHref: string;
}): string {
  if (didSubmitDraft && isAnonymous && profileId) {
    return `${backHref}?promote=1&proposal=${profileId}`;
  }

  return backHref;
}
