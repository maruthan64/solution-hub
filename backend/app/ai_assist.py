import json
import os
import subprocess
import xml.etree.ElementTree as ET

import litellm

from app.claude_cli import resolve_claude_binary


def _resolve_model(provider: str) -> str:
    """Bedrock is just another litellm.completion() model string (a bedrock/... one) with its
    own env var, so it shares every _via_litellm function below rather than duplicating them."""
    if provider == "bedrock":
        return os.getenv("BEDROCK_MODEL", "bedrock/anthropic.claude-3-haiku-20240307-v1:0")
    return os.getenv("LITELLM_MODEL", "gpt-4o-mini")


SYSTEM_PROMPT = (
    "You are an assistant helping a solution architect fill in a cloud solution documentation "
    "template. The caller inserts your response directly into the document, so you must always "
    "return drafted Markdown content for what was asked — never a clarifying question, never a "
    "refusal, and never a request for more information. If the instruction is vague, ambiguous, "
    "or missing details, make reasonable, explicit, industry-standard assumptions (state them "
    "inline, e.g. '_Assuming a single-region AWS deployment with RDS PostgreSQL._') and draft "
    "the best content you can from those assumptions — the architect can correct anything wrong "
    "afterward. Return only the drafted content itself — no commentary, no preamble, no code "
    "fences around the whole response."
)


def _draft_via_litellm(current_content: str, instruction: str, provider: str = "litellm") -> str:
    model = _resolve_model(provider)
    try:
        response = litellm.completion(
            model=model,
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": f"Current template content:\n\n{current_content}\n\n---\n\nInstruction: {instruction}",
                },
            ],
        )
    except Exception as exc:  # noqa: BLE001 - surface provider errors verbatim to the caller
        raise RuntimeError(
            f"{exc} — check the credentials for '{model}' in backend/.env (a provider API key for "
            f"LiteLLM, or AWS credentials/an IAM role for Bedrock), or switch providers in Settings."
        ) from exc

    return response["choices"][0]["message"]["content"]


