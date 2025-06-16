import { AxiomJSTransport, Logger, ConsoleTransport, Transport } from '@axiomhq/logging';
import { createAxiomRouteHandler, nextJsFormatters } from '@axiomhq/nextjs';

import axiomClient from './axiom';

const transports: [Transport, ...Transport[]] = axiomClient && process.env.NEXT_PUBLIC_AXIOM_DATASET
  ? [new AxiomJSTransport({
      axiom: axiomClient,
      dataset: process.env.NEXT_PUBLIC_AXIOM_DATASET,
    })]
  : [new ConsoleTransport()];

export const logger = new Logger({
  transports,
  formatters: nextJsFormatters,
});

export const withAxiom = axiomClient ? createAxiomRouteHandler(logger) : (handler: any) => handler;
