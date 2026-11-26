export const categoryDevelopmentConfirmedSubject = (
  categoryName: string,
  processName: string,
) => `${categoryName} is confirmed in ${processName}`;

export const formatAdvancingSentence = (advancingCount: number) =>
  advancingCount === 1
    ? '1 proposal advances.'
    : `${advancingCount} proposals advance.`;
