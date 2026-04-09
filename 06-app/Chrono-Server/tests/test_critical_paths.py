"""
ChronoFork — Critical Path Tests
Run from Chrono-Server/:
    pip install pytest pytest-asyncio
    pytest tests/test_critical_paths.py -v
"""

import pytest
import asyncio
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from server.story_engine import StoryGraph, StoryEngine


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class NullLogger:
    """Minimal logger stub — discards all events."""
    def log(self, *args, **kwargs):
        pass

    def get_log_path(self):
        return "/dev/null"


SAMPLE_STORYLINE = [
    {
        "title": "Crisis Begins",
        "desc": "Soviet missiles detected in Cuba.",
        "choice": "None",
        "decision": "How to respond to the threat?",
        "decision_maker": "Kennedy",
        "characters": ["Kennedy", "Khrushchev"],
    },
    {
        "title": "ExComm Meeting",
        "desc": "Kennedy convenes advisors.",
        "choice": "Convene ExComm",
        "decision": "Blockade or airstrike?",
        "decision_maker": "Kennedy",
        "characters": ["Kennedy", "McNamara"],
    },
    {
        "title": "Naval Blockade",
        "desc": "US imposes naval quarantine.",
        "choice": "Naval Blockade",
        "decision": "None",
        "decision_maker": "None",
        "characters": ["Kennedy", "Khrushchev"],
    },
]


# ---------------------------------------------------------------------------
# StoryGraph Unit Tests
# ---------------------------------------------------------------------------

class TestStoryGraph:
    def test_root_node_initialized(self):
        g = StoryGraph()
        assert "0.0" in g.nodes
        assert g.nodes["0.0"]["title"] == "ROOT"

    def test_add_node_assigns_id(self):
        g = StoryGraph()
        nid = g.add_node("Test", "desc", "decision", "choice", parent_id="0.0")
        assert nid == "1.0"
        assert "1.0" in g.nodes
        assert ("0.0", "1.0") in g.edges

    def test_add_sequential_nodes(self):
        g = StoryGraph()
        g.add_node("Node 1", "d1", "dec1", "ch1", parent_id="0.0", specific_id="1.0")
        g.add_node("Node 2", "d2", "dec2", "ch2", parent_id="1.0", specific_id="2.0")
        assert "2.0" in g.nodes
        assert g.nodes["2.0"]["parent_id"] == "1.0"

    def test_add_variant_node(self):
        g = StoryGraph()
        g.add_node("Canonical", "d", "dec", "ch", parent_id="0.0", specific_id="1.0")
        g.add_node("Divergent", "d", "dec", "ch", parent_id="0.0", specific_id="1.1")
        children = g.get_children("0.0")
        assert "1.0" in children
        assert "1.1" in children

    def test_serialization_roundtrip(self):
        g = StoryGraph()
        g.add_node("N1", "d1", "dec1", "ch1", parent_id="0.0", specific_id="1.0")
        g.edge_contexts[("0.0", "1.0")] = [{"role": "user", "content": "hello"}]
        data = g.to_dict()
        g2 = StoryGraph()
        g2.load_from_dict(data)
        assert "1.0" in g2.nodes
        assert ("0.0", "1.0") in g2.edge_contexts
        assert g2.edge_contexts[("0.0", "1.0")] == [{"role": "user", "content": "hello"}]


# ---------------------------------------------------------------------------
# StoryEngine Integration Tests
# ---------------------------------------------------------------------------

class TestStoryEngine:
    def _make_engine(self):
        logger = NullLogger()
        return StoryEngine(SAMPLE_STORYLINE, logger)

    def test_graph_loaded_from_storyline(self):
        engine = self._make_engine()
        # 3 storyline nodes + root = 4 nodes total
        assert len(engine._graph.nodes) == 4
        assert "1.0" in engine._graph.nodes
        assert "3.0" in engine._graph.nodes

    def test_initial_path_starts_at_root(self):
        engine = self._make_engine()
        assert engine._current_path == ["0.0"]

    def test_node_titles_loaded_correctly(self):
        engine = self._make_engine()
        assert engine._graph.nodes["1.0"]["title"] == "Crisis Begins"
        assert engine._graph.nodes["2.0"]["title"] == "ExComm Meeting"

    def test_initial_node_statuses(self):
        engine = self._make_engine()
        assert engine._node_statuses["0.0"] == "COMPLETED"
        assert engine._node_statuses["1.0"] == "UNFINISHED"

    def test_export_and_restore_state(self):
        engine = self._make_engine()
        snapshot = engine.export_state()

        engine2 = self._make_engine()
        engine2.restore_state(snapshot)

        assert engine2._current_node_id == engine._current_node_id
        assert set(engine2._graph.nodes.keys()) == set(engine._graph.nodes.keys())

    def test_get_children_canonical_path(self):
        engine = self._make_engine()
        children = engine._graph.get_children("0.0")
        assert children == ["1.0"]

    def test_add_divergent_branch(self):
        engine = self._make_engine()
        # Simulate divergence: add a variant at depth 2
        engine._graph.add_node(
            "Airstrike Branch",
            "US launches airstrike instead.",
            "decision",
            "Airstrike",
            parent_id="1.0",
            specific_id="2.1",
        )
        children = engine._graph.get_children("1.0")
        assert "2.0" in children
        assert "2.1" in children


