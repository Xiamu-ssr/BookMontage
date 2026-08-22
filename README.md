# BookMontage · 书间

A tiny, local, Harness-first workbench for long-form AI video worlds.

Humans write rough intent and review the result. Codex, Claude Code, or another capable Harness reads the project Skill, maintains the world bible, resolves dependencies, writes model prompts, and operates the CLI. The interface is deliberately a beautiful reading surface—not an admin dashboard.

![BookMontage cover](.bookmontage/assets/89b7e502701549b7aeeb2312d7fbe0690001.png)

## Design

- One book is the top-level unit.
- Global facts—characters, places, factions, systems, relics—exist once and are referenced by shots.
- A shot keeps the human draft, readable `story`, model-ready `body`, and links to assets.
- Every identity is one 36-character field: 32 hex characters plus a four-digit version.
- A newer upstream version makes old `depends` links stale; `verify` reports the warning.
- Everything portable lives under `.bookmontage/`: one SQLite database and its assets. Public JSON is only a disposable UI cache.

The database intentionally has two tables:

```text
item(id, type, parent, data)
link(source, target, kind)
```

## Run

Requires Node.js 22.13+.

```bash
npm install
npm run bookmontage -- init
npm run bookmontage -- export
npm run dev
```

Open the local URL printed by the dev server. The included **《浪浪山外传：天上来客》** library is a research-only fan-continuation experiment; film-derived references and their dependent drafts are marked copyright-sensitive and must be replaced before production.

Story data is intentionally excluded from this public source repository. Clone the private data repository into `.bookmontage`, then run `npm run bookmontage -- export` before opening the workbench. Secrets are environment variables and never belong in either repository.

## CLI

```bash
npm run bookmontage -- list [type]
npm run bookmontage -- show <id|slug|path>
npm run bookmontage -- prompt <id|slug|path>
npm run bookmontage -- prompt-search "仙侠 打斗" --model 2.5 --limit 3 --full
npm run bookmontage -- revise <id> <patch.json>
npm run bookmontage -- export
npm run bookmontage -- verify
npm run bookmontage -- doctor
npm run bookmontage -- compose <chapter-id>
```

`prompt` emits a short task that can be pasted into a Harness. `revise` creates the next four-digit version without overwriting history.

## Video generation

The adapter supports ZenMux's native Videos API and automatically falls back to its Vertex-compatible video protocol when a model is not exposed by the native route.

```bash
export ZENMUX_API_KEY=...
export NODE_USE_ENV_PROXY=1                 # only when a local proxy is needed
export HTTPS_PROXY=http://127.0.0.1:7890   # example Clash Verge address

npm run bookmontage -- generate <shot-id> \
  --model bytedance/doubao-seedance-2.0 \
  --duration 10 \
  --resolution 720p
```

Generated clips are candidate assets. They do not become “approved” merely because the provider returned a file.
`compose` joins the latest candidate for every shot into a review film with H.264/AAC and a 1280×720 playback canvas; it does not pretend that a low-resolution source became a true 720p master.

## Harness manual

The concise project Skill is at [`skills/bookmontage/SKILL.md`](skills/bookmontage/SKILL.md). It routes to model-specific notes only when needed:

- [Seedance 2.5](skills/bookmontage/references/seedance-2.5.md)
- [Seedance 2.0](skills/bookmontage/references/seedance-2.0.md)
- [MiniMax H3](skills/bookmontage/references/minimax-h3.md)
- [Seedance 实片库与检索命令](skills/bookmontage/references/prompt-libraries.md)

## Verification

```bash
npm test
npm run lint
npm run build
npm run bookmontage -- verify
```

## License

Code is released under the MIT License. Generated sample media and the fan-continuation concept are provided only as a demonstration; replace them for commercial work and confirm the rights to every reference asset you use.
