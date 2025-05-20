// import type { User } from '@op/supabase/lib';
import { waitUntil } from '@vercel/functions';
import spacetime from 'spacetime';

import type { MiddlewareBuilderBase } from '../types';

async function sendLogsToAxiom(events: Array<Record<string, any>>) {
  try {
    const response = await fetch(
      `https://api.axiom.co/v1/datasets/common/ingest`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.AXIOM_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(events),
      },
    );

    if (!response.ok) {
      throw new Error(`Error: ${response.status} - ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Logs sent successfully:', data);
    return data;
  } catch (error) {
    // @ts-ignore
    console.error('Error sending logs to Axiom:', error.message);
    throw error;
  }
}

// const logger = pino(
// { level: 'info' },
// pino.transport({
// target: '@axiomhq/pino',
// options: {
// dataset: 'common',
// token: process.env.AXIOM_API_TOKEN,
// },
// }),
// );

const withLogger: MiddlewareBuilderBase = async ({
  ctx,
  // path,
  // type,
  // getRawInput,
  next,
}) => {
  // const events: Array<Record<string, any>> = [];
  const start = Date.now();
  const logger = {
    info: (message: string) => {
      waitUntil(
        sendLogsToAxiom([
          {
            start,
            level: 'info',
            message,
          },
        ]),
      );
    },
  };

  const result = await next({
    ctx: {
      ...ctx,
      logger,
    },
  });
  const end = Date.now();

  // const rawInput = await getRawInput();

  const logHeadline = `[${spacetime(ctx.time).format('nice')}] - ${end - start}ms`;

  // type MiddlewareResult = typeof result;

  // const logInfo = (res: MiddlewareResult) => {
  // // eslint-disable-next-line ts/no-unsafe-member-access
  // const userData = (res as any)?.ctx?.user as User | undefined | null;
  // const user = userData
  // ? {
  // id: userData?.id,
  // email: userData?.email,
  // role: userData?.role,
  // }
  // : undefined;

  // if (res.ok) {
  // console.log({ path, type, rawInput, user, result: res }, '\n');
  // } else {
  // const { error } = res;

  // console.log(
  // 'incoming',
  // {
  // path,
  // type,
  // rawInput,
  // ctx,
  // user,
  // error: {
  // name: error.name,
  // message: error.message,
  // code: error.code,
  // cause: error.cause,
  // },
  // result: {
  // ...res,
  // error,
  // },
  // },
  // '\n',
  // );
  // }
  // };

  if (result.ok) {
    console.log(`✔ OK:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`);
  } else if (result.error) {
    console.log(`X FAIL:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`);
  } else {
    console.log(
      `? UNHANDLED ERROR:\t${ctx.requestId}\n\t${logHeadline}\n\tIP: ${ctx.ip}`,
    );
  }

  // logInfo(result);
  // if (events.length > 0) {
  // await sendLogsToAxiom(events);
  // events.length = 0;
  // }

  return result;
};

export default withLogger;
