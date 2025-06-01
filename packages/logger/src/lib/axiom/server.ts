import { AxiomJSTransport, Logger } from '@axiomhq/logging';
import { createAxiomRouteHandler, nextJsFormatters } from '@axiomhq/nextjs';

import axiomClient from './axiom';

export const nextLogger = new Logger({
  transports: [
    new AxiomJSTransport({
      axiom: axiomClient,
      dataset: process.env.NEXT_PUBLIC_AXIOM_DATASET!,
    }),
  ],
  formatters: nextJsFormatters,
});

export const withAxiom = createAxiomRouteHandler(nextLogger);
