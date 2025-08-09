'use client';

import {
  AxiomJSTransport,
  ConsoleTransport,
  Logger,
  Transport,
} from '@axiomhq/logging';
import { nextJsFormatters } from '@axiomhq/nextjs/client';
import { createUseLogger, createWebVitalsComponent } from '@axiomhq/react';

import axiomClient from './axiom';

const transports: [Transport, ...Transport[]] =
  axiomClient && process.env.NEXT_PUBLIC_AXIOM_DATASET
    ? [
        new AxiomJSTransport({
          axiom: axiomClient,
          dataset: process.env.NEXT_PUBLIC_AXIOM_DATASET,
        }),
      ]
    : [new ConsoleTransport()];

export const logger = new Logger({
  transports,
  formatters: nextJsFormatters,
});

const useLogger = axiomClient ? createUseLogger(logger) : () => logger;
const WebVitals = axiomClient ? createWebVitalsComponent(logger) : () => null;

export { useLogger, WebVitals };
