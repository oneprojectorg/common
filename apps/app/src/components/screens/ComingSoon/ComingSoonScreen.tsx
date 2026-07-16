'use client';

import { ButtonLink } from '@op/ui/Button';
import { Header2, Header3 } from '@op/ui/Header';
import { LogoLoop } from '@op/ui/LogoLoop';
import { cn } from '@op/ui/utils';
import type { Variants } from 'motion/react';
import * as motion from 'motion/react-client';
import Image from 'next/image';
import { ReactNode } from 'react';
import { LuArrowRight } from 'react-icons/lu';

import { Link, useTranslations } from '@/lib/i18n';

import {
  AnimatedGradientBackground,
  AnimatedGradientText,
} from './AnimatedGradientBackground';
import { WaitlistSignup } from './WaitlistSignup';

export const ComingSoonScreen = () => {
  const t = useTranslations();
  return (
    <>
      <div className="pointer-events-none absolute bottom-0 z-10 h-30 w-full bg-gradient-to-t from-[white] from-10% via-[rgba(255,255,255,0.35)] via-45%" />
      <div className="sticky top-0 z-20">
        <motion.div
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, ease: [0, 0.71, 0.2, 1.01] }}
          className="relative flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-primary-tealWhite px-6 py-2.5 text-center text-neutral-charcoal"
        >
          <div className="pointer-events-none absolute inset-x-0 top-full h-30 bg-gradient-to-b from-[white] from-10% via-[rgba(255,255,255,0.35)] via-45%" />
          <p>
            {t.rich(
              "Columbus' participatory budgeting is now open. <participate>Participate</participate>",
              {
                participate: (chunks: ReactNode) => (
                  // Plain anchor, not the i18n Link: the vanity slug only
                  // resolves via the afterFiles rewrite on a full-page
                  // request. SPA/RSC navigation matches the (main)/[...rest]
                  // catch-all instead and bounces anonymous visitors to
                  // /login.
                  <a
                    href="/columbus"
                    className="inline-flex items-center gap-1 align-bottom whitespace-nowrap text-primary-teal underline hover:no-underline"
                  >
                    {chunks}
                    <LuArrowRight className="size-4" />
                  </a>
                ),
              },
            )}
          </p>
        </motion.div>
        <motion.header
          transition={{ duration: 1 }}
          animate={{ opacity: 1 }}
          initial={{ opacity: 0 }}
          className="relative flex items-center justify-between p-4 md:px-8 md:py-6"
        >
          <img src="/logo-common.svg" alt="Common" className="h-4" />
          <ButtonLink
            href="/login"
            color="secondary"
            className="rounded-lg text-black shadow-md"
          >
            {t('Log in')}
          </ButtonLink>
        </motion.header>
      </div>

      <main className="mx-auto my-10 flex max-w-196 flex-col gap-20 px-6 pb-[20vh] text-center sm:my-24 sm:gap-32">
        <section className="flex flex-col items-center gap-12 sm:gap-24">
          <motion.div
            initial={{ opacity: 0, scale: 0.98, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 2, delay: 0.25 }}
          >
            <h1 className="flex flex-col font-serif text-title-md font-normal text-balance text-neutral-charcoal sm:text-3xl">
              <span>
                {t('Helping people decide together how to use their resources')}
              </span>
              <span className="font-serif text-title-md font-normal sm:text-3xl">
                <AnimatedGradientText>
                  {t('simply, intuitively, and effectively.')}
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
                width={1296}
                height={720}
                className="relative mx-auto w-7xl max-w-[85vw] shadow sm:max-w-[70vw]"
                priority
              />
            </motion.div>
          </motion.div>
          <FadeInWrapper>
            <p className="flex flex-col space-y-4 text-balance sm:block sm:max-w-196 sm:text-xl">
              <span>
                {t.rich(
                  'Built for <fancy>communities</fancy> ready to share power and co-create <fancy>social change</fancy> — and <fancy>funders</fancy> who trust them to lead.',
                  {
                    fancy: (chunks: React.ReactNode) => (
                      <FancyWord className="bg-redPurple">{chunks}</FancyWord>
                    ),
                  },
                )}
              </span>{' '}
              <span>{t('No setup headaches. No learning curve.')} </span>
              <span>
                {t.rich(
                  'Common just works, instantly, for <fancy>everyone</fancy>.',
                  {
                    fancy: (chunks: React.ReactNode) => (
                      <FancyWord className="bg-redPurple">{chunks}</FancyWord>
                    ),
                  },
                )}
              </span>
            </p>
          </FadeInWrapper>
        </section>
        <FadeInWrapper>
          <section className="space-y-6">
            <Header3 className="font-sans text-base">{t('Trusted by')}</Header3>
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
            <Header2 className="font-serif text-title-md sm:text-title-lg">
              {t('Get early access')}
            </Header2>
            <div className="sm:text-lg">
              <p>
                {t(
                  "We're getting ready to welcome more organizations to Common.",
                )}
              </p>
              <p>{t('Sign up now to hold your spot.')}</p>
            </div>
            <WaitlistSignup />
            <p>
              {t('Already have an account?')}{' '}
              <Link
                className="text-primary underline hover:no-underline"
                href="/login"
              >
                {t('Log in')}
              </Link>
            </p>
          </section>
        </FadeInWrapper>
      </main>
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
      viewport={{ amount: 0.4, once: true }}
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
