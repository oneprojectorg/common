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
    <div className="inset-0 fixed overflow-x-hidden bg-[black] motion-reduce:bg-orangePurple">
      <div className="inset-0 pointer-events-none absolute z-0">
        <motion.div
          className="inset-0 fixed z-10 size-full motion-reduce:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={backgroundTransition}
        >
          <SoftBlobs />
        </motion.div>
        {/* Fade top and bottom edges on mobile */}
        {/* uses -[black] because -black is renamed in our color system */}
        <div className="top-0 h-20 sm:hidden absolute z-20 w-full bg-gradient-to-b from-[black] via-[rgba(0,0,0,0.35)] via-40%" />
        <div className="bottom-0 h-20 sm:hidden absolute z-20 w-full bg-gradient-to-t from-[black] via-[rgba(0,0,0,0.35)] via-40%" />
      </div>
      <div className="inset-0 gap-6 p-4 py-16 sm:p-8 md:p-12 xl:p-20 absolute z-20 flex flex-col text-white">
        {/* Render the sign in link first for screenreaders */}
        <motion.p
          className="sm:text-lg order-3"
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
          className="text-3xl font-light sm:text-6xl sm:leading-[1.25] order-1 h-full font-serif leading-[1.1]"
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
        <div className="gap-6 order-2 flex flex-col">
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
