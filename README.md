# AgentOps Playground

A local-first AI diagnostic platform for observing, tracing, and stress-testing AI workflows.

> AI systems fail not because of the model — but because of how retrieval, context, and decision layers interact.

## Architecture

```
Prefab UI (:5175) → FastAPI Bridge (:8000) → Orchestrator (:3000) → Ollama (:11434)
                                                      ↕
                                              MCP Server (stdio child process)
                                         retrieve_docs | inject_failure | get_trace
```

Trace files are written to `data/traces/<run_id>.json` after each run.

## Prerequisites

- **Node.js 18+**
- **Python 3.11+** with [uv](https://docs.astral.sh/uv/)
- **[Ollama](https://ollama.ai)** with gemma4 pulled:
  ```bash
  ollama pull gemma4
  ```

## Setup

### 1. Install Node dependencies

```bash
cd apps/orchestrator && npm install
cd ../mcp-server && npm install
```

### 2. Install Python dependencies

```bash
cd apps/ui && uv sync
```

## Running

Open four terminals from the repo root:

**Terminal 1 — Ollama**
```bash
ollama serve
```

**Terminal 2 — Orchestrator** (port 3000)
```bash
cd apps/orchestrator && npm run dev
```

**Terminal 3 — FastAPI Bridge** (port 8000)
```bash
cd apps/ui && uv run uvicorn bridge:app --port 8000 --reload
```

**Terminal 4 — Prefab UI** (port 5175)
```bash
cd apps/ui && uv run prefab serve app.py
```

Open **http://127.0.0.1:5175** in a browser.

## Usage

1. Enter a task (e.g. *"What is RAG and how does it reduce hallucination?"*)
2. Optionally enable failure modes:
   - **Retrieval Noise** — injects 3 irrelevant documents into every retrieval result
   - **Context Truncation** — trims conversation context to last 2 messages before each LLM call (drops system prompt)
   - **Agent Loop** — disables the early exit condition; loop runs to max 10 steps
3. Click **Run Agent**
4. Observe the execution trace: each step shows step number, LLM output, tool called, tool result, and latency
5. Compare runs with and without failure modes to see how each layer degrades output

## Trace Format

Traces are stored in `data/traces/<run_id>.json`:

```json
{
  "run_id": "run_20260505123456_a3f1",
  "task": "What is RAG?",
  "failure_modes": [],
  "steps": [
    {
      "step": 0,
      "llm_input": "[system]: ...\n[user]: ...",
      "llm_output": "{\"tool\": \"retrieve_docs\", \"args\": {\"query\": \"RAG\"}}",
      "tool_called": "retrieve_docs",
      "tool_result": { "documents": ["RAG reduces hallucination..."] },
      "latency_ms": 412
    }
  ],
  "final_answer": "RAG stands for Retrieval-Augmented Generation...",
  "completed_at": "2026-05-05T12:34:56.000Z"
}
```

## Project Structure

```
agentops-playground/
  apps/
    orchestrator/src/
      types.ts        — shared TypeScript types
      trace.ts        — trace read/write helpers
      mcp-client.ts   — MCP stdio client
      agent.ts        — agent loop, LLM calls, tool parsing
      server.ts       — Express entry point
    mcp-server/src/
      index.ts        — MCP stdio server with 3 tools
      tools/          — retrieve_docs, inject_failure, get_trace
    ui/
      app.py          — Prefab UI dashboard
      bridge.py       — FastAPI adapter
  data/
    docs/             — seed documents for retrieval
    traces/           — run traces written at runtime
```
