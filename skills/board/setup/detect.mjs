#!/usr/bin/env node
// Look at the repository in the current directory and report the facts the setup wizard needs.
// This script only reads. It changes nothing, on disk or on GitHub.
//
// Usage: node detect.mjs

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const sh = (cmd, argv) => {
  try {
    return execFileSync(cmd, argv, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 32 * 1024 * 1024 }).trim();
  } catch {
    return null;
  }
};
const json = (cmd, argv) => {
  const out = sh(cmd, argv);
  try {
    return out ? JSON.parse(out) : null;
  } catch {
    return null;
  }
};
const count = (list) => {
  const out = {};
  for (const item of list) out[item] = (out[item] ?? 0) + 1;
  return Object.fromEntries(Object.entries(out).sort((a, b) => b[1] - a[1]));
};

const root = sh("git", ["rev-parse", "--show-toplevel"]);
const repo = json("gh", ["repo", "view", "--json", "nameWithOwner,defaultBranchRef,url"]);
const facts = {
  repository: {
    root,
    name: repo?.nameWithOwner ?? null,
    defaultBranch: repo?.defaultBranchRef?.name ?? null,
    githubSignedIn: sh("gh", ["auth", "status"]) !== null,
    me: sh("gh", ["api", "user", "--jq", ".login"]),
  },
};

// --- Pull requests: how the user works with review, drafts, and labels. ---
const open = json("gh", ["pr", "list", "--author", "@me", "--state", "open", "--limit", "100", "--json", "number,title,isDraft,labels,reviewDecision,reviewRequests,headRefName"]) ?? [];
const merged = json("gh", ["pr", "list", "--state", "merged", "--limit", "40", "--json", "number,title,labels,headRefName,mergedAt"]) ?? [];
const labelNames = [...open, ...merged].flatMap((pr) => pr.labels.map((l) => l.name));
const families = {};
for (const name of labelNames) {
  const split = name.match(/^(.+?:\s*)(.+)$/);
  if (!split) continue;
  families[split[1]] ??= new Set();
  families[split[1]].add(split[2]);
}
facts.pullRequests = {
  openByMe: open.length,
  drafts: open.filter((pr) => pr.isDraft).length,
  withReviewerAsked: open.filter((pr) => pr.reviewRequests.length > 0).length,
  reviewDecisions: count(open.map((pr) => pr.reviewDecision || "none")),
  labels: count(labelNames),
  // A family is a set of labels with one prefix, such as "risk: low" and "risk: high".
  labelFamilies: Object.fromEntries(Object.entries(families).map(([prefix, values]) => [prefix, [...values]])),
};

// --- Tickets: the keys that show in branch names and titles point to the tracker. ---
const keys = [...open, ...merged].flatMap((pr) => `${pr.title} ${pr.headRefName}`.toUpperCase().match(/\b[A-Z]{2,6}-\d+\b/g) ?? []).map((id) => id.replace(/-\d+$/, ""));
facts.tickets = {
  keysSeen: count(keys),
  pullRequestsWithAKey: [...open, ...merged].filter((pr) => /\b[A-Za-z]{2,6}-\d+\b/.test(`${pr.title} ${pr.headRefName}`)).length,
  pullRequestsLooked: open.length + merged.length,
};

// --- Releases: tags, GitHub releases, deployments, and the workflows that deploy. ---
const tags = (sh("git", ["tag", "--sort=-creatordate"]) ?? "").split("\n").filter(Boolean).slice(0, 40);
const plain = tags.filter((t) => /^v?\d+\.\d+\.\d+$/.test(t));
const suffixed = tags.filter((t) => /^v?\d+\.\d+\.\d+-/.test(t));
const releases = json("gh", ["release", "list", "--limit", "15", "--json", "tagName,isPrerelease,isLatest"]) ?? [];
const deployments = repo ? json("gh", ["api", `repos/${repo.nameWithOwner}/deployments?per_page=60`]) ?? [] : [];
const workflowDir = root ? join(root, ".github", "workflows") : null;
const workflows = workflowDir && existsSync(workflowDir) ? readdirSync(workflowDir).filter((f) => /\.ya?ml$/.test(f)) : [];
facts.releases = {
  recentTags: tags.slice(0, 10),
  plainVersionTags: plain.length,
  suffixedVersionTags: suffixed.length,
  suffixesSeen: count(suffixed.map((t) => t.replace(/^v?\d+\.\d+\.\d+-/, "").replace(/[.\d]+$/, ""))),
  githubReleases: releases.slice(0, 6),
  deploymentEnvironments: count(deployments.map((d) => `${d.environment} (by ${d.creator?.login ?? "unknown"})`)),
  workflowsThatDeploy: workflows.filter((f) => /deploy|release|publish/i.test(f) || /^\s*(release|deployment|workflow_run):\s*$/m.test(readFileSync(join(workflowDir, f), "utf8"))),
};

// --- Gates: the commands a lever skill must run before it reports. ---
const pkgFile = root ? join(root, "package.json") : null;
const pkg = pkgFile && existsSync(pkgFile) ? JSON.parse(readFileSync(pkgFile, "utf8")) : null;
facts.gates = {
  packageManager: pkg?.packageManager ?? null,
  scripts: pkg ? Object.keys(pkg.scripts ?? {}).filter((name) => /^(check|lint|test|typecheck|check-types|format|build|fix)(:|$)/.test(name)) : [],
  hasCodeowners: root ? ["CODEOWNERS", ".github/CODEOWNERS", "docs/CODEOWNERS"].some((f) => existsSync(join(root, f))) : false,
  agentRules: root ? ["AGENTS.md", "CLAUDE.md"].filter((f) => existsSync(join(root, f))) : [],
};

// --- This machine: what is already set up. ---
const skillsDir = join(homedir(), ".claude", "skills");
const stateDir = repo ? join(homedir(), ".claude", "board", repo.nameWithOwner.replace("/", "__")) : null;
facts.machine = {
  platform: process.platform,
  stateDir,
  hasConfig: stateDir ? existsSync(join(stateDir, "yard.config.json")) : false,
  hasBuiltPage: stateDir ? existsSync(join(stateDir, "board.html")) : false,
  leverSkills: existsSync(skillsDir) ? readdirSync(skillsDir).filter((name) => name.startsWith("board-")) : [],
  hasMenuBarApp: existsSync(join(homedir(), "Applications", "Pipeline Yard.app")),
};

// --- A first reading of the facts. The wizard checks it with the user. ---
const notes = [];
if (!facts.repository.githubSignedIn) notes.push("The gh command is not signed in. The yard cannot read pull requests.");
const topKey = Object.keys(facts.tickets.keysSeen)[0] ?? null;
facts.reading = {
  ticketKey: topKey,
  releaseMode: plain.length ? "tags" : "none",
  hasStagingTags: suffixed.length > 0,
  reviewLabels: Object.keys(facts.pullRequests.labelFamilies),
  notes,
};

console.log(JSON.stringify(facts, null, 2));
