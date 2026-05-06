# AgentOps Playground Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first AI diagnostic platform that runs an agent loop (Ollama/gemma4 → MCP tools → trace), visualizes every internal step, and supports failure injection to demonstrate how retrieval, context, and decision layers interact.

**Architecture:** Four processes connected via HTTP: Prefab UI (Python :8501) → FastAPI bridge (Python :8000) → TypeScript orchestrator (:3000) → Ollama (:11434) + MCP server (TypeScript, stdio child process). The orchestrator owns the agent loop; the MCP server owns tool execution; the bridge is a pure HTTP adapter.

**Tech Stack:** TypeScript/Node.js 18+, Express, `@modelcontextprotocol/sdk`, `tsx` for dev, Python 3.10+, FastAPI, httpx, prefab-ui, Ollama with gemma4.

---

## File Map

```
agentops-playground/
  apps/
    orchestrator/
      src/
        types.ts          — shared TypeScript types (TraceStep, RunOptions, RunResult, OllamaMessage)
        trace.ts          — logTrace(), readTrace(), generateRunId()
        mcp-client.ts     — MCPClient class: spawn mcp-server, call tools
        agent.ts          — runAgent(), callLLM(), executeTool(), parseToolCall()
        server.ts         — Express app: POST /run, GET /trace/:runId
      package.json
      tsconfig.json
    mcp-server/
      src/
        types.ts          — ToolResult, FailureFlags types
        failure-flags.ts  — in-memory failure flag store (get/set)
        tools/
          retrieve-docs.ts  — retrieve_docs handler
          inject-failure.ts — inject_failure handler
          get-trace.ts      — get_trace handler
        index.ts          — MCP Server entry: register tools, start stdio server
      package.json
      tsconfig.json
    ui/
      bridge.py           — FastAPI app: POST /run, GET /trace/{run_id}
      app.py              — Prefab UI dashboard
      requirements.txt
  data/
    docs/
      ai-concepts.txt
      system-design.txt
      rag-overview.txt
    traces/               — empty dir, populated at runtime
  README.md
```

---

## Task 1: Repo Scaffolding & Data Seed

**Files:**
- Create: `apps/orchestrator/package.json`
- Create: `apps/orchestrator/tsconfig.json`
- Create: `apps/mcp-server/package.json`
- Create: `apps/mcp-server/tsconfig.json`
- Create: `apps/ui/requirements.txt`
- Create: `data/docs/ai-concepts.txt`
- Create: `data/docs/system-design.txt`
- Create: `data/docs/rag-overview.txt`
- Create: `data/traces/.gitkeep`

- [ ] **Step 1: Create directory structure**

```bash
cd /Users/rajat.ghosh/projects/rnd/agentops-playground
mkdir -p apps/orchestrator/src apps/mcp-server/src/tools apps/ui data/docs data/traces
touch data/traces/.gitkeep
```

- [ ] **Step 2: Create `apps/orchestrator/package.json`**

```json
{
  "name": "orchestrator",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "node --experimental-vm-modules node_modules/.bin/jest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "express": "^4.18.2"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.0.0",
    "jest": "^29.0.0",
    "ts-jest": "^29.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: Create `apps/orchestrator/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create `apps/mcp-server/package.json`**

```json
{
  "name": "mcp-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 5: Create `apps/mcp-server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 6: Create `apps/ui/requirements.txt`**

```
fastapi==0.111.0
uvicorn==0.29.0
httpx==0.27.0
prefab-ui==0.1.0
```

- [ ] **Step 7: Create seed docs**

`data/docs/ai-concepts.txt`:
```
Retrieval-Augmented Generation (RAG) combines a retrieval system with a generative model.
The retrieval step fetches relevant documents from a corpus based on a query.
The generation step uses those documents as context to produce a grounded answer.
RAG reduces hallucination by anchoring the model to retrieved evidence.
Vector databases like FAISS or Chroma store document embeddings for fast similarity search.
Embedding models convert text into dense numerical vectors.
Context window limits how much retrieved text can be passed to the LLM.
```

