// Read the raw facts for one repository: GitHub, git, and the two files a Claude session supplies
// (tickets.json and sessions.json).
// This module knows nothing about lines, colours, or what any fact means.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// BOARD_FIXTURE names a file that records every command result, then replays it.
// With BOARD_NOW, two runs on one fixture give the same page. Use them to test a change.
export function shell() {
  const fixturePath = process.env.BOARD_FIXTURE;
  const fixture = fixturePath && existsSync(fixturePath) ? JSON.parse(readFileSync(fixturePath, "utf8")) : {};
  const tryRun = (cmd, argv) => {
    const key = [cmd, ...argv].join("\u0001");
    if (fixturePath && key in fixture) return fixture[key];
    let out = null;
    try {
      out = execFileSync(cmd, argv, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();
    } catch {
      out = null;
    }
    if (fixturePath) {
      fixture[key] = out;
      writeFileSync(fixturePath, JSON.stringify(fixture));
    }
    return out;
  };
  const run = (cmd, argv) => {
    const out = tryRun(cmd, argv);
    if (out === null) throw new Error(`Command failed: ${cmd} ${argv.join(" ")}`);
    return out;
  };
  const gh = (argv) => JSON.parse(run("gh", argv));
  return { run, tryRun, gh };
}

export function collect(sh, config, stateDir, repo) {
  const { run, tryRun, gh } = sh;
  const me = run("gh", ["api", "user", "--jq", ".login"]);
  const TEAM = config.team;
  // With no release tags, a pattern that matches nothing keeps every tag out.
  const tagged = (config.release.mode ?? "tags") === "tags";
  const PRODUCTION = new RegExp(tagged ? config.release.production : "$^");
  const STAGING = new RegExp(tagged ? config.release.staging : "$^");

  const readJson = (name) => {
    const file = join(stateDir, name);
    return existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null;
  };
  // The ticket file. "linear.json" is the older name of the same file.
  const linear = readJson("tickets.json") ?? readJson("linear.json");
  const sessions = readJson("sessions.json");

  const now = Number(process.env.BOARD_NOW) || Date.now();
  const days = (iso) => Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  const daysExact = (iso) => Math.max(0, (now - new Date(iso).getTime()) / 86_400_000);
  // Train length: one wagon for each step of size.
  const weightOf = (lines) => (lines < 150 ? 0 : lines < 600 ? 1 : lines < 1500 ? 2 : lines < 4000 ? 3 : 4);
  const age = (iso) => {
    const d = days(iso);
    if (d === 0) return "today";
    return d === 1 ? "1 day ago" : `${d} days ago`;
  };

  const ticketPattern = new RegExp(`\\b${TEAM}-(\\d+)\\b`, "i");
  const ticketOf = (...texts) => {
    if (!TEAM) return null;
    for (const text of texts) {
      const match = text?.match(ticketPattern);
      if (match) return `${TEAM}-${match[1]}`;
    }
    return null;
  };
  const tickets = new Map((linear?.issues ?? []).map((t) => [t.id, t]));

  // --- Releases: the config says which tags mean Production and which mean Staging. ---
  tryRun("git", ["fetch", "--quiet", "--tags", "origin", config.release.branch]);
  const tags = run("git", ["tag", "--sort=-creatordate"]).split("\n").filter(Boolean);
  const prodTags = tags.filter((t) => PRODUCTION.test(t));
  const prodTag = prodTags[0] ?? null;
  const previousProdTag = prodTags[1] ?? null;
  const stagingTag = tags.find((t) => STAGING.test(t)) ?? null;
  const contains = (ref, sha) =>
    Boolean(ref && sha) &&
    tryRun("git", ["merge-base", "--is-ancestor", sha, ref]) !== null;
  const stagingIsAhead = stagingTag && prodTag && !contains(prodTag, stagingTag);

  // --- Pull requests ---
  const openPrs = gh([
    "pr", "list", "--author", "@me", "--state", "open", "--limit", "100", "--json",
    "number,title,isDraft,labels,reviewDecision,reviewRequests,headRefName,createdAt,updatedAt,url,mergeable,mergeStateStatus,statusCheckRollup,additions,deletions,changedFiles",
  ]);
  const mergedPrs = gh([
    "pr", "list", "--state", "merged", "--base", config.release.branch, "--limit", "80", "--json",
    "number,title,author,mergedAt,mergeCommit,headRefName,url",
  ]);

  const commonDir = tryRun("git", ["rev-parse", "--git-common-dir"]);
  const mainCheckout = (tryRun("git", ["worktree", "list", "--porcelain"]) ?? "").match(/^worktree (.+)$/m)?.[1] ?? process.cwd();

  return {
    run, tryRun, gh, repo, me, linear, sessions, now, days, daysExact, weightOf, age, ticketOf, tickets,
    prodTag, previousProdTag, stagingTag, contains, stagingIsAhead, openPrs, mergedPrs, commonDir, mainCheckout,
  };
}
