export const pluralize = (text: string, count: number) => {
  return count === 1 ? text : `${text}s`;
};
