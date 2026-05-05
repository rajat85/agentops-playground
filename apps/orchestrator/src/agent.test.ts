import { parseToolCall } from './agent.js';

test('parses a valid tool call JSON block', () => {
  const text = 'I need to search.\n{"tool": "retrieve_docs", "args": {"query": "RAG"}}\nWaiting.';
  const result = parseToolCall(text);
  expect(result).not.toBeNull();
  expect(result!.tool).toBe('retrieve_docs');
  expect(result!.args).toEqual({ query: 'RAG' });
});

test('returns null when no tool call present', () => {
  expect(parseToolCall('Based on my knowledge, the answer is 42.')).toBeNull();
});

test('returns null for malformed JSON', () => {
  expect(parseToolCall('{"tool": "retrieve_docs", "args": {bad json')).toBeNull();
});

test('returns null if tool property is missing', () => {
  expect(parseToolCall('{"name": "retrieve_docs", "args": {}}')).toBeNull();
});

test('returns null if args is not an object', () => {
  expect(parseToolCall('{"tool": "retrieve_docs", "args": "string"}')).toBeNull();
});
