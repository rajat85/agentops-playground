"""AgentOps Playground — config panel.

Serves at http://127.0.0.1:5175 via:
    uv run prefab serve app.py
"""

from prefab_ui import PrefabApp
from prefab_ui.components import (
    Alert, AlertDescription,
    Card, CardContent, CardDescription, CardHeader, CardTitle,
    Checkbox, Column, Div, Embed,
    Icon, If, Row, Text, Muted, Textarea, Button,
)
from prefab_ui.actions import Fetch, SetState, ShowToast
from prefab_ui.rx import RESULT

ORCHESTRATOR_URL = "http://localhost:3000"
TRACE_VIEWER_URL = "http://localhost:5176"

with PrefabApp(
    title="AgentOps Playground",
    state={
        "task_input": "What is RAG and how does it reduce hallucination?",
        "retrieval_noise": False,
        "context_truncation": False,
        "agent_loop": False,
        "run_id": "",
    },
    connect_domains=[ORCHESTRATOR_URL],
) as app:
    with Column(gap=0, css_class="min-h-screen bg-muted/30"):

        # ── Top nav ──────────────────────────────────────────────────────
        with Div(css_class="sticky top-0 z-50 border-b bg-background/90 backdrop-blur px-6 py-3"):
            with Row(justify="between", css_class="items-center max-w-5xl mx-auto"):
                with Row(gap=2, css_class="items-center"):
                    Icon("bot", size="default")
                    with Column(gap=0):
                        Text("AgentOps Playground", bold=True)
                        Muted("Ollama · MCP · RAG")
                Muted("AI agent diagnostic platform")

        # ── Page body ────────────────────────────────────────────────────
        with Column(gap=6, css_class="max-w-5xl mx-auto w-full px-6 py-8"):

            # ── Config panel ─────────────────────────────────────────────
            with Card():
                with CardHeader():
                    CardTitle("Configure Task")
                    CardDescription("Enter a task and optionally inject failure modes to stress-test the agent pipeline.")
                with CardContent():
                    with Column(gap=5):

                        Textarea(
                            name="task_input",
                            placeholder="e.g. What is RAG and how does it reduce hallucination?",
                            rows=3,
                            value="{{ task_input }}",
                        )

                        with Div(css_class="rounded-md border p-4 bg-muted/40"):
                            with Column(gap=3):
                                with Row(gap=2, css_class="items-center"):
                                    Icon("flask-conical", size="sm")
                                    Text("Failure Modes", bold=True)
                                Muted("Enable faults to observe how each layer degrades output.")
                                with Row(gap=6, css_class="pt-1"):
                                    Checkbox(name="retrieval_noise",    label="Retrieval Noise")
                                    Checkbox(name="context_truncation", label="Context Truncation")
                                    Checkbox(name="agent_loop",         label="Agent Loop")

                                with If("retrieval_noise"):
                                    with Alert(variant="warning", icon="triangle-alert"):
                                        AlertDescription("3 unrelated documents (French Revolution, Photosynthesis, speed of light) will be appended to every retrieve_docs result, polluting the LLM's context with irrelevant evidence.")

                                with If("context_truncation"):
                                    with Alert(variant="warning", icon="triangle-alert"):
                                        AlertDescription("The message history sent to the LLM is truncated to the last 2 messages before each call. The system prompt and original question are dropped — the model reasons without knowing what it was asked.")

                                with If("agent_loop"):
                                    with Alert(variant="warning", icon="triangle-alert"):
                                        AlertDescription("Ollama temperature is raised to 1.5, making the model erratic. The early-exit condition is also suppressed — the agent keeps calling tools until it hits MAX_STEPS (10) and returns \"Max steps reached\".")

                        Button(
                            "Run Agent",
                            icon="play",
                            variant="default",
                            size="lg",
                            css_class="w-full",
                            onClick=[
                                SetState("run_id", ""),
                                Fetch.post(
                                    f"{ORCHESTRATOR_URL}/run/start",
                                    body={
                                        "task": "{{ task_input }}",
                                        "failureModes": {
                                            "retrieval_noise": "{{ retrieval_noise }}",
                                            "context_truncation": "{{ context_truncation }}",
                                            "agent_loop": "{{ agent_loop }}",
                                        },
                                    },
                                    onSuccess=SetState("run_id", RESULT["run_id"]),
                                    onError=ShowToast("Failed to start: {{ $error }}", variant="error"),
                                ),
                            ],
                        )

            # ── Trace viewer (React) ─────────────────────────────────────
            with If("run_id"):
                Embed(
                    url=f"{TRACE_VIEWER_URL}?run_id={{{{ run_id }}}}",
                    width="100%",
                    height="800px",
                )

        # ── Footer ───────────────────────────────────────────────────────
        with Div(css_class="border-t bg-background px-6 py-3 mt-auto"):
            with Row(justify="between", css_class="items-center max-w-5xl mx-auto"):
                Muted("AgentOps Playground — personal R&D")
                Muted("Ollama · MCP · RAG")
