---
name: board-cut-release
description: Prepare the next release from the merged changes that are not live, and deploy to each environment only after the user agrees. Use when the Pipeline Yard "Release" switch starts a session, or when the user says "cut the release".
---

# Cut the release

The Pipeline Yard starts this skill from the switch on the "Release" line. Merged changes wait on
the main branch or on Staging and are not in Production.

## Project facts

Run this in the repository before anything else:

```bash
node ~/.claude/skills/board/board.mjs --project
```

It prints the facts of this project: the branch that pull requests merge into, the gate commands,
the rule files, the labels, the tracker statuses, and the release commands. Where this skill says
"the project's", use the value from that output. If a value is empty, the project has none: skip
the step that needs it, and say so in the report.

The facts say how this project releases:

- `release.mode` is "tags" when a tag marks a release. If it is "none", the project has no release
  flow in its config. Say so and stop: ask the user how they release.
- `release.production` and `release.staging` are the patterns of the tags of each environment.
- `release.stagingCommand` and `release.productionCommand` are the commands that publish a
  release. `{version}` and `{sha}` are the parts you fill in.
- `release.docs` are the files that describe the release flow. Read each one before you do
  anything. If they describe a different flow from the config, follow the files and tell the user.

## Steps

1. Find the state: the newest Production tag, the newest Staging tag, and the commits on the main
   branch after each. Use `git tag --sort=-creatordate` and `git log <tag>..origin/<main branch> --oneline`.
2. List what the release holds: each merged pull request, its ticket, and its risk label. Call out
   anything risky: a data migration, a dependency change, a change to caching or redirects.
3. Choose the next version by semantic versioning from the commit types. Say which and why.
4. Check that the main branch is green: the latest checks on the commit you will release.
5. Show the user the plan: the version, the commit, the list, and the exact command. Ask to deploy
   to Staging. Wait for the answer.
6. After a yes: run the staging command. Then watch the deploy and report its result.
7. Tell the user what to check on Staging. Do not deploy to Production in the same step.
8. When the user says Staging is good: ask to deploy to Production. After a yes, run the
   production command on the same commit.
9. Report the result. Remind the user that the tickets now need the close-out step.

A project with one environment has no staging command. Then steps 5 to 7 do not apply: ask one
time, before the production command.

## Rules

- Never publish a release before the user agrees to that exact environment in this session.
- Never release a commit whose checks fail.
- Production always gets the same commit that Staging got.
- Never move or delete a tag. Never push to the main branch.
