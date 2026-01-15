import { ButtonLink } from '@op/ui/Button';
import { LogoLoop } from '@op/ui/LogoLoop';
import { cn } from '@op/ui/utils';

import { WaitlistSignup } from './WaitlistSignup';

export const ComingSoonScreen = () => {
  return (
    <div>
      <div className="pointer-events-none absolute top-0 z-10 h-50 w-full bg-gradient-to-b from-[white] from-10% via-[rgba(255,255,255,0.35)] via-45%" />
      <div className="pointer-events-none absolute bottom-0 z-10 h-50 w-full bg-gradient-to-t from-[white] from-10% via-[rgba(255,255,255,0.35)] via-45%" />
      <header className="sticky top-0 z-20 flex items-center justify-between p-4">
        <img src="/logo-common.svg" alt="Common" className="h-4" />
        <ButtonLink
          href="/login"
          color="secondary"
          className="rounded-lg text-black shadow-md"
          size="small"
        >
          Log in
        </ButtonLink>
      </header>
      <main className="mx-auto my-10 flex max-w-196 flex-col gap-20 px-6 text-center sm:my-20">
        <section className="space-y-12">
          <h1 className="flex flex-col gap-6 text-center sm:text-lg">
            <span>
              Helping people decide together how to use their resources—{' '}
            </span>
            <span className="bg-blueGreen bg-clip-text font-serif text-xl text-transparent sm:text-3xl">
              simply, intuitively, and effectively.
            </span>
          </h1>
          <div>
            <img
              src="/coming-soon-hero.png"
              alt="Screenshot of the Common platform"
            />
          </div>
          <div className="space-y-4 text-balance sm:text-lg">
            <p>
              Built for{' '}
              <FancyWord className="bg-redPurple">communities</FancyWord> ready
              to share power and co-create{' '}
              <FancyWord className="bg-redPurple">social change</FancyWord>
              — and <FancyWord className="bg-redPurple">funders</FancyWord> who
              trust them to lead.
            </p>
            <p>No setup headaches. No learning curve.</p>
            <p>
              Common just works, instantly, for{' '}
              <FancyWord className="bg-redPurple">everyone</FancyWord>.
            </p>
          </div>
        </section>
        <section className="space-y-6">
          <h3 className="text-base">Trusted by</h3>
          <LogoLoop
            logos={logos}
            speed={20}
            direction="left"
            logoHeight={48}
            gap={40}
            hoverSpeed={5}
            fadeOut
            fadeOutColor="#ffffff"
            ariaLabel="Technology partners"
          />
        </section>
        <section className="flex flex-col items-center gap-6">
          <h2 className="font-serif text-2xl">Get early access</h2>
          <div>
            <p>We’re getting ready to welcome more organizations to Common.</p>
            <p>Sign up now to hold your spot.</p>
          </div>
          <WaitlistSignup />
        </section>
      </main>
      <footer className="mt-16 flex flex-col items-center justify-center pb-36 text-sm text-neutral-gray4 sm:mt-0 sm:flex-row sm:gap-4">
        <p>Beautifully designed</p>
        <p>•</p>
        <p>Easy to set up</p>
        <p>•</p>
        <p>No training required</p>
      </footer>
    </div>
  );
};

const FancyWord = ({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) => (
  <span className={cn(className, 'bg-clip-text font-serif text-transparent')}>
    {children}
  </span>
);

const logos = [
  { src: '/logo-people-powered.png', alt: 'People Powered' },
  { src: '/logo-maria-fund.png', alt: 'MariaFund' },
  { src: '/logo-new-economy-coalition.png', alt: 'New Economy Coalition' },
  {
    src: '/logo-center-for-economic-democracy.png',
    alt: 'Center for Economic Democracy',
  },
];
