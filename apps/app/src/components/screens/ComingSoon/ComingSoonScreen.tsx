import { ButtonLink } from '@op/ui/Button';
import { LogoLoop } from '@op/ui/LogoLoop';
import { cn } from '@op/ui/utils';
import type { Variants } from 'motion/react';
import * as motion from 'motion/react-client';
import Image from 'next/image';

import {
  AnimatedGradientBackground,
  AnimatedGradientText,
} from './AnimatedGradientBackground';
import { WaitlistSignup } from './WaitlistSignup';

export const ComingSoonScreen = () => {
  return (
    <>
      <div className="pointer-events-none absolute top-0 z-10 h-50 w-full bg-gradient-to-b from-[white] from-10% via-[rgba(255,255,255,0.35)] via-45%" />
      <div className="pointer-events-none absolute bottom-0 z-10 h-50 w-full bg-gradient-to-t from-[white] from-10% via-[rgba(255,255,255,0.35)] via-45%" />
      <motion.header
        transition={{ duration: 1 }}
        animate={{ opacity: 1 }}
        initial={{ opacity: 0 }}
        className="sticky top-0 z-20 flex items-center justify-between p-4 md:px-8 md:py-6"
      >
        <img src="/logo-common.svg" alt="Common" className="h-4" />
        <ButtonLink
          href="/login"
          color="secondary"
          className="rounded-lg text-black shadow-md"
        >
          Log in
        </ButtonLink>
      </motion.header>

      <main className="mx-auto my-10 flex max-w-196 flex-col gap-20 px-6 text-center sm:my-24 sm:gap-32">
        <section className="flex flex-col items-center gap-12 sm:gap-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 2, delay: 0.25 }}
          >
            <h1 className="flex flex-col font-serif text-title-md text-balance text-neutral-charcoal sm:text-3xl">
              <span>
                Helping people decide together how to use their resources
              </span>
              <span className="font-serif text-title-md sm:text-3xl">
                <AnimatedGradientText>
                  simply, intuitively, and effectively.
                </AnimatedGradientText>
              </span>
            </h1>
          </motion.div>
          <motion.div
            className="relative grid items-center p-[4vw]"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 2, delay: 0.75 }}
          >
            <AnimatedGradientBackground />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 60 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 2, delay: 1.125 }}
            >
              <Image
                src="/coming-soon-mockup.png"
                alt="Screenshot of the Common platform"
                width={1568}
                height={1041}
                className="relative mx-auto w-7xl max-w-[85vw] shadow sm:max-w-[70vw]"
                priority
              />
            </motion.div>
          </motion.div>
          <FadeInWrapper>
            <p className="flex flex-col space-y-4 text-balance sm:block sm:max-w-144 sm:text-lg">
              <span>
                Built for{' '}
                <FancyWord className="bg-redPurple">communities</FancyWord>{' '}
                ready to share power and co-create{' '}
                <FancyWord className="bg-redPurple">social change</FancyWord>
                — and <FancyWord className="bg-redPurple">
                  funders
                </FancyWord>{' '}
                who trust them to lead.{' '}
              </span>
              <span>No setup headaches. No learning curve. </span>
              <span>
                Common just works, instantly, for{' '}
                <FancyWord className="bg-redPurple">everyone</FancyWord>.
              </span>
            </p>
          </FadeInWrapper>
        </section>
        <FadeInWrapper>
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
        </FadeInWrapper>
        <FadeInWrapper>
          <section className="flex flex-col items-center gap-6 p-6">
            <h2 className="font-serif text-title-md">Get early access</h2>
            <div className="sm:text-lg">
              <p>
                We’re getting ready to welcome more organizations to Common.
              </p>
              <p>Sign up now to hold your spot.</p>
            </div>
            <WaitlistSignup />
          </section>
        </FadeInWrapper>
      </main>
      <footer className="mt-16 flex flex-col items-center justify-center pb-36 text-sm text-neutral-gray4 sm:mt-0 sm:flex-row sm:gap-4">
        <p>Beautifully designed</p>
        <p>•</p>
        <p>Easy to set up</p>
        <p>•</p>
        <p>No training required</p>
      </footer>
    </>
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

const fadeInVariants: Variants = {
  offscreen: {
    y: 60,
    opacity: 0,
    scale: 0.95,
  },
  onscreen: {
    y: 0,
    opacity: 1,
    scale: 1,
    transition: {
      duration: 1.5,
      ease: [0, 0.71, 0.2, 1.01],
    },
  },
};

const FadeInWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="offscreen"
      whileInView="onscreen"
      viewport={{ amount: 0.4 }}
    >
      {children}
    </motion.div>
  );
};

const logos = [
  { src: '/logo-people-powered.png', alt: 'People Powered' },
  { src: '/logo-maria-fund.png', alt: 'MariaFund' },
  { src: '/logo-new-economy-coalition.png', alt: 'New Economy Coalition' },
  {
    src: '/logo-center-for-economic-democracy.png',
    alt: 'Center for Economic Democracy',
  },
];
