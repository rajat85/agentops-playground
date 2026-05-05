"""AgentOps Playground — Prefab UI dashboard.

Serves at http://127.0.0.1:5175 via:
    uv run prefab serve app.py
"""

from prefab_ui import PrefabApp
from prefab_ui.components import (
    Alert,
    AlertDescription,
    AlertTitle,
    Badge,
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    Checkbox,
    Column,
    ForEach,
    Heading,
    If,
    Else,
    Row,
    Separator,
    Text,
    Textarea,
)
from prefab_ui.actions import Fetch, SetState, ShowToast
from prefab_ui.rx import RESULT, Rx

BRIDGE_URL = "http://localhost:8000"

with PrefabApp(
    title="AgentOps Playground",
    state={
        "task_input": "What are the main features of AgentOps?",
        "retrieval_noise": False,
        "context_truncation": False,
        "agent_loop": False,
        "result": None,
        "loading": False,
        "error_msg": "",
    },
    connect_domains=[BRIDGE_URL],
) as app:
    with Column(gap=6):
        # ── Header ──────────────────────────────────────────────────────
        Heading("AgentOps Playground", level=1)
        Text("Submit a task to run through the agent pipeline and inspect the trace.")

        Separator()

        # ── Task Input Card ──────────────────────────────────────────────
        with Card():
            with CardHeader():
                CardTitle("Task")
            with CardContent():
                with Column(gap=4):
                    Textarea(
                        name="task_input",
                        placeholder="Enter your task here...",
                        rows=5,
                        value="{{ task_input }}",
                    )

                    # ── Failure Mode Checkboxes ──────────────────────────
                    Heading("Failure Modes", level=3)
                    Text(
                        "Enable one or more failure modes to test agent robustness.",
                        italic=True,
                    )
                    with Row():
                        Checkbox(
                            name="retrieval_noise",
                            label="Retrieval Noise",
                            value="{{ retrieval_noise }}",
                        )
                        Checkbox(
                            name="context_truncation",
                            label="Context Truncation",
                            value="{{ context_truncation }}",
                        )
                        Checkbox(
                            name="agent_loop",
                            label="Agent Loop",
                            value="{{ agent_loop }}",
                        )

                    Separator()

                    # ── Run Button ───────────────────────────────────────
                    Button(
                        "Run Agent",
                        variant="default",
                        disabled="{{ loading }}",
                        onClick=[
                            SetState("loading", True),
                            SetState("result", None),
                            SetState("error_msg", ""),
                            Fetch.post(
                                f"{BRIDGE_URL}/run",
                                body={
                                    "task": "{{ task_input }}",
                                    "failure_modes": "{{ active_modes }}",
                                },
                                onSuccess=[
                                    SetState("result", RESULT),
                                    SetState("loading", False),
                                ],
                                onError=[
                                    SetState("error_msg", "{{ $error }}"),
                                    SetState("loading", False),
                                    ShowToast("Request failed: {{ $error }}", variant="error"),
                                ],
                            ),
                        ],
                    )

        # ── Loading indicator ────────────────────────────────────────────
        with If("loading"):
            with Alert(variant="default"):
                AlertTitle("Running")
                AlertDescription("Agent pipeline is running… please wait.")

        # ── Error display ────────────────────────────────────────────────
        with If("error_msg"):
            with Alert(variant="destructive"):
                AlertTitle("Error")
                AlertDescription("{{ error_msg }}")

        # ── Results ──────────────────────────────────────────────────────
        with If("result"):
            with Card():
                with CardHeader():
                    CardTitle("Trace")
                with CardContent():
                    with Column(gap=4):

                        # Trace steps
                        with ForEach("result.steps") as step:
                            with Card():
                                with CardContent():
                                    with Row():
                                        Badge(f"{step.role}")
                                        Text(f"{step.content}")

                        Separator()

                        # Final answer
                        Heading("Final Answer", level=3)
                        Text("{{ result.answer }}")

        with Else():
            Text(
                "No results yet. Enter a task above and click Run Agent.",
                italic=True,
            )
