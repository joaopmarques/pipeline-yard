---
name: yard-setup
description: Set up the Pipeline Yard for a repository. Look at how the user works, propose the lines of the yard, ask a few questions, then write the config and build the first yard. Use when the user says "set up the yard", "yard setup", "install the pipeline yard here", or wants the yard for a new project.
---

# Yard setup

The Pipeline Yard draws a repository's work as a rail yard: a line for each stage, a train for each
piece of work, a lever at the end of each line. The `board` skill builds it. This skill writes the
one file the build needs: `yard.config.json`.

Look first. Ask only what you cannot see. The user leaves a setup that opens with many questions.

Run every command from inside the repository. Change nothing until step 4.

## 1. Look

1. Run `node ~/.claude/skills/board/setup/detect.mjs`. It only reads. It reports the repository,
   the pull request habits, the label families, the ticket keys, the release signals, the gate
   commands, and what this machine has.
2. If `reading.notes` names a blocker, such as the `gh` command not signed in, tell the user how
   to fix it and stop.
3. If `machine.hasConfig` is true, the yard is set up. Show the current config in plain words and
   ask what to change. Do not start from zero.
4. Read the tracker, if one is connected. For Linear: list the teams, find the team whose key is
   `reading.ticketKey`, and list its statuses with their types. With no tracker, the yard has no
   Inbox tickets, and that is fine.
5. List the user's Claude sessions on this repository, if the tool is available.

Tell the user what you found in five lines at most. Use plain words, and no field names.

## 2. Propose

Propose the lines of the yard and the rule behind each one, so the user can disagree.

The one preset today is `github-linear-releases`. It fills six lines:

| Key | Kind | Holds |
| --- | --- | --- |
| `inbox` | tickets | A ticket in an inbox status with no session and no pull request |
| `building` | work | A session branch with no pull request, or a draft |
| `yourMove` | work | Approved, changes requested, or the blocker label |
| `waiting` | work | An open pull request that waits for a person |
| `release` | release | Merged and not in Production. With no release tags: merged in the last week |
| `live` | arrivals | In Production, with a ticket that is not in a QA status |

Fit the preset to what you saw:

- **Tickets.** Map the tracker statuses: which mean "not started" (`inboxStatuses`), which one
  means "started" (`startedStatus`), which mean "with QA or done" (`qaStatuses`), and which one a
  finished change moves to (`qaTarget`). With no tracker, use empty lists and `"team": null`.
- **Labels.** If the project has a risk label family and a review label family, map them in
  `labels`. Use `null` for each one the project does not have.
- **Releases.** If plain version tags exist, use `"mode": "tags"` and write the two patterns from
  the tags you saw. If no tag marks a release, use `"mode": "none"`: rename the release line to
  suit ("DONE"), and say that Staging and Production do not show.

If the work does not fit this preset (no GitHub pull requests, or a flow that is not ticket,
branch, review, merge, release), say so plainly. Do not force it. A new preset is a code change,
not a setup step.

Show the proposal as a short list: each line, its name, and its rule. Let the user rename a line,
change a colour, or drop a lever.

## 3. Ask

Ask only what the data did not show. Five questions at most, in one message:

1. What do you forget most often? This decides which things turn red first.
2. When is a piece of work done for you: merged, released, or signed off?
3. What must never happen without your agreement? (a push, a merge, a deploy, a message to a person)
4. How many items can be red at one time before red stops meaning something? The default is three.
5. Do you track work that has no ticket?

Skip a question the data answered.

## 4. Build

1. Start from `~/.claude/skills/board/presets/github-linear-releases.config.json`. It is a complete,
   valid example. Change the values. Do not invent fields.
2. Write the names, colours, panel texts, and lever texts of each line. A sign name is 12
   characters at most. A lever label is 7 characters at most.
3. Levers. A lever opens a Claude session with a prompt, and the prompt names a skill.
   - Keep a lever only if its skill is in `machine.leverSkills`. Set `"lever": null` for the rest,
     and tell the user which levers are off and why.
   - Write the user's answer to question 3 into each prompt as its last sentence: what the session
     must not do before the user agrees.
4. Fill the `project` section. The lever skills read it, so they name no project of their own:
   - `gates`: the commands that must pass before work is reported. Build them from
     `gates.packageManager` and `gates.scripts`. Ask if you cannot tell which ones matter.
   - `rules`: the rule files from `gates.agentRules`.
   - `decisions`, `reviewSkill`, `rerunReview`, `chat`, `lowRiskLabels`: set each one only if
     the project has it. Use `null`, or an empty list, for the rest.
   - `tracker`: the tracker you read in step 1, or `null`.
   - `releaseDocs`, `stagingCommand`, `productionCommand`: how the project publishes a
     release. Take them from `releases.workflowsThatDeploy` and from the user. A command
     holds `{version}` and `{sha}`. Never invent a release command: ask.
5. Write the file to `<state directory>/yard.config.json`. The state directory is
   `machine.stateDir`.
6. Check it: `node ~/.claude/skills/board/board.mjs --check`. Fix every problem it reports. Do not
   build while a problem remains.
7. Build the first yard: follow the steps of the `board` skill
   (`~/.claude/skills/board/SKILL.md`). For a new project, publish a new artifact, then write its
   address to `artifact-url.txt` in the state directory and to `"artifactUrl"` in the config.
8. Show the user the yard, and say in three lines what each colour and each lever means for them.

## 5. Extras

Offer each one alone. Do nothing here without a yes.

- **Refresh on a schedule.** A scheduled task that follows the `board` skill every 30 minutes in
  working hours. It needs the Claude desktop app open. Model its prompt on the steps of the `board`
  skill, with this project's paths, and make it read-only outside the state directory.
- **Menu bar app.** macOS only, and it needs the Swift compiler. Build it with
  `~/.claude/skills/board/widget/build.sh`. It shows the project that was built last.
- **Start at login.** `~/.claude/skills/board/widget/login.sh on`. Turn it off with `off`.

## Rules

- Steps 1 to 3 only read. Write no file before step 4.
- Never guess a status name, a label, or a tag pattern. Use what you saw, or ask.
- Never overwrite an existing `yard.config.json` without showing what changes.
- One project, one state directory, one artifact. Do not publish over another project's yard.
- If the user describes their workflow in their own words, use that description in place of what
  step 1 found, then continue from step 2.
