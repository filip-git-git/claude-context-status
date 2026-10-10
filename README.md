# claude-context-status

A [Claude Code](https://code.claude.com) mod that keeps the current model, its effort level and the context window usage always visible in a line drawn just above the prompt.

```
Opus 5.5 · high · ctx ████░░░░░░ 42% · 84k/200k
```

## Features

- **Current model**: the main-loop model as `/model` shows it, with ids like `claude-opus-5-5` shortened to `Opus 5.5`.
- **Effort level**: `low` to `max`. Before the first turn it comes from your settings (`modelSettings.<model>.effortLevel`, then `effortLevel`); after each turn it is the effort the request was actually sent with. Models without an effort setting show none.
- **Context usage**: a 10-cell bar, the percentage, and tokens used out of the window size (`84k/200k`, `1M`).
- **Colors by usage**: the bar is green below 80%, yellow from 80%, and red with a `compact soon` note from 95%. Colors follow your Claude Code theme.
- **No extra API traffic**: it only reads figures the session already has.

Before the model's first reply in a session, Claude Code has no usage figure yet, so the line shows `ctx — · 200k` until then.

The line steps aside while Claude Code shows a survey in the same place.

## How it updates

The line is refreshed after every turn, whenever Claude Code measures the session, and every 5 seconds. Mods get no event when you switch models with `/model` or change the effort, so the 5-second check is what picks up a switch between turns. The text is only redrawn when it actually changes.

## Requirements

Claude Code with mod (function hooks) support. Developed and tested on 2.1.296.

## Installation

In Claude Code (2.1.275 or later), run:

```
/plugin install context-status --marketplace filip-git-git/claude-context-status
```

Answer `y` to add the marketplace, then pick a scope (user scope loads it in every session). The line appears right away.

### From a local clone

Clone the repository:

```bash
git clone https://github.com/filip-git-git/claude-context-status.git
```

Start Claude Code with the mod folder:

```bash
claude --plugin-dir /path/to/claude-context-status/context-status
```

To load it in every session without the flag, add the folder to `CLAUDE_CODE_PLUGIN_DIRS`, either in your environment or in the `env` block of `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_PLUGIN_DIRS": "/path/to/claude-context-status/context-status"
  }
}
```

## Development

```
context-status/
├── .claude-plugin/plugin.json      manifest
├── hooks/
│   ├── hooks.json                  points at the hooks module
│   ├── register.tsx                event wiring and the band above the prompt
│   ├── effort-level.ts             which effort level to show
│   └── format-status.ts            pure formatting of the line
├── types/index.d.ts                state contract
└── tests/context-status.test.ts
```

Validate the mod and run the tests:

```bash
claude plugin validate context-status
claude plugin test context-status
```

Thresholds (80% / 95%) and the poll interval (5 s) are constants at the top of `format-status.ts` and `register.tsx`.
