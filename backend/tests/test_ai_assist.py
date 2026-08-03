import json

import pytest

from app import ai_assist


def _fake_completion(content: str):
    def _fn(*args, **kwargs):
        return {"choices": [{"message": {"content": content}}]}

    return _fn


class TestExtractProjectFromChat:
    def test_parses_valid_json_response(self, monkeypatch):
        payload = {"name": "Acme Migration", "customer": "Acme Corp", "cloud": "AWS", "description": "Lift and shift."}
        monkeypatch.setattr(ai_assist.litellm, "completion", _fake_completion(json.dumps(payload)))

        result = ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}])
        assert result == payload

    def test_strips_markdown_code_fences(self, monkeypatch):
        payload = {"name": "X", "customer": "Y", "cloud": "GCP", "description": "Z"}
        fenced = f"```json\n{json.dumps(payload)}\n```"
        monkeypatch.setattr(ai_assist.litellm, "completion", _fake_completion(fenced))

        result = ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}])
        assert result == payload

    def test_missing_fields_fall_back_to_empty_string(self, monkeypatch):
        monkeypatch.setattr(ai_assist.litellm, "completion", _fake_completion(json.dumps({"name": "Only Name"})))

        result = ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}])
        assert result == {"name": "Only Name", "customer": "", "cloud": "", "description": ""}

    def test_invalid_json_raises_runtime_error(self, monkeypatch):
        monkeypatch.setattr(ai_assist.litellm, "completion", _fake_completion("not json at all"))

        with pytest.raises(RuntimeError):
            ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}])

    def test_non_object_json_raises_runtime_error(self, monkeypatch):
        monkeypatch.setattr(ai_assist.litellm, "completion", _fake_completion(json.dumps(["not", "an", "object"])))

        with pytest.raises(RuntimeError):
            ai_assist.extract_project_from_chat([{"role": "user", "content": "hi"}])


class TestDraftDiagramXml:
    def test_valid_xml_passes_through(self, monkeypatch):
        xml = '<mxGraphModel><root><mxCell id="0" /></root></mxGraphModel>'
        monkeypatch.setattr(ai_assist.litellm, "completion", _fake_completion(xml))

        result = ai_assist.draft_diagram_xml("a simple diagram", "AWS")
        assert result == xml

    def test_strips_markdown_code_fences(self, monkeypatch):
        xml = '<mxGraphModel><root><mxCell id="0" /></root></mxGraphModel>'
        monkeypatch.setattr(ai_assist.litellm, "completion", _fake_completion(f"```xml\n{xml}\n```"))

        result = ai_assist.draft_diagram_xml("a simple diagram", "AWS")
        assert result == xml

    def test_invalid_xml_raises_runtime_error(self, monkeypatch):
        monkeypatch.setattr(ai_assist.litellm, "completion", _fake_completion("<not><valid xml"))

        with pytest.raises(RuntimeError):
            ai_assist.draft_diagram_xml("a simple diagram", "AWS")
