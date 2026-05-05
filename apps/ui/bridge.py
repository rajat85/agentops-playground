import json
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


class FailureModeFlags(BaseModel):
    retrieval_noise: bool = False
    context_truncation: bool = False
    agent_loop: bool = False

    def to_list(self) -> list[str]:
        return [k for k, v in self.model_dump().items() if v]


class RunRequest(BaseModel):
    task: str
    # Accept either a list of strings or a dict of booleans from the UI
    failure_modes: list[str] | FailureModeFlags = []

    def resolved_failure_modes(self) -> list[str]:
        if isinstance(self.failure_modes, FailureModeFlags):
            return self.failure_modes.to_list()
        return self.failure_modes


@app.post("/run")
async def run_task(request: RunRequest):
    async with httpx.AsyncClient(timeout=120.0) as client:
        try:
            response = await client.post(
                f"{ORCHESTRATOR_URL}/run",
                json={"task": request.task, "failureModes": request.resolved_failure_modes()},
            )
            response.raise_for_status()
            return response.json()
        except httpx.ConnectError:
            raise HTTPException(
                status_code=503,
                detail="Orchestrator not reachable at localhost:3000",
            )
        except httpx.HTTPStatusError as e:
            raise HTTPException(
                status_code=e.response.status_code,
                detail=e.response.text,
            )


@app.get("/trace/{run_id}")
async def get_trace(run_id: str):
    trace_path = TRACES_DIR / f"{run_id}.json"
    if not trace_path.exists():
        raise HTTPException(status_code=404, detail=f"Trace {run_id} not found")
    return json.loads(trace_path.read_text())
