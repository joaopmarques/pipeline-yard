# Pipeline Yard

Pipeline Yard shows the work of one repository as a rail yard. It is a set of skills for Claude Code.

- Each stage of work is a line: tickets that nobody started, work in progress, work that waits on
  you, work that waits on a reviewer, merged changes that are not live, and live changes with an
  open ticket.
- Each piece of work is a train on its line. The train that waited longest stands at the front.
- A signal at the end of each line is red when something on that line needs you.
- A lever at the end of each line opens a Claude session with a prompt made for that line.
- A board in the yard lists what needs you now. At most three things are red.

The page is one HTML file. You can publish it as a Claude artifact, and you can open it from the
macOS menu bar.

## What you need

- Claude Code, with the desktop app for the levers and the scheduled refresh.
- Node.js 20 or later.
- The GitHub CLI (`gh`), signed in.
- A repository on GitHub that uses pull requests.
- Optional: a ticket tracker with a Claude connector, such as Linear.
- Optional: macOS with the Swift compiler, for the menu bar app.

## Install

```bash
./install.sh
```

The script copies each folder in `skills/` into `~/.claude/skills/`. Run it again after you pull a
new version. Set `CLAUDE_SKILLS_DIR` to install into a different folder.

## Set up a project

1. Open Claude Code in the repository.
2. Say "set up the yard", or run `/yard-setup`.

The setup skill looks at the repository first: the pull requests, the labels, the ticket keys, the
release tags, and the check commands. It proposes the lines of the yard and the rule for each one.
It asks five questions at most. Then it writes the config and builds the first yard.

## Use it

Run `/board` to build the yard again from current data. The skill reads the tickets and the Claude
sessions, runs the generator, and publishes the page to the same address.

A click on a train, a line, or a row of the board opens a panel with the detail. A card in the
panel shows six steps: ticket, pull request, review, checks, merge, live. Each step is green,
amber, red, or grey.

## Levers

Each lever opens one new Claude session with a prompt filled in. Nothing starts until you send the
prompt. Each lever skill stops before an action that cannot be undone.

| Line | Lever | Skill | Stops before |
| --- | --- | --- | --- |
| Inbox | START | `board-start-tickets` | a push or a pull request |
| Building | REVIEW | `board-self-review` | any change to code |
| Your move | FIX | `board-fix-blockers` | a push |
| Reviewers | CHASE | `board-chase-reviews` | a review request or a message |
| Release | SHIP | `board-cut-release` | each deploy |
| Arrived | CLOSE | `board-close-out` | a ticket comment or a status change |

A lever skill names no project. It runs `node ~/.claude/skills/board/board.mjs --project` and
reads the facts of the project from the output.

## How it is built

| Part | Files | What it knows |
| --- | --- | --- |
| Engine | `skills/board/engine/` | The rail yard, the page, and how to read GitHub and git. It names no project. |
| Preset | `skills/board/presets/github-linear-releases.mjs` | One workflow: how to sort work onto lines, what needs the user, and which items a lever takes. |
| Config | `yard.config.json` in the state directory | One project: the labels, the statuses, the tag patterns, the limits, the check commands, and the name, colour, and lever prompt of each line. |

The state directory of a repository is `~/.claude/board/<owner>__<repo>/`. It holds the config,
the ticket file, the session file, and the built page.

`skills/board/presets/github-linear-releases.config.json` is a complete example config. A project
with no config of its own uses it.

Check a config:

```bash
node ~/.claude/skills/board/board.mjs --check
```

## Menu bar app

The menu bar app is for macOS. Build it, then start it at login:

```bash
~/.claude/skills/board/widget/build.sh
```

```bash
~/.claude/skills/board/widget/login.sh on
```

A click on the icon opens the yard over the whole screen. A second click, or Escape, closes it. The
number beside the icon is how many things need you. The app shows the project that was built last.

## Test a change

The generator can record every command result and replay it. With a fixed clock, two runs on the
same record give the same page. A change that must not alter the page gives a byte-identical file.

```bash
BOARD_FIXTURE=/tmp/yard-fixture.json BOARD_NOW=1794933600000 node skills/board/board.mjs --state /tmp/yard-test
```

Copy `tickets.json` and `sessions.json` into the test state directory first. Do not commit a
record: it holds the data of a real repository.

## Limits

- One workflow: tickets, branches, pull requests, review, merge, and releases marked by a tag. A
  different workflow needs a new preset, which is a code change.
- The yard always has a release line. With no release tags, that line shows what merged lately.
- The page does not update itself. Something must run `/board`: you, or a scheduled task.
- A line draws a limited number of trains. The sign shows the full count, and the panel lists
  every item.
- The setup skill and the lever skills are new. Expect to adjust them after the first runs.

## License

Pipeline Yard is under the MIT License. See `LICENSE`.

## Third-party code

`skills/board/vendor/anatomy/iso-kit.mjs` is the isometric drawing kit from the `anatomy` skill,
used under the MIT License. Its licence is in the same folder.