`data/docs/system-design.txt`:
```
A distributed system consists of multiple components communicating over a network.
Latency is the time taken for a request to travel from client to server and back.
Throughput measures how many requests a system can handle per second.
Horizontal scaling adds more machines; vertical scaling adds more resources to one machine.
Message queues decouple producers and consumers, improving resilience.
Circuit breakers prevent cascading failures by stopping calls to failing services.
Observability requires three pillars: metrics, logs, and traces.
```

`data/docs/rag-overview.txt`:
```
RAG pipelines have three stages: indexing, retrieval, and generation.
Indexing converts raw documents into searchable embeddings stored in a vector store.
Retrieval uses the user query to find the top-k most semantically similar chunks.
Generation passes retrieved chunks as context in the LLM prompt.
Chunk size affects retrieval precision: too small loses context, too large adds noise.
Reranking models score retrieved candidates and reorder them before generation.
Hybrid search combines dense vector search with sparse keyword (BM25) search.
```

- [ ] **Step 8: Install dependencies**

```bash
cd apps/orchestrator && npm install
cd ../mcp-server && npm install
cd ../../apps/ui && pip install -r requirements.txt
```

- [ ] **Step 9: Commit**

```bash
cd /Users/rajat.ghosh/projects/rnd/agentops-playground
git init
git add apps/orchestrator/package.json apps/orchestrator/tsconfig.json
git add apps/mcp-server/package.json apps/mcp-server/tsconfig.json
git add apps/ui/requirements.txt
git add data/docs/ data/traces/.gitkeep
git commit -m "chore: scaffold repo structure and seed docs"
```

---

## Task 2: Orchestrator — Types & Trace Helpers

**Files:**
- Create: `apps/orchestrator/src/types.ts`
- Create: `apps/orchestrator/src/trace.ts`

- [ ] **Step 1: Create `apps/orchestrator/src/types.ts`**

```typescript
export interface OllamaMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface TraceStep {
  step: number;
  llm_input: string;
  llm_output: string;
  tool_called: string | null;
  tool_result: unknown | null;
  latency_ms: number;
}

export interface RunOptions {
  failureModes: string[];
}

export interface RunResult {
  run_id: string;
  task: string;
  failure_modes: string[];
  steps: TraceStep[];
  final_answer: string;
  completed_at: string;
}

export interface ToolCall {
  tool: string;
  args: Record<string, unknown>;
}
```

- [ ] **Step 2: Create `apps/orchestrator/src/trace.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import type { RunResult, TraceStep } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACES_DIR = path.resolve(__dirname, '../../../data/traces');

export function generateRunId(): string {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const hex = Math.floor(Math.random() * 0xffff).toString(16).padStart(4, '0');
  return `run_${ts}_${hex}`;
}

export function logTrace(result: RunResult): void {
  fs.mkdirSync(TRACES_DIR, { recursive: true });
  const filePath = path.join(TRACES_DIR, `${result.run_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
}

