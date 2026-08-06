import json
import subprocess
import xml.etree.ElementTree as ET
from dataclasses import dataclass

import httpx

from app.claude_cli import resolve_claude_binary

DEFAULT_BEDROCK_MODEL = "anthropic.claude-3-5-sonnet-20241022-v2:0"
DEFAULT_BEDROCK_REGION = "us-east-1"


@dataclass
class AiConfig:
    """Which AI provider to use and, for Bedrock, the credentials to use it with.
    Built fresh from the AppSettings row on every call rather than cached in env vars —
    there's nothing left to bridge into the process environment now that Bedrock is a
    plain HTTPS call, not something boto3/litellm reads out of os.environ."""

    provider: str = "claude_cli"
    bedrock_api_key: str | None = None
    bedrock_region: str | None = None
    bedrock_model: str | None = None

    @classmethod
    def from_settings(cls, settings) -> "AiConfig":
        if settings is None:
            return cls()
        return cls(
            provider=settings.ai_provider,
            bedrock_api_key=settings.bedrock_api_key,
            bedrock_region=settings.bedrock_region,
            bedrock_model=settings.bedrock_model,
        )


def _bedrock_converse(config: AiConfig, system_prompt: str | None, messages: list[dict[str, str]]) -> str:
    """Calls the Bedrock Runtime Converse API directly over HTTPS using an AWS Bedrock API
    key (a bearer token) — no boto3, no AWS SigV4 request signing, no Access Key ID/Secret
    Access Key pair. See https://docs.aws.amazon.com/bedrock/latest/userguide/api-keys.html."""
    if not config.bedrock_api_key:
        raise RuntimeError("No AWS Bedrock API key configured. Add one in Settings → AI Provider → AWS Bedrock.")

    region = config.bedrock_region or DEFAULT_BEDROCK_REGION
    model = (config.bedrock_model or DEFAULT_BEDROCK_MODEL).removeprefix("bedrock/")
    url = f"https://bedrock-runtime.{region}.amazonaws.com/model/{model}/converse"

    body: dict = {
        "messages": [
            {
                "role": m["role"] if m["role"] in ("user", "assistant") else "user",
                "content": [{"text": m["content"]}],
            }
            for m in messages
        ]
    }
    if system_prompt:
        body["system"] = [{"text": system_prompt}]

    try:
        response = httpx.post(
            url,
            headers={"Authorization": f"Bearer {config.bedrock_api_key}", "Content-Type": "application/json"},
            json=body,
            timeout=60,
        )
    except httpx.HTTPError as exc:
        raise RuntimeError(f"Could not reach AWS Bedrock ({exc}). Check the region ('{region}').") from exc

    if response.status_code != 200:
        detail = response.text.strip()
        try:
            detail = response.json().get("message", detail)
        except ValueError:
            pass
        raise RuntimeError(
            f"AWS Bedrock returned {response.status_code}: {detail} — check the API key, region ('{region}'), "
            f"and model id ('{model}') in Settings → AI Provider."
        )

    data = response.json()
    try:
        return data["output"]["message"]["content"][0]["text"]
    except (KeyError, IndexError, TypeError) as exc:
        raise RuntimeError(f"AWS Bedrock returned an unexpected response shape: {data}") from exc


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


def draft_content(current_content: str, instruction: str, config: AiConfig) -> str:
    if config.provider == "bedrock":
        user_msg = f"Current template content:\n\n{current_content}\n\n---\n\nInstruction: {instruction}"
        return _bedrock_converse(config, SYSTEM_PROMPT, [{"role": "user", "content": user_msg}])
    return _draft_via_claude_cli(current_content, instruction)


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


def draft_diagram_xml(instruction: str, cloud: str, config: AiConfig) -> str:
    raw = (
        _bedrock_converse(config, _diagram_system_prompt(cloud), [{"role": "user", "content": instruction}])
        if config.provider == "bedrock"
        else _draft_diagram_via_claude_cli(instruction, cloud)
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


def chat_reply(messages: list[dict[str, str]], config: AiConfig) -> str:
    if config.provider == "bedrock":
        return _bedrock_converse(config, CHAT_SYSTEM_PROMPT, messages)
    return _chat_via_claude_cli(messages)


def test_connection(config: AiConfig) -> str:
    """Makes one minimal request through the configured provider and returns its reply.
    Backs Settings' "Test Connection" button — saving credentials only confirms they were
    written to the database, not that they actually authenticate, so this makes the one
    real call needed to tell the two apart."""
    probe = [{"role": "user", "content": "Reply with only the single word: OK"}]
    if config.provider == "bedrock":
        return _bedrock_converse(config, None, probe)
    return _chat_via_claude_cli(probe)


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


def extract_project_from_chat(messages: list[dict[str, str]], config: AiConfig) -> dict[str, str]:
    raw = (
        _bedrock_converse(config, EXTRACT_PROJECT_SYSTEM_PROMPT, messages)
        if config.provider == "bedrock"
        else _extract_project_via_claude_cli(messages)
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
