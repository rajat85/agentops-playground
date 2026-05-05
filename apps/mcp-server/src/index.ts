import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { retrieveDocs } from './tools/retrieve-docs.js';
import { injectFailure } from './tools/inject-failure.js';
import { getTrace } from './tools/get-trace.js';
import type { FailureType } from './types.js';

const server = new Server(
  { name: 'agentops-mcp-server', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'retrieve_docs',
      description: 'Search local documents for content matching a query',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
    },
    {
      name: 'inject_failure',
      description: 'Acknowledge a failure mode injection request',
      inputSchema: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['retrieval_noise', 'context_truncation', 'agent_loop'],
          },
        },
        required: ['type'],
      },
    },
    {
      name: 'get_trace',
      description: 'Read a stored execution trace by run_id',
      inputSchema: {
        type: 'object',
        properties: { run_id: { type: 'string' } },
        required: ['run_id'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  let result: unknown;

  if (name === 'retrieve_docs') {
    result = retrieveDocs((args as { query: string }).query);
  } else if (name === 'inject_failure') {
    result = injectFailure((args as { type: FailureType }).type);
  } else if (name === 'get_trace') {
    result = getTrace((args as { run_id: string }).run_id);
  } else {
    throw new Error(`Unknown tool: ${name}`);
  }

  return {
    content: [{ type: 'text', text: JSON.stringify(result) }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
