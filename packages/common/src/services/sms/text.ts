export const SMS_MAX_BODY_LENGTH = 1600;

const SMS_ELLIPSIS = '...';

const SEPARATOR = '\n';

const MARKER_ROOM = 8;

export const clipSmsText = (text: string, max: number): string =>
  text.length <= max
    ? text
    : `${text.slice(0, Math.max(0, max - SMS_ELLIPSIS.length)).trimEnd()}${SMS_ELLIPSIS}`;

export const splitSmsBody = ({
  heading,
  lines,
  footer,
  max = SMS_MAX_BODY_LENGTH,
}: {
  heading?: string;
  lines: ReadonlyArray<string>;
  footer?: string;
  max?: number;
}): string[] => {
  const footerRoom = footer ? footer.length + SEPARATOR.length : 0;
  const groups: string[][] = [[]];
  let used = (heading?.length ?? 0) + MARKER_ROOM + footerRoom;

  for (const line of lines) {
    const group = groups[groups.length - 1]!;
    const extra = line.length + SEPARATOR.length;
    if (group.length > 0 && used + extra > max) {
      groups.push([line]);
      used = MARKER_ROOM + footerRoom + extra;
      continue;
    }
    group.push(line);
    used += extra;
  }

  const total = groups.length;

  return groups.map((group, index) => {
    const marker = total > 1 ? `(${index + 1}/${total})` : null;
    const head =
      index === 0 && heading
        ? marker
          ? `${heading} ${marker}`
          : heading
        : marker;
    const foot = index === total - 1 ? footer : null;
    return [head, ...group, foot]
      .filter((part): part is string => typeof part === 'string')
      .join(SEPARATOR);
  });
};
