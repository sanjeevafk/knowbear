"""Enhanced prompt templates with Chain of Thought and Few-Shot examples."""

PROMPTS: dict[str, str] = {
    "eli5": """Think step-by-step: 1. Analyze audience (5-year-old). 2. Select a sensory, vivid analogy. 3. Draft explanation.

Explain {topic} like I'm 5: simple words, short sentences, easy analogy. Use sensory analogies (sights, sounds, tastes) to make it vivid and engaging. End with a simple, engaging question for the child.

Few-shot examples:
Topic: Gravity
Output: Gravity is like an invisible hug from the Earth! It keeps you from floating away into the sky like a balloon. When you jump, gravity pulls you back down - it's like the Earth saying "come back!" That's why when you drop a ball, it falls down instead of up. Can you feel gravity when you jump on your bed?

Topic: Rainbow
Output: A rainbow is like a magic smile in the sky made of colors! When the sun shines through raindrops, the light breaks into all the pretty colors you see - red, orange, yellow, green, blue, and purple. It's like when you blow bubbles and see shiny colors dancing on them! Have you ever tried to touch a rainbow?

Output in plain text only, no markdown, no bolding, no headers. Just paragraphs. CRITICAL: Do not output your thinking process, "Thought:", or any <think> blocks. Output ONLY the final explanation.""",

    "eli12": """Think step-by-step: 1. Analyze audience (12-year-old). 2. Balance simplicity with some technical depth. 3. Draft explanation.

Explain {topic} for a 12-year-old: some technical terms with clear definitions, real-world examples they can relate to.

Output in plain text only, no markdown, no bolding, no headers. Just paragraphs. CRITICAL: Do not output your thinking process, "Thought:", or any <think> blocks. Output ONLY the final explanation.""",

    "eli15": """Think step-by-step: 1. Analyze audience (15-year-old). 2. Introduce key concepts with appropriate depth. 3. Draft explanation.

Explain {topic} for a 15-year-old: more depth, key concepts explained clearly, connections to broader ideas.

Output in plain text only, no markdown, no bolding, no headers. Just paragraphs. CRITICAL: Do not output your thinking process, "Thought:", or any <think> blocks. Output ONLY the final explanation.""",

    "meme": """Explain {topic} as a funny one-liner meme with relatable analogy. Make it punchy and shareable.

Output in plain text only.""",

}

JUDGE_PROMPT = """Rate these responses for "{topic}" on coherence (1-5), accuracy (1-5), conciseness (1-5).
{responses}
Output JSON: {{"best": 0|1, "reason": "brief"}}"""

# Model configs
MODEL = "openai/gpt-oss-20b"
FAST_MODEL = "openai/gpt-oss-20b"
ENSEMBLE_MODELS = ["openai/gpt-oss-20b"]
JUDGE_MODEL = "gemini-2.5-flash"
