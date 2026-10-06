import { useTranslations } from '@/lib/i18n';

import { ButtonLink } from '@/components/ButtonLink';

import { StatusScreen } from '../StatusScreen';

export default function PageNotFound() {
  const t = useTranslations('shell');

  return (
    <StatusScreen
      code={404}
      description={
        <p className="text-center">
          {t('notFoundTitle')}
          <br />
          {t('notFoundBody')}
        </p>
      }
      actions={<ButtonLink href="/">{t('notFoundHomeAction')}</ButtonLink>}
    />
  );
}