export function readTrace(runId: string): RunResult | null {
  const filePath = path.join(TRACES_DIR, `${runId}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RunResult;
}
```

- [ ] **Step 3: Write tests for trace helpers**

Create `apps/orchestrator/src/trace.test.ts`:

```typescript
import { generateRunId, logTrace, readTrace } from './trace.js';
import type { RunResult } from './types.js';
import fs from 'fs';
import path from 'path';

const sampleResult: RunResult = {
  run_id: 'run_test_0001',
  task: 'test task',
  failure_modes: [],
  steps: [],
  final_answer: 'done',
  completed_at: new Date().toISOString(),
};

test('generateRunId returns correct format', () => {
  const id = generateRunId();
  expect(id).toMatch(/^run_\d{14}_[0-9a-f]{4}$/);
});

test('logTrace writes a file, readTrace reads it back', () => {
  logTrace(sampleResult);
  const read = readTrace('run_test_0001');
  expect(read).not.toBeNull();
  expect(read!.final_answer).toBe('done');
  // cleanup
  fs.unlinkSync(path.resolve('data/traces/run_test_0001.json'));
});

test('readTrace returns null for missing run_id', () => {
  expect(readTrace('run_nonexistent')).toBeNull();
});
```

- [ ] **Step 4: Add jest config to `apps/orchestrator/package.json`**

Add this field to the existing package.json:
```json
"jest": {
  "preset": "ts-jest/presets/default-esm",
  "testEnvironment": "node",
  "extensionsToTreatAsEsm": [".ts"],
  "moduleNameMapper": {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
}
```

- [ ] **Step 5: Run tests**

```bash
cd apps/orchestrator && npm test -- --testPathPattern=trace
```

Expected: 3 tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/orchestrator/src/types.ts apps/orchestrator/src/trace.ts apps/orchestrator/src/trace.test.ts apps/orchestrator/package.json
git commit -m "feat(orchestrator): types and trace helpers"
```

---

## Task 3: MCP Server — Types, Failure Flags, and Tool Handlers

**Files:**
- Create: `apps/mcp-server/src/types.ts`
- Create: `apps/mcp-server/src/failure-flags.ts`
- Create: `apps/mcp-server/src/tools/retrieve-docs.ts`
- Create: `apps/mcp-server/src/tools/inject-failure.ts`
- Create: `apps/mcp-server/src/tools/get-trace.ts`

- [ ] **Step 1: Create `apps/mcp-server/src/types.ts`**

```typescript
export type FailureType = 'retrieval_noise' | 'context_truncation' | 'agent_loop';

export interface ToolResult {
  [key: string]: unknown;
}
```

- [ ] **Step 2: Create `apps/mcp-server/src/failure-flags.ts`**

```typescript
import type { FailureType } from './types.js';

const active = new Set<FailureType>();

export function setFailure(type: FailureType): void {
  active.add(type);
}

export function hasFailure(type: FailureType): boolean {
  return active.has(type);
}

export function clearFailures(): void {
  active.clear();
}
```

- [ ] **Step 3: Create `apps/mcp-server/src/tools/retrieve-docs.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { hasFailure } from '../failure-flags.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOCS_DIR = path.resolve(__dirname, '../../../../data/docs');

const NOISE_DOCS = [
  'The French Revolution began in 1789 with the storming of the Bastille.',
  'Photosynthesis converts sunlight into glucose using chlorophyll.',
  'The speed of light in a vacuum is approximately 299,792,458 metres per second.',
];

export function retrieveDocs(query: string): { documents: string[] } {
  const docs: string[] = [];

  if (fs.existsSync(DOCS_DIR)) {
    const files = fs.readdirSync(DOCS_DIR).filter((f) => f.endsWith('.txt'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(DOCS_DIR, file), 'utf-8');
      const lines = content.split('\n').filter((line) =>
        line.toLowerCase().includes(query.toLowerCase())
      );
      docs.push(...lines);
    }
  }

  if (hasFailure('retrieval_noise')) {
    docs.push(...NOISE_DOCS);
  }

  return { documents: docs.length > 0 ? docs : [`No documents found for query: ${query}`] };
}
```

- [ ] **Step 4: Create `apps/mcp-server/src/tools/inject-failure.ts`**

```typescript
import type { FailureType } from '../types.js';
import { setFailure } from '../failure-flags.js';

export function injectFailure(type: FailureType): { status: string } {
  setFailure(type);
  return { status: 'applied' };
}
```

- [ ] **Step 5: Create `apps/mcp-server/src/tools/get-trace.ts`**

```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TRACES_DIR = path.resolve(__dirname, '../../../../data/traces');

export function getTrace(runId: string): { trace: unknown } {
  const filePath = path.join(TRACES_DIR, `${runId}.json`);
  if (!fs.existsSync(filePath)) {
    return { trace: null };
  }
  return { trace: JSON.parse(fs.readFileSync(filePath, 'utf-8')) };
}
```

- [ ] **Step 6: Build mcp-server to verify types compile**

```bash
cd apps/mcp-server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add apps/mcp-server/src/
git commit -m "feat(mcp-server): types, failure flags, and tool handlers"
```

---

## Task 4: MCP Server — Entry Point (stdio transport)

**Files:**
- Create: `apps/mcp-server/src/index.ts`

- [ ] **Step 1: Create `apps/mcp-server/src/index.ts`**

```typescript
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
```

- [ ] **Step 2: Build to verify no type errors**

```bash
cd apps/mcp-server && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Smoke test — run server and list tools**

```bash
cd apps/mcp-server
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | npx tsx src/index.ts
```

Expected: JSON response listing `retrieve_docs`, `inject_failure`, `get_trace`.

- [ ] **Step 4: Commit**

```bash
git add apps/mcp-server/src/index.ts
git commit -m "feat(mcp-server): stdio entry point with all three tools"
```

---

## Task 5: Orchestrator — MCP Client

**Files:**
- Create: `apps/orchestrator/src/mcp-client.ts`

- [ ] **Step 1: Create `apps/orchestrator/src/mcp-client.ts`**

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MCP_SERVER_PATH = path.resolve(__dirname, '../../../apps/mcp-server/src/index.ts');

export class MCPClient {
  private client: Client;
  private connected = false;

  constructor() {
    this.client = new Client(
      { name: 'orchestrator-client', version: '1.0.0' },
      { capabilities: {} }
    );
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['tsx', MCP_SERVER_PATH],
    });
    await this.client.connect(transport);
    this.connected = true;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    await this.connect();
    const result = await this.client.callTool({ name, arguments: args });
    const textContent = result.content.find((c: { type: string }) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error(`No text content in MCP response for tool: ${name}`);
    }
    return JSON.parse((textContent as { type: 'text'; text: string }).text);
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.close();
    this.connected = false;
  }
}
```

- [ ] **Step 2: Build to verify types**

```bash
cd apps/orchestrator && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/orchestrator/src/mcp-client.ts
git commit -m "feat(orchestrator): MCP stdio client wrapper"
```

---

## Task 6: Orchestrator — Agent Loop

**Files:**
- Create: `apps/orchestrator/src/agent.ts`

- [ ] **Step 1: Create `apps/orchestrator/src/agent.ts`**

```typescript
import type { OllamaMessage, TraceStep, RunOptions, RunResult, ToolCall } from './types.js';
import { generateRunId, logTrace } from './trace.js';
import { MCPClient } from './mcp-client.js';

