import { OpenAI } from 'openai';

import { getAIConfig } from './config';

let client: OpenAI | undefined;

export const getAIClient = (): OpenAI => {
  if (!client) {
    client = new OpenAI(getAIConfig());
  }

  return client;
};
