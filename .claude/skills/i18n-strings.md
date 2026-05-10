---
name: i18n-strings
description: Wrap user-facing strings with translations. Triggers whenever you add or edit text that a user will see in apps/app.
---

## Rule

Every user-facing string goes through translation. Never hardcode display text.

## Client components

```tsx
import { useTranslations } from "next-intl";

const t = useTranslations();
return <span>{t("Save changes")}</span>;
```

## Server components

```tsx
import { TranslatedText } from "@/components/TranslatedText";
return <TranslatedText id="Save changes" />;
```

## Interpolation

- Simple values: `t("Hello {name}", { name: userName })`
- Rich content (with components): `t.rich("Read the {link}", { link: chunks => <a>{chunks}</a> })`

## Dictionary location

`apps/app/src/lib/i18n/dictionaries/<lang>.json` — one file per language (`en.json`, `es.json`, `pt.json`, `so.json`, …). Keys are the English source strings.

## Adding a new string

1. Use `t("New string")` in code first.
2. Add `"New string": "New string"` to `en.json`.
3. Add a translation for **every other locale** in the dictionaries folder — `bn.json`, `es.json`, `fr.json`, `pt.json`, `so.json`. Translate the value into the target language; keep the key identical to the English source. Don't leave a locale missing or stubbed with the English string.
