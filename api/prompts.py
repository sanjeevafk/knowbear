"""Enhanced prompt templates with Chain of Thought and Few-Shot examples."""

import re

PROMPTS: dict[str, str] = {
    "eli5": """Think step-by-step: 1. Analyze audience (5-year-old). 2. Select a sensory, vivid analogy. 3. Draft explanation.

Explain the following concept or text like I'm 5: simple words, short sentences, easy analogy. Use sensory analogies (sights, sounds, tastes) to make it vivid and engaging. End with a simple, engaging question for the child.

"{topic}"

Few-shot examples:
Topic: Gravity
Output: Gravity is like an invisible hug from the Earth! It keeps you from floating away into the sky like a balloon. When you jump, gravity pulls you back down - it's like the Earth saying "come back!" That's why when you drop a ball, it falls down instead of up. Can you feel gravity when you jump on your bed?

Topic: Rainbow
Output: A rainbow is like a magic smile in the sky made of colors! When the sun shines through raindrops, the light breaks into all the pretty colors you see - red, orange, yellow, green, blue, and purple. It's like when you blow bubbles and see shiny colors dancing on them! Have you ever tried to touch a rainbow?

Output in plain text only, no markdown, no bolding, no headers. Just paragraphs. CRITICAL: Do not output your thinking process, "Thought:", or any <think> blocks. Output ONLY the final explanation.""",

    "eli12": """Think step-by-step: 1. Analyze audience (12-year-old). 2. Balance simplicity with some technical depth. 3. Draft explanation.

Explain the following concept or text for a 12-year-old: some technical terms with clear definitions, real-world examples they can relate to.

"{topic}"

Output in plain text only, no markdown, no bolding, no headers. Just paragraphs. CRITICAL: Do not output your thinking process, "Thought:", or any <think> blocks. Output ONLY the final explanation.""",

    "eli15": """Think step-by-step: 1. Analyze audience (15-year-old). 2. Introduce key concepts with appropriate depth. 3. Draft explanation.

Explain the following concept or text for a 15-year-old: more depth, key concepts explained clearly, connections to broader ideas.

"{topic}"

Output in plain text only, no markdown, no bolding, no headers. Just paragraphs. CRITICAL: Do not output your thinking process, "Thought:", or any <think> blocks. Output ONLY the final explanation.""",

    "meme": """Explain the following concept or text as a funny one-liner meme with relatable analogy. Make it punchy and shareable.

"{topic}"

Output plain text only, exactly two lines:
SETUP: <short setup, no quotes, no markdown>
PUNCHLINE: <the one-liner punchline>
No other lines, no markdown, no headers, no thinking blocks. Never output TEMPLATE:, Thought:, <think> tags, or regeneration quotes.""",

}

FAST_MODEL = "openai/gpt-oss-20b"

LEVEL_AUDIENCE_LABELS = {
    "eli5": "5-year-old",
    "eli12": "12-year-old",
    "eli15": "15-year-old",
    "meme": "meme",
}

FOLLOWUP_PROMPT = """The reader is exploring "{topic}" at {level_label} depth.
{focus_block}{history_block}Follow-up question from the reader: "{question}"

Answer the follow-up directly and briefly (2-4 short paragraphs). Plain text only, no markdown, no headers.

If the question is unrelated to the topic or the provided passage, answer it briefly anyway and note the digression in one sentence."""


def _render_template(template: str, mapping: dict[str, str]) -> str:
    """Single-pass substitution.

    Inserted values are never re-scanned, so a topic containing '{question}'
    cannot be clobbered by a later placeholder.
    """
    pattern = re.compile("|".join(re.escape(k) for k in mapping))
    return pattern.sub(lambda m: mapping[m.group(0)], template)


def _focus_block(context: dict | None, topic: str | None = None) -> str:
    """Render page context (untrusted) as a delimited grounding block."""
    if not context:
        return ""
    lines = []
    if context.get("page_title"):
        lines.append(f"Page title: {context['page_title']}")
    if context.get("page_url"):
        lines.append(f"Page URL: {context['page_url']}")
    selected = context.get("selected_text")
    if selected and (not topic or selected.strip() != topic.strip()):
        lines.append(
            "Exact selected passage the reader highlighted (primary; explain this):\n"
            f"<<<{selected}>>>"
        )
    if context.get("surrounding_text"):
        lines.append(
            "Surrounding passage the reader was looking at (grounding only; do not summarize it):\n"
            f"<<<{context['surrounding_text']}>>>"
        )
    return ("\n".join(lines) + "\n\n") if lines else ""


def _history_block(history: list[dict] | None) -> str:
    """Render up to the last 6 follow-up turns."""
    if not history:
        return ""
    turns = [
        f"Q: {h.get('question', '')}\nA: {h.get('answer', '')}"
        for h in history[-6:]
        if h.get("question") or h.get("answer")
    ]
    return ("Previous Q/A:\n" + "\n".join(turns) + "\n\n") if turns else ""


def build_explanation_prompt(topic: str, level: str, context: dict | None = None) -> str:
    """Build the explanation prompt; context is inserted before the final output rules."""
    base = _render_template(PROMPTS[level], {"{topic}": topic})
    block = _focus_block(context, topic=topic)
    if not block:
        return base
    # Keep the output-format constraints last so trailing page text cannot override them.
    pre, marker, post = base.rpartition("\n\nOutput")
    if marker:
        return f"{pre}\n\n{block}Output{post}"
    return f"{base}\n\n{block}"


def build_followup_prompt(
    topic: str,
    level: str,
    question: str,
    context: dict | None = None,
    history: list[dict] | None = None,
) -> str:
    """Build the follow-up prompt with optional page context and prior turns."""
    return _render_template(FOLLOWUP_PROMPT, {
        "{topic}": topic,
        "{level_label}": LEVEL_AUDIENCE_LABELS.get(level, level),
        "{question}": question,
        "{focus_block}": _focus_block(context),
        "{history_block}": _history_block(history),
    })