def _draft_via_claude_cli(current_content: str, instruction: str) -> str:
    claude_bin = resolve_claude_binary()
    if claude_bin is None:
        raise RuntimeError(
            "The 'claude' CLI was not found. Set CLAUDE_CLI_PATH in backend/.env to its full path, or make sure "
            "its directory is on PATH for the backend process, then run `claude login` if not already logged in."
        )

    prompt = f"{SYSTEM_PROMPT}\n\nCurrent template content:\n\n{current_content}\n\n---\n\nInstruction: {instruction}"
    try:
        result = subprocess.run(
            [claude_bin, "-p", prompt],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Claude CLI timed out after 120s.") from exc

    if result.returncode != 0:
        raise RuntimeError(f"Claude CLI exited {result.returncode}: {(result.stderr or result.stdout).strip()}")

    return result.stdout.strip()


def draft_content(current_content: str, instruction: str, provider: str = "litellm") -> str:
    if provider == "claude_cli":
        return _draft_via_claude_cli(current_content, instruction)
    return _draft_via_litellm(current_content, instruction, provider)


DIAGRAM_SYSTEM_PROMPT_TEMPLATE = (
    "You generate architecture diagrams for a solution architect as draw.io / diagrams.net "
    'mxGraph XML. Return ONLY a single <mxGraphModel>...</mxGraphModel> XML document — no '
    "markdown code fences, no prose, no explanation before or after it.\n\n"
    'Structure: one <root> containing <mxCell id="0"/>, <mxCell id="1" parent="0"/>, then one '
    '<mxCell> per box (vertex="1" parent="1") with an <mxGeometry> child, and one <mxCell> per '
    'connector (edge="1" parent="1" source="..." target="...") with an empty '
    '<mxGeometry relative="1"/>. Lay boxes out left-to-right or top-to-bottom by incrementing '
    "x/y in the geometry so nothing overlaps (each box roughly 120x80, at least 160px apart).\n\n"
    "Cloud provider for this diagram: {cloud}. Style each box using real {cloud} icons if you "
    "are confident of the exact stencil name ({stencil_hint}); if you are not certain of the "
    "exact icon name, use a plain readable box instead "
    '(style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;") with the '
    "service name as the value — a plain labeled box is always better than a broken or unknown "
    "stencil reference.\n\n"
    "Example skeleton to follow the shape of (adapt the boxes/labels/count/style to the "
    "instruction — do not copy these two nodes verbatim):\n"
    '<mxGraphModel dx="800" dy="600" grid="1" gridSize="10" page="1" pageWidth="850" '
    'pageHeight="1100">\n  <root>\n    <mxCell id="0" />\n    <mxCell id="1" parent="0" />\n'
    '    <mxCell id="2" value="Web App" '
    'style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;" vertex="1" '
    'parent="1">\n      <mxGeometry x="120" y="120" width="120" height="80" as="geometry" />\n'
    '    </mxCell>\n    <mxCell id="3" value="Database" '
    'style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" vertex="1" '
    'parent="1">\n      <mxGeometry x="320" y="120" width="120" height="80" as="geometry" />\n'
    '    </mxCell>\n    <mxCell id="4" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;" '
    'edge="1" parent="1" source="2" target="3">\n      <mxGeometry relative="1" as="geometry" '
    "/>\n    </mxCell>\n  </root>\n</mxGraphModel>"
)

_DIAGRAM_STENCIL_HINTS = {
    "aws": "shape=mxgraph.aws4.resourceIcon;resIcon=mxgraph.aws4.<name>, e.g. ec2, rds, s3, "
    "lambda, elb_application_load_balancer, vpc",
    "azure": "shape=mxgraph.azure.<name>, e.g. virtual_machine, sql_database, storage_accounts, "
    "app_services",
    "gcp": "shape=mxgraph.gcp2.<name>, e.g. compute_engine, cloud_sql, cloud_storage, "
    "cloud_functions",
}


def _diagram_system_prompt(cloud: str) -> str:
    key = (cloud or "").strip().lower()
    stencil_hint = _DIAGRAM_STENCIL_HINTS.get(key, "no specific stencil family for this provider — always use plain labeled boxes")
    return DIAGRAM_SYSTEM_PROMPT_TEMPLATE.format(cloud=cloud or "generic", stencil_hint=stencil_hint)


def _draft_diagram_via_litellm(instruction: str, cloud: str, provider: str = "litellm") -> str:
    model = _resolve_model(provider)
    try:
        response = litellm.completion(
            model=model,
            messages=[
                {"role": "system", "content": _diagram_system_prompt(cloud)},
                {"role": "user", "content": instruction},
            ],
        )
    except Exception as exc:  # noqa: BLE001 - surface provider errors verbatim to the caller
        raise RuntimeError(
            f"{exc} — check the credentials for '{model}' in backend/.env (a provider API key for "
            f"LiteLLM, or AWS credentials/an IAM role for Bedrock), or switch providers in Settings."
        ) from exc

    return response["choices"][0]["message"]["content"]


def _draft_diagram_via_claude_cli(instruction: str, cloud: str) -> str:
    claude_bin = resolve_claude_binary()
    if claude_bin is None:
        raise RuntimeError(
            "The 'claude' CLI was not found. Set CLAUDE_CLI_PATH in backend/.env to its full path, or make sure "
            "its directory is on PATH for the backend process, then run `claude login` if not already logged in."
        )

    prompt = f"{_diagram_system_prompt(cloud)}\n\nInstruction: {instruction}"
    try:
        result = subprocess.run(
            [claude_bin, "-p", prompt],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Claude CLI timed out after 120s.") from exc

    if result.returncode != 0:
        raise RuntimeError(f"Claude CLI exited {result.returncode}: {(result.stderr or result.stdout).strip()}")

    return result.stdout.strip()


def _extract_xml(raw: str) -> str:
    """Strip stray markdown code fences some models add despite instructions to the contrary."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


def draft_diagram_xml(instruction: str, cloud: str, provider: str = "litellm") -> str:
    raw = (
        _draft_diagram_via_claude_cli(instruction, cloud)
        if provider == "claude_cli"
        else _draft_diagram_via_litellm(instruction, cloud, provider)
    )

    xml_text = _extract_xml(raw)
    try:
        ET.fromstring(xml_text)
    except ET.ParseError as exc:
        raise RuntimeError(f"AI returned invalid diagram XML ({exc}). Try rephrasing the instruction.") from exc

    return xml_text


CHAT_SYSTEM_PROMPT = (
    "You are an AI solution architect assistant inside an internal tool called CloudSolution Hub. "
    "You help architects scope cloud solutions by having a conversation with them: ask clarifying "
    "questions about cloud provider, regions, compute, networking, and compliance needs when "
    "something material is missing, and summarize what you've captured so far when it's useful. "
    "Keep replies conversational and concise (a few sentences or a short list, not a full document). "
    "Once you have enough to describe the solution, say so plainly and suggest the architect start "
    "a project from it — you are not generating the actual documents in this chat."
)


def _chat_via_litellm(messages: list[dict[str, str]], provider: str = "litellm") -> str:
    model = _resolve_model(provider)
    try:
        response = litellm.completion(
            model=model,
            messages=[{"role": "system", "content": CHAT_SYSTEM_PROMPT}, *messages],
        )
    except Exception as exc:  # noqa: BLE001 - surface provider errors verbatim to the caller
        raise RuntimeError(
            f"{exc} — check the credentials for '{model}' in backend/.env (a provider API key for "
            f"LiteLLM, or AWS credentials/an IAM role for Bedrock), or switch providers in Settings."
        ) from exc

    return response["choices"][0]["message"]["content"]


def _chat_via_claude_cli(messages: list[dict[str, str]]) -> str:
    claude_bin = resolve_claude_binary()
    if claude_bin is None:
        raise RuntimeError(
            "The 'claude' CLI was not found. Set CLAUDE_CLI_PATH in backend/.env to its full path, or make sure "
            "its directory is on PATH for the backend process, then run `claude login` if not already logged in."
        )

    transcript = "\n\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
    prompt = f"{CHAT_SYSTEM_PROMPT}\n\nConversation so far:\n\n{transcript}\n\nASSISTANT:"
    try:
        result = subprocess.run(
            [claude_bin, "-p", prompt],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Claude CLI timed out after 120s.") from exc

    if result.returncode != 0:
        raise RuntimeError(f"Claude CLI exited {result.returncode}: {(result.stderr or result.stdout).strip()}")

    return result.stdout.strip()


def chat_reply(messages: list[dict[str, str]], provider: str = "litellm") -> str:
    if provider == "claude_cli":
        return _chat_via_claude_cli(messages)
    return _chat_via_litellm(messages, provider)


EXTRACT_PROJECT_SYSTEM_PROMPT = (
    "You read a conversation between a solution architect and an AI scoping assistant, and "
    "summarize it into a starting point for a new Project record. Return ONLY a single JSON "
    'object — no markdown code fences, no prose before or after it — with exactly these four '
    'string keys: "name" (a short project name, e.g. "Acme Retail Platform Migration"), '
    '"customer" (the customer/company name if mentioned, else an empty string), "cloud" (one '
    'of "AWS", "Azure", "GCP", "Multi-Cloud" if a cloud provider was discussed, else an empty '
    'string), and "description" (a 1-3 sentence summary of what\'s being built). If the '
    "conversation doesn't cover something, leave that field as an empty string rather than "
    "guessing — the architect will review and fill in gaps themselves before the project is "
    "created."
)


def _extract_json(raw: str) -> str:
    """Strip stray markdown code fences some models add despite instructions to the contrary."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else ""
        if text.endswith("```"):
            text = text.rsplit("```", 1)[0]
    return text.strip()


def _extract_project_via_litellm(messages: list[dict[str, str]], provider: str = "litellm") -> str:
    model = _resolve_model(provider)
    try:
        response = litellm.completion(
            model=model,
            messages=[{"role": "system", "content": EXTRACT_PROJECT_SYSTEM_PROMPT}, *messages],
        )
    except Exception as exc:  # noqa: BLE001 - surface provider errors verbatim to the caller
        raise RuntimeError(
            f"{exc} — check the credentials for '{model}' in backend/.env (a provider API key for "
            f"LiteLLM, or AWS credentials/an IAM role for Bedrock), or switch providers in Settings."
        ) from exc

    return response["choices"][0]["message"]["content"]


def _extract_project_via_claude_cli(messages: list[dict[str, str]]) -> str:
    claude_bin = resolve_claude_binary()
    if claude_bin is None:
        raise RuntimeError(
            "The 'claude' CLI was not found. Set CLAUDE_CLI_PATH in backend/.env to its full path, or make sure "
            "its directory is on PATH for the backend process, then run `claude login` if not already logged in."
        )

    transcript = "\n\n".join(f"{m['role'].upper()}: {m['content']}" for m in messages)
    prompt = f"{EXTRACT_PROJECT_SYSTEM_PROMPT}\n\nConversation:\n\n{transcript}"
    try:
        result = subprocess.run(
            [claude_bin, "-p", prompt],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Claude CLI timed out after 120s.") from exc

    if result.returncode != 0:
        raise RuntimeError(f"Claude CLI exited {result.returncode}: {(result.stderr or result.stdout).strip()}")

    return result.stdout.strip()


def extract_project_from_chat(messages: list[dict[str, str]], provider: str = "litellm") -> dict[str, str]:
    raw = (
        _extract_project_via_claude_cli(messages)
        if provider == "claude_cli"
        else _extract_project_via_litellm(messages, provider)
    )

    text = _extract_json(raw)
    try:
        data = json.loads(text)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"AI returned invalid JSON while summarizing the conversation ({exc}).") from exc

    if not isinstance(data, dict):
        raise RuntimeError("AI returned unexpected JSON while summarizing the conversation (expected an object).")

    return {
        "name": str(data.get("name") or ""),
        "customer": str(data.get("customer") or ""),
        "cloud": str(data.get("cloud") or ""),
        "description": str(data.get("description") or ""),
    }
