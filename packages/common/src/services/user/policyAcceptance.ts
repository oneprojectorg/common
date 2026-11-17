export const policyAcceptanceSet = ({
  tos,
  privacy,
  now,
}: {
  tos: boolean;
  privacy: boolean;
  now: string;
}) => ({
  tos,
  privacy,
  ...(tos ? { tosAcceptedOn: now } : {}),
  ...(privacy ? { privacyAcceptedOn: now } : {}),
});
