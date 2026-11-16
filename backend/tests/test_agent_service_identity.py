import pytest
from ai_phone.agent.ws_client import stable_agent_id


def test_configured_identity_survives_independent_calls(monkeypatch):
    monkeypatch.setenv("AI_PHONE_AGENT_ID", "lab-node-01-stable")
    assert stable_agent_id("node") == stable_agent_id("node") == "lab-node-01-stable"


def test_default_keeps_distinct_process_identity_behavior(monkeypatch):
    monkeypatch.delenv("AI_PHONE_AGENT_ID", raising=False)
    first, second = stable_agent_id("node"), stable_agent_id("node")
    assert first.startswith("node-") and first != second


@pytest.mark.parametrize("value", ["not/an/id", "x" * 129])
def test_invalid_service_identity_is_rejected(monkeypatch, value):
    monkeypatch.setenv("AI_PHONE_AGENT_ID", value)
    with pytest.raises(ValueError):
        stable_agent_id("node")