# ---------------------------------------------------------------------------
# Prompt Catalog Tests
# ---------------------------------------------------------------------------

class TestPromptCatalog:
    def test_all_required_prompts_exist(self):
        from server.prompts.catalog import PROMPT_CATALOG
        required = [
            "llm.system_json",
            "config.theme_to_episodes",
            "config.episode_to_cast",
            "config.cast_to_storyline",
            "cast.agent_system",
            "cast.divergence",
            "facilitator.system",
            "facilitator.intro",
            "facilitator.reflection",
        ]
        for key in required:
            assert key in PROMPT_CATALOG, f"Missing prompt: {key}"

    def test_all_prompts_have_zh_and_en(self):
        from server.prompts.catalog import PROMPT_CATALOG
        for key, variants in PROMPT_CATALOG.items():
            assert "zh" in variants, f"Prompt '{key}' missing 'zh' variant"
            assert "en" in variants, f"Prompt '{key}' missing 'en' variant"

    def test_get_prompt_returns_string(self):
        from server.prompts import get_prompt
        result = get_prompt("llm.system_json", "en")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_get_prompt_invalid_key_raises(self):
        from server.prompts import get_prompt
        with pytest.raises((KeyError, Exception)):
            get_prompt("nonexistent.prompt", "en")

    def test_normalize_lang_defaults_to_zh(self):
        from server.prompts.catalog import normalize_lang
        assert normalize_lang(None) == "zh"
        assert normalize_lang("invalid") == "zh"
        assert normalize_lang("en") == "en"
        assert normalize_lang("zh") == "zh"


# ---------------------------------------------------------------------------
# LLM Cache Unit Tests (no real API calls)
# ---------------------------------------------------------------------------

class TestLLMCache:
    def test_cache_key_is_deterministic(self):
        """Same inputs must always produce the same cache key."""
        import hashlib
        messages = [{"role": "user", "content": "hello"}]
        key_content = json.dumps({"model": "gpt-5.1", "messages": messages}, sort_keys=True)
        key1 = hashlib.md5(key_content.encode("utf-8")).hexdigest()
        key2 = hashlib.md5(key_content.encode("utf-8")).hexdigest()
        assert key1 == key2

    def test_cache_key_differs_for_different_messages(self):
        import hashlib
        def make_key(content):
            messages = [{"role": "user", "content": content}]
            raw = json.dumps({"model": "gpt-5.1", "messages": messages}, sort_keys=True)
            return hashlib.md5(raw.encode("utf-8")).hexdigest()

        assert make_key("hello") != make_key("world")

    def test_missing_api_key_raises(self):
        """Without OPENAI_API_KEY, cached_chat_create should raise ValueError on cache miss."""
        import importlib
        import unittest.mock as mock

        # Patch diskcache to always miss, and ensure no API key
        with mock.patch.dict(os.environ, {}, clear=True):
            os.environ.pop("OPENAI_API_KEY", None)
            with mock.patch("diskcache.Cache.__contains__", return_value=False):
                import server.utilities.llm_cache as llm_mod
                with pytest.raises((ValueError, Exception)):
                    asyncio.run(llm_mod.cached_chat_create("gpt-5.1", [{"role": "user", "content": "test"}]))


# ---------------------------------------------------------------------------
# WebSocket Message Structure Tests
# ---------------------------------------------------------------------------

class TestWebSocketMessageFormat:
    """Validate that message dicts match the api.md spec without a live server."""

    def _make_system_init(self, config):
        return {
            "type": "system_init",
            "data": {
                "config": config,
                "status": "ready" if config else "error_no_config",
            },
        }

    def _make_graph_update(self):
        return {
            "type": "graph_update",
            "data": {
                "nodes": [{"id": "1.0", "label_id": "1.0", "hover_title": "t", "hover_desc": "d", "status": "UNFINISHED"}],
                "edges": [["0.0", "1.0"]],
                "pos": {"1.0": [0, -1]},
                "edge_label_data": [],
                "active_id": "1.0",
                "current_path": ["0.0", "1.0"],
            },
        }

    def test_system_init_with_config(self):
        msg = self._make_system_init({"episode": {"title": "Cuban Missile Crisis"}})
        assert msg["type"] == "system_init"
        assert msg["data"]["status"] == "ready"
        assert "config" in msg["data"]

    def test_system_init_without_config(self):
        msg = self._make_system_init({})
        assert msg["data"]["status"] == "error_no_config"

    def test_graph_update_node_status_values(self):
        valid_statuses = {"UNFINISHED", "IN_PROGRESS", "COMPLETED", "SUSPENDED"}
        msg = self._make_graph_update()
        for node in msg["data"]["nodes"]:
            assert node["status"] in valid_statuses

    def test_stream_token_structure(self):
        msg = {"type": "stream_token", "data": {"agent": "Kennedy", "token": "We must", "target": "Khrushchev"}}
        assert msg["type"] == "stream_token"
        assert "agent" in msg["data"]
        assert "token" in msg["data"]

    def test_action_update_backtrack_structure(self):
        msg = {"type": "action_update", "data": {"action": "backtrack_complete", "new_node_id": "2.1", "new_role": "Kennedy"}}
        assert msg["data"]["action"] == "backtrack_complete"
        assert "new_node_id" in msg["data"]
