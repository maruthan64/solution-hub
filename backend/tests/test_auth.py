import pytest
from fastapi import HTTPException

from app.auth import create_token, decode_token, hash_password, verify_password


class TestPasswordHashing:
    def test_verify_correct_password(self):
        h = hash_password("correct-horse-battery-staple")
        assert verify_password("correct-horse-battery-staple", h) is True

    def test_verify_wrong_password(self):
        h = hash_password("correct-horse-battery-staple")
        assert verify_password("wrong-password", h) is False

    def test_hash_is_not_the_plaintext(self):
        h = hash_password("secret")
        assert h != "secret"


class TestTokens:
    def test_roundtrip(self):
        token = create_token("user-123")
        assert decode_token(token) == "user-123"

    def test_tampered_token_rejected(self):
        token = create_token("user-123")
        tampered = token[:-1] + ("A" if token[-1] != "A" else "B")
        with pytest.raises(HTTPException) as exc_info:
            decode_token(tampered)
        assert exc_info.value.status_code == 401

    def test_garbage_token_rejected(self):
        with pytest.raises(HTTPException) as exc_info:
            decode_token("not-a-real-jwt")
        assert exc_info.value.status_code == 401
