import { appRouter, createCallerFactory } from '@op/api';
import { logger } from '@op/logging';
import type { NextRequest } from 'next/server';
import { z } from 'zod';

export const maxDuration = 60;

/**
 * A minimal, stateless MCP server (Streamable HTTP transport, JSON responses
 * only). It exposes a curated allowlist of tools, each backed by a public
 * (`openProcedure`) tRPC procedure invoked through a server-side caller, so
 * the procedure's own middleware — rate limiting, optional user resolution,
 * analytics — still runs. No session ids are issued: every POST is
 * self-contained, which is all the spec requires of a stateless server.
 *
 * Hand-rolled instead of the MCP TypeScript SDK: the SDK's server transports
 * are Node `http` based (not fetch/route-handler shaped) and its zod peer
 * range conflicts with our zod v4 catalog. The protocol subset a stateless
 * tools-only server needs is four methods, which fit in this file.
 */
const PROTOCOL_VERSION = '2025-06-18';

const SERVER_INFO = {
  name: 'oneproject-api',
  version: '0.1.0',
};

// Curated tool input: a hand-picked subset of `proposalFilterSchema` rather
// than the full filter, so the tool surface stays small and documented. The
// procedure re-validates against the full schema anyway.
const listProposalsInputSchema = z.object({
  processInstanceId: z.uuid(),
  phaseId: z.uuid().optional(),
  search: z.string().optional(),
  limit: z.number().min(1).max(100).optional(),
  cursor: z.string().optional(),
});

const TOOLS = [
  {
    name: 'list_proposals',
    description:
      'List the proposals of a decision-making process instance, scoped to ' +
      'its current phase (or an explicit phase). Returns the same data the ' +
      'public proposal list shows: title, status, category, submitter ' +
      'profile, and engagement counts, plus a `next` cursor for pagination.',
    inputSchema: {
      type: 'object',
      properties: {
        processInstanceId: {
          type: 'string',
          format: 'uuid',
          description: 'The process instance to list proposals for.',
        },
        phaseId: {
          type: 'string',
          format: 'uuid',
          description:
            'Optional phase to scope to; defaults to the current phase.',
        },
        search: {
          type: 'string',
          description: 'Free-text search over proposal content.',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 100,
          description: 'Page size, default 20.',
        },
        cursor: {
          type: 'string',
          description: "Keyset cursor from the previous page's `next`.",
        },
      },
      required: ['processInstanceId'],
    },
  },
];

// The context mirrors `createContext` in @op/api's trpcFactory, minus cookie
// writes (an MCP response has no browser to set cookies on). Reads still work
// so `withResolvedUser` can resolve a user when credentials are ever sent;
// without them the procedures run as an anonymous public caller.
const buildContext = (req: NextRequest) => {
  // Same 4-8-8-4 shape as the tRPC route's request ids, sourced from Web
  // Crypto so this app doesn't need a nanoid dependency.
  const raw = crypto.randomUUID().replaceAll('-', '');
  const requestId = [
    raw.slice(0, 4),
    raw.slice(4, 12),
    raw.slice(12, 20),
    raw.slice(20, 24),
  ].join('-');

  const cookies: Record<string, string | undefined> = {};
  for (const { name, value } of req.cookies.getAll()) {
    cookies[name] = value;
  }

  return {
    getCookies: () => cookies,
    getCookie: (name: string) => cookies[name],
    setCookie: () => {},
    registerMutationChannels: () => {},
    registerQueryChannels: () => {},
    requestId,
    time: Date.now(),
    ip: req.headers.get('x-forwarded-for'),
    reqUrl: req.url,
    req,
    isServerSideCall: true,
  };
};

const callerFactory = createCallerFactory(appRouter);

type JsonRpcId = string | number | null;

const rpcResult = (id: JsonRpcId, result: unknown) =>
  Response.json({ jsonrpc: '2.0', id, result });

const rpcError = (id: JsonRpcId, code: number, message: string) =>
  Response.json({ jsonrpc: '2.0', id, error: { code, message } });

const callTool = async (req: NextRequest, id: JsonRpcId, params: unknown) => {
  const parsedParams = z
    .object({ name: z.string(), arguments: z.unknown().optional() })
    .safeParse(params);
  if (!parsedParams.success) {
    return rpcError(id, -32602, 'Invalid tools/call params');
  }
  const { name } = parsedParams.data;

  if (name !== 'list_proposals') {
    return rpcError(id, -32602, `Unknown tool: ${name}`);
  }

  const input = listProposalsInputSchema.safeParse(
    parsedParams.data.arguments ?? {},
  );
  if (!input.success) {
    // Tool-level failures ride inside a successful JSON-RPC response with
    // `isError`, per MCP, so the model can read them and self-correct.
    return rpcResult(id, {
      content: [{ type: 'text', text: z.prettifyError(input.error) }],
      isError: true,
    });
  }

  try {
    const caller = callerFactory(buildContext(req));
    const result = await caller.decision.listProposals(input.data);
    return rpcResult(id, {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
      isError: false,
    });
  } catch (error) {
    logger.error('MCP tool call failed', { error, tool: name });
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return rpcResult(id, {
      content: [{ type: 'text', text: message }],
      isError: true,
    });
  }
};

const postHandler = async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }

  const message = z
    .object({
      jsonrpc: z.literal('2.0'),
      id: z.union([z.string(), z.number()]).optional(),
      method: z.string(),
      params: z.unknown().optional(),
    })
    .safeParse(body);
  if (!message.success) {
    return rpcError(null, -32600, 'Invalid Request');
  }
  const { id, method, params } = message.data;

  // Notifications (no id) expect no response body — 202 per Streamable HTTP.
  if (id === undefined) {
    return new Response(null, { status: 202 });
  }

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS });
    case 'tools/call':
      return callTool(req, id, params);
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
};

// Stateless server: no SSE stream to resume and no session to delete.
const methodNotAllowed = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST' } });

export {
  postHandler as POST,
  methodNotAllowed as GET,
  methodNotAllowed as DELETE,
};
