import { z } from 'zod';

const proposalTitleData = z.object({ title: z.string().nullish() }).partial();

/** Edits write the title to the profile, so proposalData.title is a legacy fallback. */
export function resolveProposalTitle(
  profileName: string | null,
  proposalData: unknown,
): string | null {
  if (profileName) {
    return profileName;
  }
  const parsed = proposalTitleData.safeParse(proposalData);
  return parsed.success ? (parsed.data.title ?? null) : null;
}
