import { callLLM, mcpToolToOllama } from './agent.js';
import type { OllamaMessage } from './types.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

// mcpToolToOllama is not exported yet — we test the shape indirectly via callLLM response parsing.
// Direct unit tests for the conversion:
const fakeMcpTool: Tool = {
  name: 'retrieve_docs',
  description: 'Search local documents',
  inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
};

test('mcpToolToOllama maps name, description, and parameters', () => {
  const result = mcpToolToOllama(fakeMcpTool);
  expect(result.type).toBe('function');
  expect(result.function.name).toBe('retrieve_docs');
  expect(result.function.description).toBe('Search local documents');
  expect(result.function.parameters).toEqual(fakeMcpTool.inputSchema);
});

test('mcpToolToOllama handles missing description', () => {
  const tool: Tool = { name: 'no_desc', inputSchema: { type: 'object', properties: {} } };
  const result = mcpToolToOllama(tool);
  expect(result.function.description).toBe('');
});

test('callLLM sends tools in request body and returns tool_calls', async () => {
  let capturedBody = '';
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    capturedBody = init?.body as string;
    return {
      ok: true,
      json: async () => ({
        message: {
          content: '',
          tool_calls: [{ function: { name: 'retrieve_docs', arguments: { query: 'test' } } }],
        },
      }),
    } as Response;
  }) as typeof fetch;

  const messages: OllamaMessage[] = [
    { role: 'system', content: 'You are helpful.' },
    { role: 'user', content: 'find docs' },
  ];
  const tools = [mcpToolToOllama(fakeMcpTool)];

  const response = await callLLM(messages, tools, []);

  const body = JSON.parse(capturedBody) as { tools: unknown };
  expect(body.tools).toEqual(tools);
  expect(response.tool_calls[0]?.function.name).toBe('retrieve_docs');
});

test('callLLM returns empty tool_calls when LLM has no tool call', async () => {
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => ({ message: { content: 'The answer is 42.' } }),
  } as Response)) as typeof fetch;

  const response = await callLLM([], [], []);
  expect(response.tool_calls).toEqual([]);
  expect(response.content).toBe('The answer is 42.');
});
