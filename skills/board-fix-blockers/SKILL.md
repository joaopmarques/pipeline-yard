---
name: board-fix-blockers
description: Fix the review blockers on a list of the user's open pull requests, one at a time, and stop before pushing. Use when the Pipeline Yard "Your move" switch starts a session, or when the user says "fix the blockers on #N" or "fix the review comments on my PRs".
---

# Fix blockers

The Pipeline Yard starts this skill from the switch on the "Your move" line. The prompt names the
pull requests. Each one has blockers from an automated review, or a human reviewer asked for
changes.

The goal is one outcome for each pull request: every real blocker is fixed, the project's gates
pass, and one commit is ready on the pull request branch. The user decides when to push.

## Project facts

Run this in the repository before anything else:

```bash
node ~/.claude/skills/board/board.mjs --project
```

It prints the facts of this project: the branch that pull requests merge into, the gate commands,
the rule files, the labels, the tracker statuses, and the release commands. Where this skill says
"the project's", use the value from that output. If a value is empty, the project has none: skip
the step that needs it, and say so in the report.

## For each pull request, in the order given

1. Read the pull request: `gh pr view <N> --json title,body,headRefName,labels,reviewDecision,files`.
2. Read every finding. Use `gh api repos/{owner}/{repo}/pulls/<N>/comments` for inline comments
   and `gh api repos/{owner}/{repo}/pulls/<N>/reviews` for review bodies. Ignore resolved threads.
3. Find the worktree of the branch with `git worktree list`. If there is none, add one with
   `git worktree add`. Work only in that worktree. Do not change the checkout of another session.
4. Judge each finding before you change code. Read the code it points at.
   - If the finding is correct, fix it.
   - If the finding is wrong, do not change code. Write down the reason in one sentence.
   - If the finding conflicts with the project's decisions file, or the fix reverts work the user
     approved, stop on that finding and ask the user.
5. Follow the project's rule files. Read the rule for the area before you edit it.
6. Run the project's gate commands. Fix what fails. Report a failure you cannot fix, with its
   output.
7. Make one commit on the pull request branch. Name the findings it fixes in the message.
8. Do not push. Do not comment on the pull request. Do not resolve threads.

## Report

After the last pull request, report one short block for each:

- The pull request number and title.
- Findings fixed, as a count and a one-line list.
- Findings rejected, each with its reason.
- Gate results.
- The commit, and that it is not pushed.

Then ask one question: which pull requests to push. After the user answers, push only those. If
the project has a comment that starts the automated review again, post it on each pushed pull
request.

## Rules

- One pull request at a time. Finish it, then start the next.
- Never merge. Never push to the project's main branch. Never force-push.
- Never bypass a hook or a gate.
- The list in the prompt can be up to 30 minutes old. If a pull request is merged or closed, or
  has no open finding, say so and skip it.
