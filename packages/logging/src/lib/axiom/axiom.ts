import { Axiom } from '@axiomhq/js';

const axiomToken = process.env.NEXT_PUBLIC_AXIOM_TOKEN;

export const axiomClient = axiomToken
  ? new Axiom({
      token: axiomToken,
    })
  : null;

export default axiomClient;
