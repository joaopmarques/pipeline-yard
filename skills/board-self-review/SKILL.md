---
name: board-self-review
description: Review a list of the user's branches with fresh eyes before a pull request opens, report the findings, and mark each clean branch as reviewed. Use when the Pipeline Yard "Building" switch starts a session, or when the user says "self-review my branches".
---

# Self-review

The Pipeline Yard starts this skill from the switch on the "Building" line. The prompt names the
branches. A different session wrote the code. This session has not seen how it was built, and that
is the point: review the change, not the story of the change.

The goal is one verdict for each branch, and a marker on each branch that passes.

## Project facts

Run this in the repository before anything else:

```bash
node ~/.claude/skills/board/board.mjs --project
```

It prints the facts of this project: the branch that pull requests merge into, the gate commands,
the rule files, the labels, the tracker statuses, and the release commands. Where this skill says
"the project's", use the value from that output. If a value is empty, the project has none: skip
the step that needs it, and say so in the report.

## For each branch, in the order given

1. Read the diff against the project's main branch: `git diff origin/<main branch>...<branch>`. Do
   not read the transcript or the notes of the session that wrote it.
2. Find what the change is for: the ticket in the branch name or the commit messages.
3. Review it. If the project names a review skill, use it. If not, read the diff yourself: check
   correctness first, then each guardrail in the project's rule files.
4. Check that the project's gate commands pass in the worktree of the branch.
5. Give a verdict: **clean**, **nits**, or **blockers**. A blocker is a defect a user or a
   reviewer hits. Give the file and line, and a concrete failure for each finding.
6. If the verdict is clean or nits, write the marker: the file
   `<git common dir>/self-review/<branch with every "/" replaced by "__">`, holding the commit SHA
   of the branch head. Find the directory with `git rev-parse --git-common-dir`. The Pipeline Yard
   reads this file.
7. If the verdict is blockers, write no marker.

## Report

For each branch: the verdict, then the findings, most severe first. Keep it short. Do not fix the
code: the session that owns the branch does that. Do not push, and do not open a pull request.

## Rules

- Do not change source files. This skill reads and reports.
- A finding that conflicts with the project's decisions file is not a finding.
- If a branch has no commits ahead of the main branch, say so and skip it.
