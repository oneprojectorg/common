import { SoftBlobs } from '@op/ui/ShaderBackground';
import * as motion from 'motion/react-client';

import { WaitlistSignup } from './WaitlistSignup';

export const ComingSoonScreen = () => {
  const backgroundTransition = {
    duration: 2,
    ease: 'linear',
    delay: 1,
  };
  return (
    <div className="fixed inset-0 overflow-x-hidden bg-[black] motion-reduce:bg-orangePurple">
      <div className="pointer-events-none absolute inset-0 z-0">
        <motion.div
          className="fixed inset-0 z-10 size-full motion-reduce:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={backgroundTransition}
        >
          <SoftBlobs />
        </motion.div>
        {/* Fade top and bottom edges on mobile */}
        {/* uses -[black] because -black is renamed in our color system */}
        <div className="absolute top-0 z-20 h-20 w-full bg-gradient-to-b from-[black] via-[rgba(0,0,0,0.35)] via-40% sm:hidden" />
        <div className="absolute bottom-0 z-20 h-20 w-full bg-gradient-to-t from-[black] via-[rgba(0,0,0,0.35)] via-40% sm:hidden" />
      </div>
      <div className="absolute inset-0 z-20 flex flex-col gap-6 p-4 py-16 text-white sm:p-8 md:p-12 xl:p-20">
        {/* Render the sign in link first for screenreaders */}
        <motion.p
          className="order-3 sm:text-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          Already have an account?{' '}
          <a
            href="/login"
            className="underline transition-opacity hover:opacity-80"
          >
            Sign in
          </a>
        </motion.p>
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="order-1 h-full font-serif text-3xl leading-[1.1] font-light sm:text-6xl sm:leading-[1.25]"
        >
          <em>Common.</em>{' '}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 2 }}
          >
            Connecting people, organizations, and resources to coordinate and
            grow economic democracy to global scale.
          </motion.span>
        </motion.h1>
        <div className="order-2 flex flex-col gap-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 3 }}
          >
            <WaitlistSignup />
          </motion.div>
        </div>
      </div>
    </div>
  );
};
