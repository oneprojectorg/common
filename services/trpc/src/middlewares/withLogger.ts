import spacetime from 'spacetime';

import type { MiddlewareBuilderBase } from '../types';
import type { User } from '@op/supabase/lib';

const withLogger: MiddlewareBuilderBase = async ({
  ctx,
  path,
  type,
  getRawInput,
  next,
}) => {
  const start = Date.now();
  const result = await next({ ctx });
  const end = Date.now();

  const rawInput = await getRawInput();

  const logHeadline = `[${spacetime(ctx.time).format('nice')}] - ${end - start}ms`;

  type MiddlewareResult = typeof result;

  const logInfo = (res: MiddlewareResult) => {
    // eslint-disable-next-line ts/no-unsafe-member-access
    const userData = (res as any)?.ctx?.user as User | undefined | null;
    const user = userData
      ? {
          id: userData?.id,
          email: userData?.email,
          role: userData?.role,
        }
      : undefined;

    if (res.ok) {
      console.log({ path, type, rawInput, user, result: res }, '\n');
    }
    else {
      const { error } = res;

      console.log(
        {
          path,
          type,
          rawInput,
          ctx,
          user,
          error: {
            name: error.name,
            message: error.message,
            code: error.code,
            cause: error.cause,
          },
          result: {
            ...res,
            error,
          },
        },
        '\n',
      );
    }
  };

  const logLine = () => {
    console.log('---------------------------------------------');
  };

  if (result.ok) {
    console.log(`✔ OK:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`);
  }
  else if (result.error) {
    console.log(`X FAIL:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`);
  }
  else {
    console.log(
      `? UNHANDLED ERROR:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`,
    );
  }

  logLine();
  logInfo(result);

  return result;
};

export default withLogger;
