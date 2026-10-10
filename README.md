# claude-context-status

A [Claude Code](https://code.claude.com) mod that keeps the current model and the context window usage always visible in the status line under the prompt.

```
Opus 5.5 · ctx ████░░░░░░ 42% · 84k/200k
```

## Features

- **Current model**: the main-loop model as `/model` shows it, with ids like `claude-opus-5-5` shortened to `Opus 5.5`.
- **Context usage**: a 10-cell bar, the percentage, and tokens used out of the window size (`84k/200k`, `1M`).
- **Warnings**: a `⚠` prefix at 80% and above, and `compact soon` at 95% and above.
- **No extra API traffic**: it only reads figures the session already has.

Before the model's first reply in a session, Claude Code has no usage figure yet, so the line shows `ctx — · 200k` until then.

## How it updates

The line is refreshed after every turn, whenever Claude Code measures the session, and every 5 seconds. Mods get no event when you switch models with `/model`, so the 5-second check is what picks up the switch. The text is only redrawn when it actually changes.

## Requirements

Claude Code with mod (function hooks) support. Developed and tested on 2.1.296.

## Installation

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
│   ├── register.ts                 event wiring and status line updates
│   └── format-status.ts            pure formatting of the line
└── tests/context-status.test.ts
```

Validate the mod and run the tests:

```bash
claude plugin validate context-status
claude plugin test context-status
```

Thresholds (80% / 95%) and the poll interval (5 s) are constants at the top of `format-status.ts` and `register.ts`.