const OLLAMA_URL = 'http://localhost:11434/api/chat';
const MODEL = 'gemma4';
const MAX_STEPS = 10;

const SYSTEM_PROMPT = `You are a research assistant with access to tools.

When you need to look up information, emit a tool call as a JSON block on its own line, exactly like this:
{"tool": "retrieve_docs", "args": {"query": "your search query"}}

Available tools:
- retrieve_docs: search local documents. Args: { "query": string }
- inject_failure: acknowledge a failure mode. Args: { "type": "retrieval_noise" | "context_truncation" | "agent_loop" }
- get_trace: read a past execution trace. Args: { "run_id": string }

Rules:
1. Only emit ONE tool call per response.
2. After receiving tool results, use them to answer the user.
3. When you have enough information, answer directly without a tool call.
4. Do not invent information. Use only what is retrieved.`;

export function parseToolCall(text: string): ToolCall | null {
  const match = text.match(/\{[^{}]*"tool"\s*:[^{}]*\}/s);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.tool === 'string' && typeof parsed.args === 'object') {
      return parsed as ToolCall;
    }
  } catch {
    // not valid JSON
  }
  return null;
}

export async function callLLM(
  messages: OllamaMessage[],
  failureModes: string[]
): Promise<string> {
  let messagesToSend = messages;

  if (failureModes.includes('context_truncation')) {
    messagesToSend = messages.slice(-2);
  }

  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: messagesToSend,
      stream: false,
      ...(failureModes.includes('agent_loop') ? { options: { temperature: 1.5 } } : {}),
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { message: { content: string } };
  return data.message.content;
}

