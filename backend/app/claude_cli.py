import os
import shutil


def resolve_claude_binary() -> str | None:
    # CLAUDE_CLI_PATH lets you point at an exact binary when it's installed
    # somewhere not on the backend process's PATH (common on Windows, e.g.
    # ~/.local/bin/claude.exe). Falls back to a plain PATH lookup otherwise.
    configured = os.getenv("CLAUDE_CLI_PATH", "claude")
    if os.path.isabs(configured):
        return configured if os.path.isfile(configured) else None
    return shutil.which(configured)
