import uuid

from app.rate_limit import MAX_ATTEMPTS, record_attempt, reset, seconds_until_allowed


def _fresh_key() -> str:
    # Unique per test so the module-level in-memory _attempts dict never leaks
    # state between tests (there's no per-test reset hook for it).
    return f"test-ip:{uuid.uuid4().hex}"


class TestRateLimit:
    def test_allowed_initially(self):
        key = _fresh_key()
        assert seconds_until_allowed(key) == 0

    def test_allowed_below_max_attempts(self):
        key = _fresh_key()
        for _ in range(MAX_ATTEMPTS - 1):
            record_attempt(key)
        assert seconds_until_allowed(key) == 0

    def test_locked_at_max_attempts(self):
        key = _fresh_key()
        for _ in range(MAX_ATTEMPTS):
            record_attempt(key)
        assert seconds_until_allowed(key) > 0

    def test_reset_clears_lockout(self):
        key = _fresh_key()
        for _ in range(MAX_ATTEMPTS):
            record_attempt(key)
        assert seconds_until_allowed(key) > 0
        reset(key)
        assert seconds_until_allowed(key) == 0
