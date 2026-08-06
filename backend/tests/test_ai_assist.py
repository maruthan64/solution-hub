import json

import httpx
import pytest

from app import ai_assist
from app.ai_assist import AiConfig


def _fake_bedrock_response(text: str, status_code: int = 200) -> httpx.Response:
    return httpx.Response(
        status_code=status_code,
        json={"output": {"message": {"role": "assistant", "content": [{"text": text}]}}},
        request=httpx.Request("POST", "https://bedrock-runtime.us-east-1.amazonaws.com/model/x/converse"),
    )


def _bedrock_config() -> AiConfig:
    return AiConfig(provider="bedrock", bedrock_api_key="fake-key", bedrock_region="us-east-1", bedrock_model="anthropic.claude-3-5-sonnet-20241022-v2:0")


class TestBedrockConverse:
    def test_sends_bearer_token_and_returns_text(self, monkeypatch):
        captured = {}

        def _fake_post(url, headers=None, json=None, timeout=None):
            captured["url"] = url
            captured["headers"] = headers
            captured["json"] = json
            return _fake_bedrock_response("Hello back")

        monkeypatch.setattr(ai_assist.httpx, "post", _fake_post)

        result = ai_assist._bedrock_converse(_bedrock_config(), "system prompt", [{"role": "user", "content": "hi"}])

        assert result == "Hello back"
        assert captured["headers"]["Authorization"] == "Bearer fake-key"
        assert "anthropic.claude-3-5-sonnet-20241022-v2:0" in captured["url"]
        assert captured["json"]["system"] == [{"text": "system prompt"}]

    def test_missing_api_key_raises_without_a_network_call(self):
        config = AiConfig(provider="bedrock")
        with pytest.raises(RuntimeError, match="No AWS Bedrock API key"):
            ai_assist._bedrock_converse(config, None, [{"role": "user", "content": "hi"}])

    def test_non_200_response_raises_with_detail(self, monkeypatch):
        def _fake_post(url, headers=None, json=None, timeout=None):
            return httpx.Response(
                status_code=403,
                json={"message": "The security token included in the request is invalid."},
                request=httpx.Request("POST", url),
            )

        monkeypatch.setattr(ai_assist.httpx, "post", _fake_post)

        with pytest.raises(RuntimeError, match="security token included in the request is invalid"):
            ai_assist._bedrock_converse(_bedrock_config(), None, [{"role": "user", "content": "hi"}])


class TestExtractProjectFromChat:
    def test_parses_valid_json_response(self, monkeypatch):
        payload = {"name": "Acme Migration", "customer": "Acme Corp", "cloud": "AWS", "description": "Lift and shift."}
        monkeypatch.setattr(ai_assist, "_bedrock_converse", lambda config, system, messages: json.dumps(payload))

        result = ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}], _bedrock_config())
        assert result == payload

    def test_strips_markdown_code_fences(self, monkeypatch):
        payload = {"name": "X", "customer": "Y", "cloud": "GCP", "description": "Z"}
        fenced = f"```json\n{json.dumps(payload)}\n```"
        monkeypatch.setattr(ai_assist, "_bedrock_converse", lambda config, system, messages: fenced)

        result = ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}], _bedrock_config())
        assert result == payload

    def test_missing_fields_fall_back_to_empty_string(self, monkeypatch):
        monkeypatch.setattr(
            ai_assist, "_bedrock_converse", lambda config, system, messages: json.dumps({"name": "Only Name"})
        )

        result = ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}], _bedrock_config())
        assert result == {"name": "Only Name", "customer": "", "cloud": "", "description": ""}

    def test_invalid_json_raises_runtime_error(self, monkeypatch):
        monkeypatch.setattr(ai_assist, "_bedrock_converse", lambda config, system, messages: "not json at all")

        with pytest.raises(RuntimeError):
            ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}], _bedrock_config())

    def test_non_object_json_raises_runtime_error(self, monkeypatch):
        monkeypatch.setattr(
            ai_assist, "_bedrock_converse", lambda config, system, messages: json.dumps(["not", "an", "object"])
        )

        with pytest.raises(RuntimeError):
            ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}], _bedrock_config())


class TestDraftDiagramXml:
    def test_valid_xml_passes_through(self, monkeypatch):
        xml = '<mxGraphModel><root><mxCell id="0" /></root></mxGraphModel>'
        monkeypatch.setattr(ai_assist, "_bedrock_converse", lambda config, system, messages: xml)

        result = ai_assist.draft_diagram_xml("a simple diagram", "AWS", _bedrock_config())
        assert result == xml

    def test_strips_markdown_code_fences(self, monkeypatch):
        xml = '<mxGraphModel><root><mxCell id="0" /></root></mxGraphModel>'
        monkeypatch.setattr(ai_assist, "_bedrock_converse", lambda config, system, messages: f"```xml\n{xml}\n```")

        result = ai_assist.draft_diagram_xml("a simple diagram", "AWS", _bedrock_config())
        assert result == xml

    def test_invalid_xml_raises_runtime_error(self, monkeypatch):
        monkeypatch.setattr(ai_assist, "_bedrock_converse", lambda config, system, messages: "<not><valid xml")

        with pytest.raises(RuntimeError):
            ai_assist.draft_diagram_xml("a simple diagram", "AWS", _bedrock_config())


class TestClaudeCliDispatch:
    """Default provider (claude_cli) should never touch the network — verified by mocking
    subprocess.run rather than httpx, since that's the whole point of the CLI path."""

    def test_draft_content_uses_claude_cli_when_not_bedrock(self, monkeypatch):
        import subprocess

        def _fake_run(*args, **kwargs):
            return subprocess.CompletedProcess(args, returncode=0, stdout="drafted content", stderr="")

        monkeypatch.setattr(ai_assist, "resolve_claude_binary", lambda: "/usr/bin/claude")
        monkeypatch.setattr(ai_assist.subprocess, "run", _fake_run)

        result = ai_assist.draft_content("current", "do it", AiConfig(provider="claude_cli"))
        assert result == "drafted content"
