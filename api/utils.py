"""Input validation and sanitization utilities."""

import re

MAX_TOPIC_LENGTH = 2000
CONTROL_CHARS_PATTERN = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
ALLOWED_PATTERN = re.compile(r"^[\w\s\-.,!?'\"()\/+#&:=;@%$*\[\]{}~`^|\\“”‘’–—…]+$", re.UNICODE)


def sanitize_topic(topic: str) -> str:
    """Sanitize and validate topic input."""
    if not topic or not isinstance(topic, str):
        raise ValueError("Topic required")
    if CONTROL_CHARS_PATTERN.search(topic):
        raise ValueError("Invalid control characters in topic")
    # Normalize multiline breaks and tabs to single spaces
    topic = re.sub(r"[\r\n\t]+", " ", topic)
    topic = re.sub(r" {2,}", " ", topic).strip()
    if not topic:
        raise ValueError("Topic required")
    if len(topic) > MAX_TOPIC_LENGTH:
        raise ValueError(f"Topic exceeds {MAX_TOPIC_LENGTH} chars")
    if not ALLOWED_PATTERN.match(topic):
        raise ValueError("Invalid characters in topic")
    return topic



LEVELS = ["eli5", "eli12", "eli15", "meme"]
