import { Button } from '@op/ui/Button';
import { LuArrowLeft, LuCheck } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

interface ReviewNavbarProps {
  slug: string;
}

export function ReviewNavbar({ slug }: ReviewNavbarProps) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b bg-white px-6 md:px-8">
      <Link
        href={`/decisions/${slug}`}
        className="flex items-center gap-2 text-base text-primary-teal"
      >
        <LuArrowLeft className="size-4" />
        {t('Back to proposals')}
      </Link>
      <div className="flex items-center gap-4">
        <Button color="secondary" size="small">
          {t('Request revision')}
        </Button>
        <Button color="primary" size="small">
          <LuCheck className="size-4" />
          {t('Submit review')}
        </Button>
      </div>
    </header>
  );
}
