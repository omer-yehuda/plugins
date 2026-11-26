---
name: greet
description: Use when the user asks for a friendly greeting in a given language.
argument-hint: "<language>"
---

# Greeter

Greet the user in the requested language. Keep it to one short sentence.

If the language is unknown, ask which one they want, then continue.
Run `node ${CLAUDE_PLUGIN_ROOT}/scripts/greet.js <language>` to get the phrase.
