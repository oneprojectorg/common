import { ButtonLink } from '@op/ui/Button';
import { Header2 } from '@op/ui/Header';

export default function PageNotFound() {
  return (
    <div className="gap-8 flex size-full flex-col items-center justify-center">
      <div className="gap-4 flex flex-col items-center">
        <Header2 className="font-light font-serif text-[4rem] leading-[110%]">
          404
        </Header2>
        <p className="text-center">
          Oops! We can't find that page.
          <br />
          It might have been moved, deleted, or maybe it never existed.
        </p>
      </div>
      <ButtonLink href="/" color="primary">
        Take me home
      </ButtonLink>
    </div>
  );
}
