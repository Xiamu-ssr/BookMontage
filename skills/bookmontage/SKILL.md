---
name: bookmontage
description: "Operate a local BookMontage story world: inspect or revise books, global assets, chapters, shots, dependencies, and render candidates through the CLI. Use when creating or maintaining long-form AI video projects stored in .bookmontage."
---

# BookMontage

Treat SQLite as the only source of truth. Never edit `public/generated/library.json`; it is a disposable render cache.

1. Run `npm run bookmontage -- list` and `show <id|slug|path>` before changing data.
2. Preserve the human draft. Store the readable scene in `story`, model-ready instructions in `body`, and every asset dependency as a `link`; do not copy asset records into shots.
3. Revise with `revise <id> <patch.json>`. An ID is one field: 32 hex identity characters plus a four-digit version.
4. Finish with `export` and `verify`. Warnings mean an upstream asset gained a newer version and the dependent shot needs review.
5. Generate only after a human approves expensive work. Use `generate <shot-id>` and leave the clip as a candidate for review.

When writing model prompts, read only the selected model note: [Seedance 2.5](references/seedance-2.5.md) or [MiniMax H3](references/minimax-h3.md).
