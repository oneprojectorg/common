import { Button } from '@op/ui/Button';
import { Form } from '@op/ui/Form';
import { SoftBlobs } from '@op/ui/ShaderBackground';
import { TextField } from '@op/ui/TextField';
import * as motion from 'motion/react-client';

const ComingSoonPage = () => {
  const backgroundTransition = {
    duration: 2,
    ease: 'linear',
    delay: 1,
  };
  return (
    <div className="absolute inset-0 size-full overflow-x-hidden bg-[#FF613D]">
      <div className="pointer-events-none absolute inset-0 z-0">
        <motion.div
          className="absolute inset-0 z-10 size-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={backgroundTransition}
        >
          <SoftBlobs />
        </motion.div>
      </div>
      <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 text-white sm:p-8 md:p-12 xl:p-20">
        <motion.h1 className="font-serif text-3xl font-light leading-[1.1] sm:text-6xl sm:leading-[1.25]">
          <em>Common.</em>{' '}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 1 }}
          >
            Connecting people, organizations, and resources to coordinate and
            grow economic democracy to global scale.
          </motion.span>
        </motion.h1>
        <motion.div
          className="flex flex-col gap-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2 }}
        >
          <div className="flex flex-col gap-2">
            <h2 className="font-serif text-2xl font-light tracking-tight sm:text-4xl">
              Join the waitlist
            </h2>
            <p className="sm:text-xl">
              We'll email you when we launch publicly.
            </p>
          </div>
          <Form className="flex flex-col gap-3 md:flex-row">
            <TextField
              name="email"
              inputProps={{
                placeholder: 'Email address',
                className:
                  'w-[420px] max-w-full md:px-6 md:text-xl md:h-16 md:rounded-xl',
              }}
              fieldClassName="bg-transparent"
            />
            <Button
              type="submit"
              className="w-full md:h-16 md:w-auto md:rounded-xl md:p-7 md:text-xl"
            >
              Join waitlist
            </Button>
          </Form>
        </motion.div>
      </div>
    </div>
  );
};

export default ComingSoonPage;