export async function runAgent(task: string, options: RunOptions): Promise<RunResult> {
  const runId = generateRunId();
  const mcpClient = new MCPClient();
  const messages: OllamaMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: task },
  ];
  const steps: TraceStep[] = [];

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const t0 = Date.now();
      const llmInput = messages.map((m) => `[${m.role}]: ${m.content}`).join('\n');
      const llmOutput = await callLLM(messages, options.failureModes);
      const latency_ms = Date.now() - t0;

      const toolCall = parseToolCall(llmOutput);

      const traceStep: TraceStep = {
        step,
        llm_input: llmInput,
        llm_output: llmOutput,
        tool_called: toolCall ? toolCall.tool : null,
        tool_result: null,
        latency_ms,
      };

      if (!toolCall || options.failureModes.includes('agent_loop') === false) {
        if (!toolCall) {
          steps.push(traceStep);
          const result: RunResult = {
            run_id: runId,
            task,
            failure_modes: options.failureModes,
            steps,
            final_answer: llmOutput,
            completed_at: new Date().toISOString(),
          };
          logTrace(result);
          return result;
        }
      }

      // Execute tool via MCP
      const toolResult = await mcpClient.callTool(toolCall!.tool, toolCall!.args as Record<string, unknown>);
      traceStep.tool_result = toolResult;
      steps.push(traceStep);

      messages.push({ role: 'assistant', content: llmOutput });
      messages.push({ role: 'tool', content: JSON.stringify(toolResult) });
    }
  } finally {
    await mcpClient.disconnect();
  }

  const result: RunResult = {
    run_id: runId,
    task,
    failure_modes: options.failureModes,
    steps,
    final_answer: 'Max steps reached without a final answer.',
    completed_at: new Date().toISOString(),
  };
  logTrace(result);
  return result;
}
```

- [ ] **Step 2: Write tests for `parseToolCall`**

Create `apps/orchestrator/src/agent.test.ts`:

```typescript
import { parseToolCall } from './agent.js';

