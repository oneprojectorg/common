export function parseTranslatedMeta(translated: Record<string, string>) {
  const fieldTitles: Record<string, string> = {};
  const fieldDescriptions: Record<string, string> = {};
  const optionLabels: Record<string, Record<string, string>> = {};

  for (const [key, value] of Object.entries(translated)) {
    if (key.startsWith('field_title:')) {
      fieldTitles[key.slice('field_title:'.length)] = value;
    } else if (key.startsWith('field_desc:')) {
      fieldDescriptions[key.slice('field_desc:'.length)] = value;
    } else if (key.startsWith('option:')) {
      const rest = key.slice('option:'.length);
      const colonIdx = rest.indexOf(':');
      if (colonIdx !== -1) {
        const fieldKey = rest.slice(0, colonIdx);
        const optionValue = rest.slice(colonIdx + 1);
        (optionLabels[fieldKey] ??= {})[optionValue] = value;
      }
    }
  }

  return { fieldTitles, fieldDescriptions, optionLabels };
}
