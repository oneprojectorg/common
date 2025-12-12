import { SoftBlobs } from '@op/ui/ShaderBackground';
import * as motion from 'motion/react-client';

import { WaitlistSignupForm } from './WaitlistSignupForm';

const ComingSoonPage = () => {
  const backgroundTransition = {
    duration: 2,
    ease: 'linear',
    delay: 1,
  };
  return (
    <div className="fixed inset-0 overflow-x-hidden bg-[black]">
      <div className="pointer-events-none absolute inset-0 z-0">
        <motion.div
          className="fixed inset-0 z-10 size-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={backgroundTransition}
        >
          <SoftBlobs />
        </motion.div>
        {/* Fade top and bottom edges on mobile */}
        <div className="absolute top-0 z-20 h-20 w-full bg-gradient-to-b from-[black] via-[rgba(0,0,0,0.35)] via-40% sm:hidden" />
        <div className="absolute bottom-0 z-20 h-20 w-full bg-gradient-to-t from-[black] via-[rgba(0,0,0,0.35)] via-40% sm:hidden" />
      </div>
      <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 py-16 text-white sm:p-8 md:p-12 xl:p-20">
        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="font-serif text-3xl font-light leading-[1.1] sm:text-6xl sm:leading-[1.25]"
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
        <motion.div
          className="flex flex-col gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 3 }}
        >
          <WaitlistSignupForm />
          <p className="sm:text-lg">
            Already have an account?{' '}
            <a href="/login" className="underline">
              Sign in
            </a>
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default ComingSoonPage;
