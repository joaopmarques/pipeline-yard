#!/usr/bin/env node
// Build the pipeline yard for the repository in the current directory.
//
// engine/   draws the yard and builds the page. It knows no project.
// presets/  one workflow each: how to sort work onto lines and what needs the user.
// config    yard.config.json in the state directory: the words, labels, statuses and limits of one project.
//
// A Claude session supplies tickets.json and sessions.json, because a script cannot read them.
//
// Usage: node board.mjs [--config <file>] [--team KEY] [--state <dir>] [--out <file>] [--check]
// --check reads the config, reports each problem, and builds nothing.
// --project prints the facts of the project that the lever skills read, and builds nothing.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { collect, shell } from "./engine/collect.mjs";
import { validate } from "./engine/config.mjs";
import { renderPage } from "./engine/page.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? fallback : args[i + 1];
};

const sh = shell();
const repo = sh.gh(["repo", "view", "--json", "nameWithOwner,url"]);
const stateDir = arg("state", join(homedir(), ".claude", "board", repo.nameWithOwner.replace("/", "__")));
const outFile = arg("out", join(stateDir, "board.html"));
mkdirSync(stateDir, { recursive: true });

// The project config. A project with none gets the example config of the default preset.
const ownConfig = arg("config", join(stateDir, "yard.config.json"));
const configFile = existsSync(ownConfig) ? ownConfig : join(HERE, "presets", "github-linear-releases.config.json");
const config = JSON.parse(readFileSync(configFile, "utf8"));
config.team = arg("team", config.team) || null;

const preset = await import(`./presets/${config.preset}.mjs`);
const problems = validate(config, preset);
if (problems.length) {
  console.error(`The config ${configFile} has ${problems.length} problem${problems.length === 1 ? "" : "s"}:`);
  for (const problem of problems) console.error(`- ${problem}`);
  process.exit(1);
}
if (args.includes("--check")) {
  console.log(`The config ${configFile} is valid.`);
  process.exit(0);
}
if (args.includes("--project")) {
  const project = config.project ?? {};
  const tagged = (config.release.mode ?? "tags") === "tags";
  console.log(
    JSON.stringify(
      {
        configFile,
        stateDir,
        repository: repo.nameWithOwner,
        mainBranch: config.release.branch,
        tracker: project.tracker ?? null,
        team: config.team ?? null,
        gates: project.gates ?? [],
        rules: project.rules ?? [],
        decisions: project.decisions ?? null,
        reviewSkill: project.reviewSkill ?? null,
        rerunReview: project.rerunReview ?? null,
        chat: project.chat ?? null,
        labels: { ...config.labels, lowRisk: project.lowRiskLabels ?? [] },
        statuses: {
          inbox: config.inboxStatuses,
          started: config.startedStatus ?? null,
          qa: config.qaStatuses,
          qaTarget: config.qaTarget ?? null,
          done: config.doneStatus ?? null,
        },
        release: {
          mode: tagged ? "tags" : "none",
          production: tagged ? config.release.production : null,
          staging: tagged ? config.release.staging : null,
          docs: project.releaseDocs ?? [],
          stagingCommand: project.stagingCommand ?? null,
          productionCommand: project.productionCommand ?? null,
        },
      },
      null,
      2
    )
  );
  process.exit(0);
}
const { classify } = preset;
const ctx = collect(sh, config, stateDir, repo);
const sorted = classify(ctx, config);
const { lanes, needs, groups, top, unreleased } = sorted;
const { now, prodTag, stagingTag, contains } = ctx;

// --- Release state: a release that left since the last run departs once on the page. ---
const releaseKey = config.lines.find((line) => line.kind === "release").key;
const statePath = join(stateDir, "release-state.json");
const previous = existsSync(statePath) ? JSON.parse(readFileSync(statePath, "utf8")) : {};
let departed = previous.departed ?? null;
if (previous.prodTag && prodTag && previous.prodTag !== prodTag) {
  const gone = (previous.release ?? []).filter((c) => contains(prodTag, c.sha));
  departed = gone.length ? { tag: prodTag, at: now, cars: gone } : null;
}
if (departed && now - departed.at > 86_400_000) departed = null;
writeFileSync(
  statePath,
  JSON.stringify({
    prodTag,
    departed,
    release: lanes[releaseKey].map((c) => ({ ticketId: c.ticketId, pr: c.pr, title: c.title, sha: c.sha })),
  })
);

const html = renderPage({ ...ctx, ...sorted, config, departed });

writeFileSync(outFile, html);
// The menu bar app reads this file to show the count beside its icon.
writeFileSync(
  join(stateDir, "summary.json"),
  JSON.stringify({ count: needs.length, hot: needs.some((n) => n.rank <= 2), top: top.map((n) => n.short) })
);
// A complete document for the menu bar app. The published page gets its skeleton from the host.
writeFileSync(
  outFile.replace(/\.html$/, ".local.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0}img{max-width:100%}</style></head><body>${html}</body></html>`
);
// The menu bar app shows the project that was built last.
if (!arg("state")) {
  writeFileSync(join(homedir(), ".claude", "board", "active.json"), JSON.stringify({ stateDir, artifactUrl: config.artifactUrl ?? null }));
}
const summary = Object.fromEntries(Object.entries(lanes).map(([key, v]) => [key, v.length]));
console.log(JSON.stringify({ out: outFile, config: configFile, prodTag, stagingTag, unreleased, lanes: summary, needs: top.map((n) => n.short), moreNeeds: groups.length - top.length, count: needs.length, departed: departed?.tag ?? null }, null, 2));
