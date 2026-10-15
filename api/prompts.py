"""Enhanced prompt templates with Chain of Thought and Few-Shot examples."""

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

Output in plain text only. CRITICAL: Do not output thinking, reasoning, or markdown formatting. Output ONLY the one-liner meme.""",

}
