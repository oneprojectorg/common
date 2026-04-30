import { ButtonLink } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';

import { TranslatedText } from '@/components/TranslatedText';

export default function PageNotFound() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <Header2 className="font-serif text-[4rem] leading-[110%] font-light">
          404
        </Header2>
        <p className="text-center">
          <TranslatedText text="Oops! We can't find that page." />
          <br />
          <TranslatedText text="It might have been moved, deleted, or maybe it never existed." />
        </p>
      </div>
      <ButtonLink href="/" variant="default">
        <TranslatedText text="Take me home" />
      </ButtonLink>
    </div>
  );
}
