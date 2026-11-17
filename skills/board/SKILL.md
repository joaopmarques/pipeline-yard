---
name: board
description: Build the Pipeline Yard again from current data: the page that shows every piece of work in flight, its stage, and the next release. Use when the user says "board", "refresh the yard", "where is everything", "what is in the next release", or asks what needs attention across sessions, pull requests, and tickets.
---

# Board

The yard is one page. `board.mjs` builds it from GitHub and git. A Claude session must supply the
tickets and the session list, because a script cannot read them.

The state directory of a repository is `~/.claude/board/<owner>__<repo>/`. Run every command from
inside the repository.

If the state directory has no `yard.config.json`, the project is not set up. Use the `yard-setup`
skill first.

## Steps

1. Find the state directory: `gh repo view --json nameWithOwner --jq .nameWithOwner`, with `/`
   replaced by `__`.
2. Read the facts of the project: `node ~/.claude/skills/board/board.mjs --project`. The output
   names the tracker and the team key.
3. Write `tickets.json` in the state directory. Use the connector of the project's tracker. List
   the tickets of the team that are assigned to the user and changed in the last 30 days. Keep each
   one as `{ "id", "title", "status", "priority", "priorityName", "url", "createdAt" }`, under an
   `issues` array. `priority` is a number, and 1 is the most urgent. If the project has no tracker,
   skip this file.
4. Write `sessions.json` in the state directory. List the Claude sessions of the user. Keep each
   session that has a branch as
   `{ "sessionId", "title", "branch", "isRunning", "prNumber", "lastActivityAt" }`, under a
   `sessions` array. If the tool is not available, skip this file and say so.
5. Run `node ~/.claude/skills/board/board.mjs`.
6. Publish `board.html` from the state directory with the Artifact tool. Pass the address from
   `artifact-url.txt` in the state directory as `url`, so the link stays the same. Read the
   artifact first if this session has not published it.
7. Tell the user the "needs you now" items from the output. Do not repeat the whole yard.

## What the page shows

- Each line is one stage. Trains queue at the exit signal of their line, and the train at the
  front has waited longest. The lines join a ladder track that runs into the release line.
- An engine is work with a session. A flat wagon is a ticket with no session. A box wagon is a
  merged change.
- The state of a pull request is part of its engine: a flag for the review, a beacon on the roof
  for the checks, a round sign for the ticket status, a red barrier for merge conflicts, and a
  dashed outline for a draft.
- At most a few items are red. Red means "do this next". The config sets the limit.
- The release engine stands on the release line and faces the portal. Changes on Staging are
  coupled behind it. Changes that are only on the main branch stand apart.
- `release-state.json` in the state directory holds the last Production tag. When the tag changes,
  the changes that went live drive out through the portal for the next 24 hours.
- The page follows the light or dark setting of the system.

## How the skill is built

| Part | Files | What it knows |
| --- | --- | --- |
| Engine | `engine/yard.mjs`, `engine/page.mjs`, `engine/collect.mjs`, `engine/config.mjs`, `engine/fill.mjs` | The rail yard, the page, and how to read GitHub and git. It names no project. |
| Preset | `presets/github-linear-releases.mjs` | One workflow: how to sort work onto lines, what needs the user, and which items a lever takes. It owns the line keys. |
| Config | `yard.config.json` in the state directory | One project: the labels, the statuses, the tag patterns, the limits, the check commands, and the name, colour, and lever prompt of each line. |

- `board.mjs` is the command. It loads the config, checks it, collects, sorts, and renders.
- `board.mjs --check` reports each problem in the config and builds nothing.
- `board.mjs --project` prints the facts of the project that the lever skills read.
- To change a word, a colour, a limit, or a lever prompt, edit the config. Do not edit code.
- To support a different workflow, add a preset.
- `vendor/anatomy/iso-kit.mjs` is the isometric drawing kit. It is third-party code under the MIT
  License.

## Levers

A line can have a lever at its end. A click on it opens a panel that lists what the lever will do,
with one button. The button opens `claude://code/new?q=<prompt>&folder=<main checkout>`, which
fills a new session in the Claude app. The user sends it there. The prompt names a skill that holds
the detail.

| Line | Lever | Skill | Stops before |
| --- | --- | --- | --- |
| Inbox | START | `board-start-tickets` | a push or a pull request |
| Building | REVIEW | `board-self-review` | any change to code |
| Your move | FIX | `board-fix-blockers` | a push |
| Reviewers | CHASE | `board-chase-reviews` | a review request or a message |
| Release | SHIP | `board-cut-release` | each deploy |
| Arrived | CLOSE | `board-close-out` | a ticket comment or a status change |

A lever shows only when its line has something to act on.

The self-review marker is the file `<git common dir>/self-review/<branch with / as __>`. It holds
the commit SHA that was reviewed. The yard shows a branch as reviewed only when the SHA matches the
branch head.

## Menu bar app

`widget/main.swift` is a macOS menu bar app. `widget/build.sh` builds it into
`~/Applications/Pipeline Yard.app`. A click on the icon opens `board.local.html` over the whole
screen. A second click, or Escape, closes it. The number beside the icon comes from `summary.json`.
The app shows the project in `~/.claude/board/active.json`, which is the project built last.
`widget/login.sh on` starts the app at login, and `widget/login.sh off` stops that.

## Test a change

Run the command two times on recorded data and compare the pages:

```bash
BOARD_FIXTURE=/tmp/yard-fixture.json BOARD_NOW=1794933600000 node ~/.claude/skills/board/board.mjs --state /tmp/yard-test
```

`BOARD_FIXTURE` records every command result on the first run and replays it after that.
`BOARD_NOW` holds the clock still. Copy `tickets.json` and `sessions.json` into the test state
directory first. A change that must not alter the page gives a byte-identical `board.html`.

The page runs in WebKit inside the menu bar app. Do not put a CSS filter, an SVG mask, or a
gradient stroke on the drawing: each one makes the yard slow there. Measure a visual change with
`Pipeline Yard.app/Contents/MacOS/PipelineYard --bench <file>`.

## Rules

- This skill only reads the project. Never move a ticket, merge a pull request, or post a comment
  from it.
- Never edit `board.html` by hand. Change the config or the code, then run the command again.
