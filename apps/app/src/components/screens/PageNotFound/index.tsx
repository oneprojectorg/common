import { Header2 } from '@op/sense/Header';

import { ButtonLink } from '@/components/ButtonLink';
import { TranslatedText } from '@/components/TranslatedText';

export default function PageNotFound() {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-8">
      <div className="flex flex-col items-center gap-4">
        <Header2 className="text-[4rem] leading-[110%]">404</Header2>
        <p className="text-center">
          <TranslatedText text="Oops! We can't find that page." />
          <br />
          <TranslatedText text="It might have been moved, deleted, or maybe it never existed." />
        </p>
      </div>
      <ButtonLink href="/">
        <TranslatedText text="Take me home" />
      </ButtonLink>
    </div>
  );
}
