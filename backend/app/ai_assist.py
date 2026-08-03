import os
import subprocess

import litellm

from app.claude_cli import resolve_claude_binary

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


def _draft_via_litellm(current_content: str, instruction: str) -> str:
    model = os.getenv("LITELLM_MODEL", "gpt-4o-mini")
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
            f"{exc} — configure a provider API key in backend/.env (model is '{model}'), "
            f"or switch to Claude CLI mode in Settings."
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
    return _draft_via_litellm(current_content, instruction)


CHAT_SYSTEM_PROMPT = (
    "You are an AI solution architect assistant inside an internal tool called SA Generator. "
    "You help architects scope cloud solutions by having a conversation with them: ask clarifying "
    "questions about cloud provider, regions, compute, networking, and compliance needs when "
    "something material is missing, and summarize what you've captured so far when it's useful. "
    "Keep replies conversational and concise (a few sentences or a short list, not a full document). "
    "Once you have enough to describe the solution, say so plainly and suggest the architect start "
    "a project from it — you are not generating the actual documents in this chat."
)


def _chat_via_litellm(messages: list[dict[str, str]]) -> str:
    model = os.getenv("LITELLM_MODEL", "gpt-4o-mini")
    try:
        response = litellm.completion(
            model=model,
            messages=[{"role": "system", "content": CHAT_SYSTEM_PROMPT}, *messages],
        )
    except Exception as exc:  # noqa: BLE001 - surface provider errors verbatim to the caller
        raise RuntimeError(
            f"{exc} — configure a provider API key in backend/.env (model is '{model}'), "
            f"or switch to Claude CLI mode in Settings."
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
    return _chat_via_litellm(messages)
