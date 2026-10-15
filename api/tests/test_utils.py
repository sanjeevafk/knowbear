import pytest

from utils import sanitize_topic


def test_sanitize_topic_valid():
    assert sanitize_topic("  Physics ") == "Physics"


def test_sanitize_topic_multiline_block():
    text = "AI agents are autonomous systems.\n\nThey reason, use tools, and execute tasks.\n\tResult is high productivity."
    sanitized = sanitize_topic(text)
    assert "\n" not in sanitized
    assert "\t" not in sanitized
    assert "AI agents are autonomous systems. They reason, use tools, and execute tasks. Result is high productivity." == sanitized


def test_sanitize_topic_typographic_chars():
    text = "“AI agents” {tools}: (autonomous) — 2026."
    assert sanitize_topic(text) == text


def test_sanitize_topic_invalid_chars():
    with pytest.raises(ValueError):
        sanitize_topic("bad<topic>")


def test_sanitize_topic_too_long():
    with pytest.raises(ValueError):
        sanitize_topic("a" * 2001)


def test_sanitize_topic_within_2000_limit():
    long_text = "word " * 300  # ~1500 chars
    assert len(sanitize_topic(long_text)) > 500


def test_sanitize_topic_missing():
    with pytest.raises(ValueError):
        sanitize_topic("")

