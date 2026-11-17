---
name: board-close-out
description: For changes that are live in Production, draft the evidence comment for each ticket from its pull request, then post the comments and move the tickets on after the user agrees. Use when the Pipeline Yard "Arrived" switch starts a session, or when the user says "close out the release".
---

# Close out

The Pipeline Yard starts this skill from the switch on the "Arrived" line. The prompt names the
tickets and their pull requests. Each change is live in Production, and its ticket does not say so.

The goal is that each ticket has one evidence comment and stands in the project's QA target
status.

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

1. Confirm each change is live. The merge commit of the pull request must be an ancestor of the
   newest Production tag: `git merge-base --is-ancestor <sha> <tag>`. Skip any change that is not
   live, and say so.
2. The list in the prompt can be up to 30 minutes old. Read the current status of each ticket.
   Skip a ticket that is already in one of the project's QA statuses. Say so.
3. Read each pull request: its description, and above all the part that shows the change works.
4. Read each ticket with the connector of the project's tracker, to learn what the reporter asked
   for.
5. Draft one comment for each ticket. Keep it short, in plain words a tester can act on:
   - What changed, in one or two sentences.
   - Where to see it: the page or the route, in Production.
   - How to check it: the steps, taken from the pull request.
   - The pull request link and the release version.
   Do not paste code. Do not include images or upload placeholders.
6. Show the user every draft in one list. Wait for the user to agree or to change it.
7. After the user agrees: post each comment with the tracker connector, then set the status of the
   ticket to the project's QA target status.

## Rules

- Never post a comment or move a ticket before the user agrees.
- Never claim a result the pull request does not show. If it shows no evidence, say "Not captured"
  and name the check that proves the change.
- One comment for each ticket. If the ticket already has an evidence comment for this pull
  request, do not post a second one.
