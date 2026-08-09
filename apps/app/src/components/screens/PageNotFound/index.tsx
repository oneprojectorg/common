import { ButtonLink } from '@/components/ButtonLink';
import { TranslatedText } from '@/components/TranslatedText';

import { StatusScreen } from '../StatusScreen';

export default function PageNotFound() {
  return (
    <StatusScreen
      code={404}
      description={
        <p className="text-center">
          <TranslatedText text="Oops! We can't find that page." />
          <br />
          <TranslatedText text="It might have been moved, deleted, or maybe it never existed." />
        </p>
      }
      actions={
        <ButtonLink href="/">
          <TranslatedText text="Take me home" />
        </ButtonLink>
      }
    />
  );
}
