# AgentOps Playground — Design Spec
Date: 2026-05-05

## Overview

A local-first AI diagnostic platform that executes AI tasks using a local LLM (Ollama/gemma4), exposes internal execution state at every step, supports tool usage via MCP, and visualizes the full execution trace. The goal is to demonstrate how AI systems fail not because of the model, but because of how retrieval, context, and decision layers interact.

This is not a chatbot. It is a diagnostic and stress-testing platform for AI workflows.

---

## Architecture

Four processes, each with a single responsibility:

```
Prefab UI (Python :8501)
  → HTTP → FastAPI Bridge (Python :8000)
  → HTTP → Orchestrator (TypeScript/Express :3000)
  → Ollama API → Ollama (:11434, gemma4)
  → MCP stdio → MCP Server (TypeScript, child process)
```

### Invariants
- Orchestrator is the only process that calls Ollama
- MCP server is the only process that executes tools
- Tools are only called when the LLM requests them
- FastAPI bridge contains no business logic — it is a pure HTTP adapter
- Trace is written to `data/traces/<run_id>.json` by the orchestrator

---

## Component Specifications

### 1. TypeScript Orchestrator (`apps/orchestrator`)

Express server on port 3000.

**Endpoints:**
- `POST /run` — accepts `{ task: string, failureModes: string[] }`, runs agent loop, returns full trace + final answer
- `GET /trace/:runId` — reads and returns `data/traces/<run_id>.json`

**Agent loop (`agent.ts`):**

```
Initialize messages: [system prompt, user task]

For step in 0..MAX_STEPS:
  Call LLM (callLLM)
  Parse response for tool call pattern
  
  If no tool call:
    Write trace to disk
    Return { runId, steps, finalAnswer }
  
  Execute tool via MCP (executeTool)
  Append assistant message + tool result to messages
  Append step to trace

Return fallback if max steps reached
```

**Tool call detection:** System prompt instructs gemma4 to emit tool calls as:
```json
{"tool": "tool_name", "args": {"key": "value"}}
```
The orchestrator detects this JSON block in the LLM text output via regex. No native function-calling API is required.

**Key functions:**
- `runAgent(task, options)` — main agent loop
- `callLLM(messages)` — POST to Ollama `/api/chat`, returns text content
- `executeTool(toolCall)` — sends tool request to MCP client, returns result
- `logTrace(runId, steps, finalAnswer)` — writes `data/traces/<run_id>.json`

**Failure injection hooks:**
- `context_truncation` — applied inside `callLLM`: trim messages to last 2 before sending
- `agent_loop` — applied in loop exit condition: skip the "no tool call = stop" check
- `retrieval_noise` — applied inside MCP server's `retrieve_docs` handler

---

### 2. TypeScript MCP Server (`apps/mcp-server`)

Runs as a child process of the orchestrator, communicating via **stdio transport** using the MCP SDK.

**Tools:**

#### `retrieve_docs`
- Input: `{ query: string }`
- Behavior: keyword-scans `data/docs/*.txt` files for lines matching the query
- Output: `{ documents: string[] }`
- Failure mode (`retrieval_noise`): appends 3 irrelevant hardcoded documents to every result

#### `inject_failure`
- Input: `{ type: "retrieval_noise" | "context_truncation" | "agent_loop" }`
- Behavior: no-op in the MCP server itself; failure modes are passed directly via the `POST /run` request body from the UI and applied by the orchestrator. This tool exists so the LLM can acknowledge failure mode requests in its output, and its call is visible in the trace.
- Output: `{ status: "applied" }`

#### `get_trace`
- Input: `{ run_id: string }`
- Behavior: reads `data/traces/<run_id>.json`
- Output: `{ trace: TraceStep[] }`

---

### 3. FastAPI Bridge (`apps/ui/bridge.py`)

Python FastAPI server on port 8000. Thin HTTP adapter — no business logic.

**Endpoints:**
- `POST /run` — forwards `{ task, failureModes }` to orchestrator `POST /run`, returns response
- `GET /trace/{run_id}` — reads `data/traces/<run_id>.json` directly and returns it

CORS enabled for Prefab UI.

---

### 4. Prefab UI (`apps/ui/app.py`)

Python Prefab UI on port 8501.

**Layout:**
- Task input field (text area)
- Failure mode toggles: `retrieval_noise`, `context_truncation`, `agent_loop` (checkboxes)
- Run button
- Trace viewer (table/list: step number, LLM output, tool called, tool result, latency)
- Final answer display

**Behavior:**
- On Run: POST to FastAPI bridge with task + selected failure modes
- Display each trace step in order
- Highlight steps where a tool was called
- Display final answer separately

---

## Data Formats

### Trace File (`data/traces/<run_id>.json`)
```json
{
  "run_id": "string",
  "task": "string",
  "failure_modes": ["string"],
  "steps": [
    {
      "step": 0,
      "llm_input": "string",
      "llm_output": "string",
      "tool_called": "string | null",
      "tool_result": "object | null",
      "latency_ms": 0
    }
  ],
  "final_answer": "string",
  "completed_at": "ISO8601"
}
```

### Run ID Format
`run_<timestamp>_<4-char-hex>` — e.g., `run_20260505_a3f1`

---

## Repo Structure

```
agentops-playground/
  apps/
    orchestrator/
      src/
        agent.ts          # runAgent, callLLM, executeTool, logTrace
        mcp-client.ts     # MCP stdio client wrapper
        trace.ts          # trace read/write helpers
        server.ts         # Express entry point
      package.json
      tsconfig.json
    mcp-server/
      src/
        index.ts          # tool definitions + handlers
        failure-flags.ts  # in-memory failure state
      package.json
      tsconfig.json
    ui/
      app.py              # Prefab UI
      bridge.py           # FastAPI adapter
      requirements.txt
  data/
    docs/                 # sample .txt files for retrieval
    traces/               # written at runtime
  docs/
    architecture.md
    superpowers/specs/
  README.md
```

---

## Startup Order

1. `mcp-server` — built and ready (spawned by orchestrator on first run request)
2. `orchestrator` — `npm run dev` in `apps/orchestrator`, port 3000
3. `bridge` — `uvicorn bridge:app` in `apps/ui`, port 8000
4. `ui` — `python app.py` in `apps/ui`, port 8501

---

## Sample Docs for Retrieval

Seed `data/docs/` with 3–5 `.txt` files covering different topics (e.g., AI concepts, system design). The `retrieve_docs` tool performs case-insensitive substring matching across all files.

---

## Acceptance Criteria

- User submits a task via UI
- Orchestrator calls LLM first, before any tool
- LLM requests `retrieve_docs` tool
- MCP server executes the tool and returns documents
- Tool result is appended to context
- LLM produces a final answer using the documents
- Full trace (all steps, latencies, tool calls) is visible in UI
- Enabling `retrieval_noise` injects irrelevant docs and the change is visible in the trace
- Enabling `context_truncation` causes the LLM to lose earlier context (visible in trace)
- Enabling `agent_loop` causes the loop to run to max steps (visible in trace)

---

## Constraints

- All execution is local — no paid APIs, no external services
- Ollama must be running with `gemma4` pulled before starting
- Python 3.10+, Node.js 18+
- MCP SDK: `@modelcontextprotocol/sdk`
- Prefab: `pip install prefab-ui`
