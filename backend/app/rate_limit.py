import time
from collections import defaultdict

WINDOW_SECONDS = 5 * 60
MAX_ATTEMPTS = 10

_attempts: dict[str, list[float]] = defaultdict(list)


def _prune(key: str, now: float) -> list[float]:
    recent = [t for t in _attempts[key] if now - t < WINDOW_SECONDS]
    _attempts[key] = recent
    return recent


def seconds_until_allowed(key: str) -> int:
    """Returns 0 if the key may attempt now, otherwise seconds until the oldest attempt ages out."""
    now = time.time()
    recent = _prune(key, now)
    if len(recent) < MAX_ATTEMPTS:
        return 0
    return max(1, int(WINDOW_SECONDS - (now - recent[0])))


def record_attempt(key: str) -> None:
    _attempts[key].append(time.time())


def reset(key: str) -> None:
    _attempts.pop(key, None)


def _keys_for_username(username: str) -> list[str]:
    suffix = f":{username}"
    return [k for k in _attempts if k.endswith(suffix)]


def is_username_locked(username: str) -> bool:
    now = time.time()
    return any(len(_prune(k, now)) >= MAX_ATTEMPTS for k in _keys_for_username(username))


def unlock_username(username: str) -> int:
    keys = _keys_for_username(username)
    for k in keys:
        _attempts.pop(k, None)
    return len(keys)
