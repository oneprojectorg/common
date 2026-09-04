import { getTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { StatusScreen } from '../StatusScreen';

export default async function PageNotFound() {
  const t = await getTranslations();

  return (
    <StatusScreen
      code={404}
      description={
        <p className="text-center">
          {t("Oops! We can't find that page.")}
          <br />
          {t('It might have been moved, deleted, or maybe it never existed.')}
        </p>
      }
      actions={<ButtonLink href="/">{t('Take me home')}</ButtonLink>}
    />
  );
}
