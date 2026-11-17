---
name: board-start-tickets
description: Start work on a list of tickets that have no session yet, grouped by area, and stop before any push or pull request. Use when the Pipeline Yard "Inbox" switch starts a session, or when the user says "start the urgent tickets".
---

# Start tickets

The Pipeline Yard starts this skill from the switch on the "Inbox" line. The prompt names the
tickets. No session works on them yet.

The goal is that each ticket is fixed on a branch, with the gates green and the commits ready.
The user opens the pull requests.

## Project facts

Run this in the repository before anything else:

```bash
node ~/.claude/skills/board/board.mjs --project
```

It prints the facts of this project: the branch that pull requests merge into, the gate commands,
the rule files, the labels, the tracker statuses, and the release commands. Where this skill says
"the project's", use the value from that output. If a value is empty, the project has none: skip
the step that needs it, and say so in the report.

## Steps

1. Read each ticket with the connector of the project's tracker: the description, the comments,
   and the images. The list in the prompt can be up to 30 minutes old. Skip a ticket that is no
   longer in an inbox status, or that already has a branch, a pull request, or a session. Say why
   you skipped it.
2. Sort the tickets by area of the product. Tickets in one area share one branch and, later, one
   pull request. Use one commit for each ticket.
3. Tell the user the plan in a short list: each area, its branch name, and its tickets. Do not wait
   for an answer unless two tickets conflict or a ticket is not clear enough to start.
4. Work on one area at a time, in a worktree of its own branch from the project's main branch.
5. For each ticket: reproduce the problem first. If a bug-fix skill is available, use it. Find the
   cause, fix it, and add or change a test that fails without the fix.
6. Follow the project's rule files. Read the rule for the area before you edit it.
7. Run the project's gate commands.
8. Commit. Put the ticket identifier in the commit message.
9. Do not push. Do not open a pull request. Do not change a ticket in the tracker.

## Report

For each area: the branch, the tickets fixed, the tickets you could not finish and why, and the
gate results. Then ask which branches to push and open as pull requests. The user reviews the
code in a different session before a pull request opens.

## Rules

- One area at a time. Finish it, then start the next.
- A ticket that needs a design decision or copy is not yours to decide. Report it and move on.
- Never push to the project's main branch. Never bypass a hook or a gate.
