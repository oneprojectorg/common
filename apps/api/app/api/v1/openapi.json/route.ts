import { APP_NAME, OPURLConfig } from '@op/core';
import { createSBServerClient } from '@op/supabase/server';
import { appRouter } from '@op/trpc';
import { generateOpenApiDocument } from 'trpc-to-openapi';

import { verifyAdminOnly } from '../../../route';

// Generate OpenAPI schema document
export const openApiDocument = generateOpenApiDocument(appRouter, {
  title: `${APP_NAME} API`,
  description: `
  # Overview

  The API endpoints documented here are stable. However, the OpenAPI spec used to generate this documentation might be unstable. All REST endpoints are generated from tRPC procedures.

  ## Authentication

  Authenticated is handled via same-site cookies. To authenticate, simply visit the app's [login page](${OPURLConfig('APP').ENV_URL}) and follow the instructions. Once authenticated, you will be able to return to this documentation and make authenticated requests.

  __We have plans to support JWT authentication in the future, allowing for invocation of API endpoints from external clients, services, and webhooks.__

  ## Error Handling

  Status codes will be \`200\` by default for any successful requests. In the case of an error, the status code will be derived from the thrown \`TRPCError\` or fallback to \`500\`.
  `,
  version: '1.0.0',
  baseUrl: OPURLConfig('API').OPENAPI_URL,
  docsUrl: 'https://github.com/oneprojectorg',
  securitySchemes: {},
});

openApiDocument.tags = [
  { name: 'account', description: 'Account related endpoints' },
  { name: 'project', description: 'Project related endpoints' },
  { name: 'assets', description: 'Asset related endpoints' },
];

// Respond with our OpenAPI schema
const handler = async () => {
  const supabase = await createSBServerClient();
  const data = await supabase.auth.getUser();

  verifyAdminOnly(data);

  return Response.json(openApiDocument);
};

export { handler as GET, handler as POST };
