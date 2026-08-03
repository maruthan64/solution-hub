import re
import shlex
import subprocess
import threading
import time
import uuid

from app.claude_cli import resolve_claude_binary

CONNECTOR_LINE = re.compile(r"^(.+?):\s+(\S+)\s+-\s+(.+)$")

# Holds subprocesses for in-progress `claude mcp login --no-browser` flows,
# keyed by a session id. A login is a two-step dance: start it (get the auth
# URL), the user authorizes in their browser and copies back the redirect
# URL, then we feed that back into the still-running process's stdin.
# In-memory only — restarting the backend (e.g. --reload) drops any pending
# session, which is an acceptable tradeoff for a single-admin dev tool.
_pending_logins: dict[str, dict] = {}


def _require_claude_binary() -> str:
    claude_bin = resolve_claude_binary()
    if claude_bin is None:
        raise RuntimeError(
            "The 'claude' CLI was not found. Set CLAUDE_CLI_PATH in backend/.env to its full path, "
            "or make sure its directory is on PATH for the backend process."
        )
    return claude_bin


def list_raw() -> str:
    claude_bin = _require_claude_binary()
    try:
        result = subprocess.run(
            [claude_bin, "mcp", "list"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=30,
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError("Timed out listing MCP connectors.") from exc
    return result.stdout


def parse_connectors(raw: str) -> list[dict]:
    connectors = []
    for line in raw.splitlines():
        line = line.strip()
        if not line or ":" not in line:
            continue
        m = CONNECTOR_LINE.match(line)
        if not m:
            continue
        name, url, status_text = m.groups()
        status_text = status_text.strip()
        lowered = status_text.lower()
        if "connected" in lowered:
            status = "connected"
        elif "auth" in lowered:
            status = "needs_auth"
        elif "pending" in lowered:
            status = "pending"
        else:
            status = "unknown"
        connectors.append(
            {
                "name": name,
                "url": url,
                "status": status,
                "statusText": status_text,
                "category": "claude_ai" if name.startswith("claude.ai ") else "custom",
            }
        )
    return connectors


def start_reauth(name: str) -> dict:
    claude_bin = _require_claude_binary()
    proc = subprocess.Popen(
        [claude_bin, "mcp", "login", name, "--no-browser"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding="utf-8",
        errors="replace",
        bufsize=1,
    )
    buffer: list[str] = []
    lock = threading.Lock()

    def _reader() -> None:
        assert proc.stdout is not None
        for line in iter(proc.stdout.readline, ""):
            with lock:
                buffer.append(line)

    threading.Thread(target=_reader, daemon=True).start()

    auth_url = None
    deadline = time.time() + 15
    while time.time() < deadline:
        with lock:
            text = "".join(buffer)
        m = re.search(r"https?://\S+", text)
        if m:
            auth_url = m.group(0)
            break
        if proc.poll() is not None:
            break
        time.sleep(0.3)

    session_id = uuid.uuid4().hex
    _pending_logins[session_id] = {"proc": proc, "buffer": buffer, "lock": lock}

    with lock:
        output = "".join(buffer)

    return {"sessionId": session_id, "authUrl": auth_url, "output": None if auth_url else output}


def complete_reauth(session_id: str, redirect_url: str) -> dict:
    entry = _pending_logins.pop(session_id, None)
    if not entry:
        raise RuntimeError("No pending login session found — it may have expired. Try reconnecting again.")

    proc: subprocess.Popen = entry["proc"]
    buffer: list[str] = entry["buffer"]
    lock: threading.Lock = entry["lock"]

    try:
        assert proc.stdin is not None
        proc.stdin.write(redirect_url.strip() + "\n")
        proc.stdin.flush()
    except Exception as exc:  # noqa: BLE001
        raise RuntimeError(f"Failed to submit the redirect URL: {exc}") from exc

    try:
        proc.wait(timeout=20)
    except subprocess.TimeoutExpired:
        pass

    with lock:
        output = "".join(buffer)

    return {"success": proc.returncode == 0, "output": output}


def add_server(name: str, transport: str, command_or_url: str) -> None:
    claude_bin = _require_claude_binary()

    # --scope user: registers globally for the account rather than "local"
    # (private to whatever directory the backend process's CWD happens to be
    # at add-time) — otherwise servers added here can silently not show up
    # in `claude mcp list` run from a different working directory.
    if transport == "stdio":
        parts = shlex.split(command_or_url)
        if not parts:
            raise RuntimeError("Command cannot be empty.")
        args = [claude_bin, "mcp", "add", "--scope", "user", name, "--", *parts]
    elif transport in ("http", "sse"):
        args = [claude_bin, "mcp", "add", "--scope", "user", "--transport", transport, name, command_or_url]
    else:
        raise RuntimeError("transport must be 'stdio', 'http', or 'sse'")

    result = subprocess.run(args, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=20)
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout).strip() or "claude mcp add failed")


def get_server_detail(name: str) -> dict:
    claude_bin = _require_claude_binary()
    result = subprocess.run(
        [claude_bin, "mcp", "get", name],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=15,
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout).strip() or "claude mcp get failed")

    text = result.stdout
    type_match = re.search(r"^\s*Type:\s*(\S+)", text, re.MULTILINE)
    transport = type_match.group(1) if type_match else "stdio"

    if transport == "stdio":
        cmd_match = re.search(r"^\s*Command:\s*(.+)$", text, re.MULTILINE)
        args_match = re.search(r"^\s*Args:\s*(.*)$", text, re.MULTILINE)
        command = cmd_match.group(1).strip() if cmd_match else ""
        args = args_match.group(1).strip() if args_match else ""
        command_or_url = f"{command} {args}".strip()
    else:
        url_match = re.search(r"^\s*URL:\s*(\S+)", text, re.MULTILINE)
        command_or_url = url_match.group(1) if url_match else ""

    return {"name": name, "transport": transport, "commandOrUrl": command_or_url}


def remove_server(name: str) -> None:
    claude_bin = _require_claude_binary()
    result = subprocess.run(
        [claude_bin, "mcp", "remove", name],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=20,
    )
    if result.returncode != 0:
        raise RuntimeError((result.stderr or result.stdout).strip() or "claude mcp remove failed")