test('parses a valid tool call JSON block', () => {
  const text = 'I need to search for information.\n{"tool": "retrieve_docs", "args": {"query": "RAG"}}\nLet me wait for results.';
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
```

- [ ] **Step 3: Run tests**

```bash
cd apps/orchestrator && npm test -- --testPathPattern=agent
```

Expected: 4 tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/orchestrator/src/agent.ts apps/orchestrator/src/agent.test.ts
git commit -m "feat(orchestrator): agent loop with LLM calls and tool parsing"
```

---

## Task 7: Orchestrator — Express Server

**Files:**
- Create: `apps/orchestrator/src/server.ts`

- [ ] **Step 1: Create `apps/orchestrator/src/server.ts`**

```typescript
import express from 'express';
import { runAgent } from './agent.js';
import { readTrace } from './trace.js';

const app = express();
app.use(express.json());

app.post('/run', async (req, res) => {
  const { task, failureModes = [] } = req.body as { task: string; failureModes: string[] };
  if (!task || typeof task !== 'string') {
    res.status(400).json({ error: 'task is required and must be a string' });
    return;
  }
  try {
    const result = await runAgent(task, { failureModes });
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

app.get('/trace/:runId', (req, res) => {
  const trace = readTrace(req.params.runId);
  if (!trace) {
    res.status(404).json({ error: 'Trace not found' });
    return;
  }
  res.json(trace);
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Orchestrator running on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: Build to verify types**

```bash
cd apps/orchestrator && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start the orchestrator (requires Ollama running)**

```bash
cd apps/orchestrator && npm run dev
```

Expected output: `Orchestrator running on http://localhost:3000`

- [ ] **Step 4: Smoke test the orchestrator**

In a separate terminal:
```bash
curl -s -X POST http://localhost:3000/run \
  -H "Content-Type: application/json" \
  -d '{"task": "What is RAG?", "failureModes": []}' | jq .
```

Expected: JSON with `run_id`, `steps` array, `final_answer`.

- [ ] **Step 5: Commit**

```bash
git add apps/orchestrator/src/server.ts
git commit -m "feat(orchestrator): Express server with /run and /trace endpoints"
```

---

## Task 8: FastAPI Bridge

**Files:**
- Create: `apps/ui/bridge.py`

- [ ] **Step 1: Create `apps/ui/bridge.py`**

```python
import json
import os
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="AgentOps Bridge")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ORCHESTRATOR_URL = "http://localhost:3000"
TRACES_DIR = Path(__file__).parent.parent.parent / "data" / "traces"


class RunRequest(BaseModel):
    task: str
    failure_modes: list[str] = []


@app.post("/run")
async def run_task(request: RunRequest):
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{ORCHESTRATOR_URL}/run",
                json={"task": request.task, "failureModes": request.failure_modes},
            )
            response.raise_for_status()
            return response.json()
        except httpx.ConnectError:
            raise HTTPException(status_code=503, detail="Orchestrator not reachable at localhost:3000")
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail=e.response.text)


@app.get("/trace/{run_id}")
async def get_trace(run_id: str):
    trace_path = TRACES_DIR / f"{run_id}.json"
    if not trace_path.exists():
        raise HTTPException(status_code=404, detail=f"Trace {run_id} not found")
    return json.loads(trace_path.read_text())
```

- [ ] **Step 2: Start the bridge and verify it runs**

```bash
cd apps/ui && uvicorn bridge:app --port 8000 --reload
```

Expected: `Uvicorn running on http://0.0.0.0:8000`

- [ ] **Step 3: Smoke test the bridge (requires orchestrator running)**

```bash
curl -s -X POST http://localhost:8000/run \
  -H "Content-Type: application/json" \
  -d '{"task": "What is RAG?", "failure_modes": []}' | jq .run_id
```

Expected: a run_id string like `"run_20260505123456_a3f1"`

- [ ] **Step 4: Commit**

```bash
git add apps/ui/bridge.py
git commit -m "feat(ui): FastAPI bridge adapter"
```

---

## Task 9: Prefab UI

**Files:**
- Create: `apps/ui/app.py`

- [ ] **Step 1: Create `apps/ui/app.py`**

```python
import httpx
import prefab as pf

BRIDGE_URL = "http://localhost:8000"


def run_task(task: str, failure_modes: list[str]) -> dict:
    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            f"{BRIDGE_URL}/run",
            json={"task": task, "failure_modes": failure_modes},
        )
        response.raise_for_status()
        return response.json()


with pf.App(title="AgentOps Playground") as app:
    pf.Heading("AgentOps Playground", level=1)
    pf.Text("A diagnostic platform to observe, trace, and stress-test AI workflows.")

    with pf.Card():
        pf.Heading("Task Input", level=2)
        task_input = pf.TextArea(
            label="Task",
            placeholder="e.g. What is RAG and how does retrieval affect quality?",
            rows=3,
        )

        pf.Heading("Failure Modes", level=3)
        noise_toggle = pf.Checkbox(label="retrieval_noise — inject irrelevant documents")
        truncation_toggle = pf.Checkbox(label="context_truncation — trim context to last 2 messages")
        loop_toggle = pf.Checkbox(label="agent_loop — disable early exit, run to max steps")

        run_button = pf.Button("Run Agent", variant="primary")

    result_area = pf.Container()

    @run_button.on_click
    def handle_run():
        task = task_input.value
        if not task.strip():
            with result_area:
                pf.Alert("Please enter a task.", variant="warning")
            return

        failure_modes = []
        if noise_toggle.checked:
            failure_modes.append("retrieval_noise")
        if truncation_toggle.checked:
            failure_modes.append("context_truncation")
        if loop_toggle.checked:
            failure_modes.append("agent_loop")

        with result_area:
            pf.Text("Running agent...")

        try:
            data = run_task(task, failure_modes)
        except httpx.HTTPError as e:
            with result_area:
                pf.Alert(f"Error: {e}", variant="error")
            return

        steps = data.get("steps", [])
        final_answer = data.get("final_answer", "")
        run_id = data.get("run_id", "")

        with result_area:
            pf.Heading(f"Run: {run_id}", level=2)

            pf.Heading("Execution Trace", level=3)
            for step in steps:
                tool_called = step.get("tool_called")
                with pf.Card(
                    variant="outlined" if not tool_called else "filled"
                ):
                    pf.Text(f"**Step {step['step'] + 1}** — {step['latency_ms']}ms")
                    pf.Text(f"**LLM output:** {step['llm_output'][:300]}...")
                    if tool_called:
                        pf.Badge(f"Tool: {tool_called}", variant="info")
                        pf.Code(
                            str(step.get("tool_result", "")),
                            language="json",
                        )

            with pf.Card(variant="success"):
                pf.Heading("Final Answer", level=3)
                pf.Text(final_answer)
```

- [ ] **Step 2: Start the UI**

```bash
cd apps/ui && python app.py
```

Expected: Prefab server starts, opens at `http://localhost:8501`

- [ ] **Step 3: End-to-end test**

With all four processes running (Ollama, mcp-server built, orchestrator on :3000, bridge on :8000):

1. Open `http://localhost:8501` in a browser
2. Enter task: `What is RAG and how does it reduce hallucination?`
3. Click Run Agent
4. Verify trace steps appear with step numbers, LLM output, tool calls
5. Verify final answer is shown in the green card

- [ ] **Step 4: Test failure mode — retrieval_noise**

1. Check `retrieval_noise` checkbox
2. Run the same task
3. Verify that tool_result in a step contains the 3 irrelevant noise documents
4. Verify the final answer may reference irrelevant content

- [ ] **Step 5: Commit**

```bash
git add apps/ui/app.py
git commit -m "feat(ui): Prefab dashboard with trace viewer and failure mode toggles"
```

---

## Task 10: README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Create `README.md`**

```markdown
# AgentOps Playground

A local-first AI diagnostic platform for observing, tracing, and stress-testing AI workflows.

## What it demonstrates

> AI systems fail not because of the model — but because of how retrieval, context, and decision layers interact.

## Prerequisites

- Node.js 18+
- Python 3.10+
- [Ollama](https://ollama.ai) with gemma4 pulled:
  ```bash
  ollama pull gemma4
  ```

## Setup

### 1. Install dependencies

```bash
cd apps/orchestrator && npm install
cd ../mcp-server && npm install
cd ../../apps/ui && pip install -r requirements.txt
```

### 2. Start Ollama

```bash
ollama serve
```

### 3. Start the Orchestrator (terminal 1)

```bash
cd apps/orchestrator && npm run dev
```

### 4. Start the FastAPI Bridge (terminal 2)

```bash
cd apps/ui && uvicorn bridge:app --port 8000 --reload
```

### 5. Start the Prefab UI (terminal 3)

```bash
cd apps/ui && python app.py
```

Open `http://localhost:8501` in a browser.

## Usage

1. Enter a task in the text field (e.g. "What is RAG and how does retrieval quality affect answers?")
2. Optionally enable failure modes:
   - **retrieval_noise** — injects 3 irrelevant documents into every retrieval result
   - **context_truncation** — trims conversation context to last 2 messages before each LLM call
   - **agent_loop** — removes the early exit condition; loop runs to max steps
3. Click **Run Agent**
4. Observe the execution trace: each step shows LLM output, tool called, tool result, and latency
5. Compare runs with and without failure modes to see how each layer degrades the output

## Architecture

```
Prefab UI (:8501) → FastAPI Bridge (:8000) → Orchestrator (:3000) → Ollama (:11434)
                                                      ↕
                                              MCP Server (stdio)
                                         retrieve_docs | inject_failure | get_trace
```

Trace files are written to `data/traces/<run_id>.json`.

## Trace Format

```json
{
  "run_id": "run_20260505123456_a3f1",
  "task": "What is RAG?",
  "failure_modes": [],
  "steps": [
    {
      "step": 0,
      "llm_input": "...",
      "llm_output": "...",
      "tool_called": "retrieve_docs",
      "tool_result": { "documents": ["..."] },
      "latency_ms": 412
    }
  ],
  "final_answer": "RAG stands for...",
  "completed_at": "2026-05-05T12:34:56.000Z"
}
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and usage instructions"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| POST /run on orchestrator | Task 7 |
| GET /trace/:runId on orchestrator | Task 7 |
| callLLM with Ollama gemma4 | Task 6 |
| parseToolCall from LLM text | Task 6 |
| MCP stdio transport | Task 4, Task 5 |
| retrieve_docs tool | Task 3, Task 4 |
| inject_failure tool | Task 3, Task 4 |
| get_trace tool | Task 3, Task 4 |
| retrieval_noise failure mode | Task 3 (retrieve-docs.ts) |
| context_truncation failure mode | Task 6 (callLLM) |
| agent_loop failure mode | Task 6 (runAgent loop) |
| Trace JSON format | Task 2 (types.ts, trace.ts) |
| FastAPI bridge /run and /trace | Task 8 |
| Prefab UI with task input | Task 9 |
| Failure mode checkboxes in UI | Task 9 |
| Trace viewer in UI | Task 9 |
| Final answer display | Task 9 |
| data/docs seed files | Task 1 |
| README | Task 10 |

All spec requirements covered. ✓
