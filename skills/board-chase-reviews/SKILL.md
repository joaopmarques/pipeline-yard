---
name: board-chase-reviews
description: Work out who should review each of the user's waiting pull requests, draft the review requests and the nudges, and send them only after the user agrees. Use when the Pipeline Yard "Reviewers" switch starts a session, or when the user says "chase my reviews".
---

# Chase reviews

The Pipeline Yard starts this skill from the switch on the "Reviewers" line. The prompt names the
pull requests. Each one has no reviewer, or has waited too long for one.

The goal is that every listed pull request has the right reviewer asked, with one clear message.

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

1. Read each pull request: `gh pr view <N> --json title,body,files,labels,reviewRequests,reviews,updatedAt,url`.
2. The list in the prompt can be up to 30 minutes old. Skip a pull request that is merged or
   closed, that already has a reviewer asked in the last two days, or that is approved.
   Skip one that is not ready for a person: a draft, failing checks, or the project's blocker
   label. Say why you skipped each one.
3. Find the best reviewer for each one:
   - Look at the code owners file if the repository has one.
   - Look at who reviewed or changed the same files lately: `git log --format=%an -- <paths>` and
     recent merged pull requests in the same area.
   - Do not pick the author. Spread the load: do not give one person every request.
4. Read the labels. If the pull request has one of the project's low-risk labels, it needs a skim.
   Say so in the message, because it makes a yes faster.
5. Draft, for each pull request, one line: the reviewer, and a message of two sentences at most.
   The message says what the change is, how risky it is, and what kind of look it needs.
6. Show the user every draft in one list. Wait for the user to agree or to change it.
7. After the user agrees: request the reviewer with `gh pr edit <N> --add-reviewer <login>`. If the
   user wants a chat message too, and the project names a chat tool, create the message as a draft
   with its connector. Do not send it.

## Rules

- Never request a review, post a comment, or send a message before the user agrees.
- Never approve, merge, or change a pull request.
- If you cannot tell who should review, say so. Do not guess a name.
