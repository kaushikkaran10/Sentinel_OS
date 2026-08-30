"""Pydantic models for the agent's prompted-JSON structured output.

8_Decisions_2.md §3: small quantized local models hallucinate native tool calls,
so the graph never uses ``.bind_tools()``. Instead every LLM that needs to make a
decision is asked for a JSON object and the reply is validated against one of
these models. A ``ValidationError`` here is a clean, catchable signal that the
model misbehaved — the calling node then falls back (see ``structured.parse_as``).
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

# The four fixed MVP tools (CLAUDE.md — "Tool list is fixed for MVP").
ToolName = Literal[
    "query_local_knowledge",
    "execute_sandbox_code",
    "generate_approval_note",
    "generate_metrics_sheet",
]


class RouterDecision(BaseModel):
    """Router node output — which execution branch a task belongs to.

    ``task_type`` uses the vocabulary of 4_Agent_Logic_&_Tools.md §1
    (``vision`` / ``code`` / ``draft``); ``router.select_branch`` maps it to the
    graph node name.
    """

    model_config = ConfigDict(extra="ignore")

    task_type: Literal["vision", "code", "draft"]
    reason: str = ""


class AgentDecision(BaseModel):
    """Drafter node output — either call one tool, or finish with an answer.

    Deliberately lenient (a single model with a post-validator rather than a
    strict discriminated union): a 7B model will happily emit
    ``{"action": "final", "answer": "...", "tool": null}`` and that should still
    parse.
    """

    model_config = ConfigDict(extra="ignore")

    action: Literal["tool", "final"]
    tool: ToolName | None = None
    args: dict[str, Any] = Field(default_factory=dict)
    answer: str | None = None

    @model_validator(mode="after")
    def _coherent(self) -> "AgentDecision":
        if self.action == "tool" and not self.tool:
            raise ValueError("action='tool' requires a 'tool' name")
        if self.action == "final" and not (self.answer and self.answer.strip()):
            raise ValueError("action='final' requires a non-empty 'answer'")
        return self


# ── Per-tool argument models ────────────────────────────────────────────────
#   Validated in tools.run_tool() so a malformed ``args`` dict from the LLM is a
#   ValidationError (→ graceful "Tool error: ..." string), never a TypeError at
#   the call site. Field names match the real function signatures exactly so
#   ``model_dump()`` can be splatted straight in as kwargs.


class QueryArgs(BaseModel):
    model_config = ConfigDict(extra="ignore")
    query: str


class SandboxArgs(BaseModel):
    model_config = ConfigDict(extra="ignore")
    python_code: str


class ApprovalNoteArgs(BaseModel):
    model_config = ConfigDict(extra="ignore")
    summary: str
    metrics: dict[str, Any] = Field(default_factory=dict)


class MetricsSheetArgs(BaseModel):
    model_config = ConfigDict(extra="ignore")
    data: list[dict[str, Any]]
