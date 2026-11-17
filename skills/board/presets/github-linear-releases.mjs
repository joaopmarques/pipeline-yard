// Workflow preset: GitHub pull requests, Linear tickets, Claude sessions, and releases cut by tag.
// It sorts every item onto a line, says what needs the user, and prepares the switches.
// It owns the line keys: inbox, building, yourMove, waiting, release, live.
// The project config supplies the words, the labels, the statuses, and the limits.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fill } from "../engine/fill.mjs";

// The lines this preset fills, and the kind each one must have.
export const LINE_KEYS = ["inbox", "building", "yourMove", "waiting", "release", "live"];
export const LINE_KINDS = { inbox: "tickets", building: "work", yourMove: "work", waiting: "work", release: "release", live: "arrivals" };

export function classify(ctx, config) {
  const {
    tryRun, me, sessions, now, days, daysExact, weightOf, age, ticketOf, tickets,
    prodTag, previousProdTag, stagingTag, contains, openPrs, mergedPrs, commonDir, mainCheckout,
  } = ctx;
  const QA_STATUSES = new Set(config.qaStatuses);
  const STALE_REVIEW_DAYS = config.staleReviewDays;
  const INBOX_LIMIT = config.inboxLimit;
  const LABEL = config.labels;
  // A project with no release tags has no Staging and no Production. Its release line shows what merged lately.
  const NO_RELEASES = config.release.mode === "none";
  const DONE_DAYS = config.doneDays ?? 7;

  const sessionFor = (pr) =>
    (sessions?.sessions ?? []).find(
      (s) => s.prNumber === pr.number || s.branch === pr.headRefName
    );
  const cleanTitle = (title) =>
    title.replace(/^[a-z]+(\([^)]*\))?!?:\s*/i, "").replace(/\s*\([A-Z]+-\d+\)\s*$/, "");

  const card = (base) => {
    const ticket = base.ticketId ? tickets.get(base.ticketId) : null;
    return {
      ...base,
      title: base.title,
      ticketUrl: ticket?.url ?? null,
      ticketStatus: ticket?.status ?? null,
      urgent: ticket?.priority === 1,
    };
  };

  const lanes = { inbox: [], building: [], yourMove: [], waiting: [], release: [], live: [] };
  const needs = [];
  const claimedTickets = new Set();
  const claimedSessions = new Set();

  // What GitHub says about an open pull request: review, merge state, and checks.
  const ghOf = (pr) => {
    const runs = pr.statusCheckRollup ?? [];
    const failed = runs.some((r) => ["FAILURE", "ERROR", "TIMED_OUT", "CANCELLED", "ACTION_REQUIRED"].includes(r.conclusion ?? r.state));
    const pending = runs.some((r) => (r.status && r.status !== "COMPLETED") || r.state === "PENDING" || r.state === "EXPECTED");
    let checks = null;
    if (runs.length) checks = failed ? "failing" : pending ? "running" : "passing";
    let merge = null;
    if (pr.mergeable === "CONFLICTING" || pr.mergeStateStatus === "DIRTY") merge = "conflicts";
    else if (pr.mergeStateStatus === "CLEAN") merge = "clean";
    else if (pr.mergeStateStatus === "BEHIND") merge = "behind";
    else if (pr.mergeStateStatus === "BLOCKED") merge = "blocked";
    return { state: pr.isDraft ? "draft" : "open", review: pr.reviewDecision || null, merge, checks };
  };

  for (const pr of openPrs) {
    const labels = pr.labels.map((l) => l.name);
    const risk = labels.find((l) => l.startsWith(LABEL.risk))?.slice(LABEL.risk.length);
    const agent = labels.find((l) => l.startsWith(LABEL.agentReview))?.slice(LABEL.agentReview.length);
    const session = sessionFor(pr);
    const ticketId = ticketOf(pr.title, pr.headRefName, session?.title);
    if (ticketId) claimedTickets.add(ticketId);
    if (session) claimedSessions.add(session.sessionId);
    const base = {
      ticketId,
      title: cleanTitle(pr.title),
      pr: pr.number,
      prUrl: pr.url,
      gh: ghOf(pr),
      branch: pr.headRefName,
      age: daysExact(pr.createdAt),
      weight: weightOf(pr.additions + pr.deletions),
      sizeText: `+${pr.additions} −${pr.deletions} in ${pr.changedFiles} file${pr.changedFiles === 1 ? "" : "s"}`,
      session: session?.title ?? null,
      sessionId: session?.sessionId ?? null,
      running: session?.isRunning ?? false,
      meta: [risk && `${risk} risk`, `opened ${age(pr.createdAt)}`].filter(Boolean),
    };
    const reviewers = pr.reviewRequests.map((r) => r.login ?? r.name).filter(Boolean);
    const stale = labels.includes(LABEL.stale);

    if (pr.isDraft) {
      lanes.building.push(card({ ...base, note: "Draft PR", tone: "quiet" }));
    } else if (pr.reviewDecision === "APPROVED") {
      lanes.yourMove.push(card({ ...base, note: "Approved. Merge it", tone: "good" }));
      needs.push({ rank: 1, text: `Merge #${pr.number}: ${base.title}` });
    } else if (pr.reviewDecision === "CHANGES_REQUESTED") {
      lanes.yourMove.push(card({ ...base, note: "Changes requested", tone: "bad", fixable: true }));
      needs.push({ rank: 2, text: `Fix the review comments on #${pr.number}` });
    } else if (agent === LABEL.blockers) {
      lanes.yourMove.push(
        card({ ...base, note: "Agent review found blockers", tone: "bad", fixable: true })
      );
      needs.push({ rank: 2, text: `Fix the agent blockers on #${pr.number}` });
    } else {
      const waited = days(pr.updatedAt);
      let note = `Waiting on ${reviewers.join(", ")}, ${age(pr.updatedAt)}`;
      let tone = waited >= STALE_REVIEW_DAYS ? "warn" : "quiet";
      if (reviewers.length === 0) {
        note = "No reviewer asked";
        tone = days(pr.createdAt) >= 1 ? "bad" : "warn";
        needs.push({ rank: 3, text: `Ask for a review on #${pr.number}: ${base.title}` });
      } else if (waited >= STALE_REVIEW_DAYS) {
        needs.push({ rank: 3, text: `Nudge ${reviewers.join(", ")} on #${pr.number}` });
      }
      if (stale) base.meta.push("agent review is stale");
      lanes.waiting.push(card({ ...base, note, tone }));
    }
  }

  // --- Sessions with a branch and no pull request ---
  const mergedBranches = new Set(mergedPrs.map((p) => p.headRefName));
  for (const s of sessions?.sessions ?? []) {
    if (claimedSessions.has(s.sessionId) || !s.branch || s.prNumber) continue;
    if (mergedBranches.has(s.branch) || days(s.lastActivityAt) > 14) continue;
    const head = tryRun("git", ["rev-parse", "--verify", "-q", `refs/heads/${s.branch}`]);
    const ahead = head
      ? Number(tryRun("git", ["rev-list", "--count", `origin/main..${head}`]) ?? 0)
      : 0;
    const stat = head ? (tryRun("git", ["diff", "--shortstat", `origin/main...${head}`]) ?? "") : "";
    const changed = Number(stat.match(/(\d+) insertion/)?.[1] ?? 0) + Number(stat.match(/(\d+) deletion/)?.[1] ?? 0);
    const marker = join(commonDir ?? "", "self-review", s.branch.replaceAll("/", "__"));
    const reviewed =
      head && existsSync(marker) && readFileSync(marker, "utf8").trim() === head;
    const ticketId = ticketOf(s.title, s.branch);
    if (ticketId) claimedTickets.add(ticketId);
    let note = "No commits yet";
    let tone = "quiet";
    if (ahead > 0 && reviewed) {
      note = "Self-reviewed. Open the PR";
      tone = "good";
    } else if (ahead > 0) {
      note = `${ahead} commit${ahead === 1 ? "" : "s"}, no self-review yet`;
      tone = s.isRunning ? "quiet" : "warn";
    }
    lanes.building.push(
      card({
        ticketId,
        title: tickets.get(ticketId)?.title ?? s.title,
        session: s.title,
        sessionId: s.sessionId,
        branch: s.branch,
        running: s.isRunning,
        age: daysExact(s.lastActivityAt),
        weight: weightOf(changed),
        sizeText: changed ? `${changed} lines changed` : null,
        note,
        tone,
        meta: [`active ${age(s.lastActivityAt)}`],
      })
    );
  }

  // --- Merged work: where is each change now? ---
  let unreleased = 0;
  let closedOut = 0;
  let oldestUnreleased = null;
  for (const pr of mergedPrs) {
    const sha = pr.mergeCommit?.oid;
    if (!sha || contains(previousProdTag, sha)) continue;
    const ticketId = ticketOf(pr.title, pr.headRefName);
    const mine = pr.author.login === me;
    const base = {
      ticketId,
      title: cleanTitle(pr.title),
      pr: pr.number,
      prUrl: pr.url,
      gh: { state: "merged" },
      mine,
      sha,
      age: daysExact(pr.mergedAt),
      meta: [`merged ${age(pr.mergedAt)}`],
    };
    if (ticketId) claimedTickets.add(ticketId);
    const status = tickets.get(ticketId)?.status;

  if (NO_RELEASES) {
    if (days(pr.mergedAt) <= DONE_DAYS && lanes.release.length < (config.doneLimit ?? 10)) lanes.release.push(card({ ...base, where: "Merged", tone: "quiet" }));
    continue;
  }

    if (contains(prodTag, sha)) {
      if (!status) continue;
      if (QA_STATUSES.has(status)) {
        closedOut += 1;
        continue;
      }
      lanes.live.push(
        card({ ...base, note: `Linear still says ${status}`, tone: "warn", where: prodTag })
      );
      needs.push({ rank: 5, text: `Post evidence and move ${ticketId} to ${config.qaTarget}` });
      continue;
    }

    unreleased += 1;
    if (!oldestUnreleased || pr.mergedAt < oldestUnreleased) oldestUnreleased = pr.mergedAt;
    const onStaging = contains(stagingTag, sha);
    const lying = status && QA_STATUSES.has(status) && status !== config.doneStatus;
    lanes.release.push(
      card({
        ...base,
        where: onStaging ? `Staging ${stagingTag}` : "Main only",
        note: lying ? `Linear says ${status}. It is not live` : null,
        tone: lying ? "bad" : "quiet",
      })
    );
  }
  if (unreleased > 0) {
    needs.push({
      rank: 4,
      text: `Release: ${unreleased} merged change${unreleased === 1 ? " is" : "s are"} not in Production, oldest merged ${age(oldestUnreleased)}`,
    });
  }
  for (const c of lanes.building) {
    if (c.tone === "warn") needs.push({ rank: 6, text: `Self-review: ${c.title}` });
  }

  // --- Inbox: tickets with no session and no pull request ---
  const waitingTickets = [...tickets.values()]
    .filter((t) => !claimedTickets.has(t.id))
    .filter((t) => config.inboxStatuses.includes(t.status))
    .filter((t) => !/^\[?epic\]?/i.test(t.title))
    .sort((a, b) => (a.priority || 9) - (b.priority || 9));
  const inboxMore = Math.max(0, waitingTickets.length - INBOX_LIMIT);
  for (const t of waitingTickets.slice(0, INBOX_LIMIT)) {
    lanes.inbox.push(
      card({
        ticketId: t.id,
        title: t.title,
        age: t.createdAt ? daysExact(t.createdAt) : 0,
        note: t.status === config.startedStatus ? "In progress on Linear, no session found" : t.priorityName,
        tone: t.status === config.startedStatus ? "warn" : "quiet",
        meta: [],
      })
    );
  }

  // --- Calibrate the alarm. Red means "do this next", so only a few items are red. ---
  const allCards = Object.values(lanes).flat();
  const cardOf = (need) =>
    allCards.find(
      (c) =>
        (c.pr && new RegExp(`#${c.pr}\\b`).test(need.text)) ||
        (need.rank === 5 && c.ticketId && need.text.includes(c.ticketId)) ||
        (need.rank === 6 && need.text.endsWith(c.title))
    ) ?? null;
  for (const need of needs) need.card = cardOf(need);
  needs.sort((a, b) => a.rank - b.rank || (b.card?.age ?? 0) - (a.card?.age ?? 0));
  const redCards = new Set(needs.slice(0, config.redMax).map((need) => need.card).filter(Boolean));
  for (const c of allCards) {
    if (c.tone === "bad" && !redCards.has(c)) c.tone = "warn";
  }
  for (const c of redCards) {
    if (c.tone !== "good") c.tone = "bad";
  }

  // --- Switches: one click prepares a Claude session with a prompt made for that line. ---
  // The link opens the Claude app with the prompt filled in. The user sends it.
  // Each prompt names a skill that holds the detail, so the prompt stays short.
  const switches = {};
  const values = {
    production: prodTag ?? "not released yet",
    staging: stagingTag ?? "empty",
    liveIn: prodTag ?? "Production",
  };
  const addSwitch = (key, items, list, { count = items.length, name } = {}) => {
    const lever = config.lines.find((line) => line.key === key)?.lever;
    if (!lever || !items.length) return;
    const prompt = fill(
      lever.prompt,
      { ...values, skill: `Use the ${lever.skill} skill (~/.claude/skills/${lever.skill}/SKILL.md).`, list, count },
      count
    );
    switches[key] = {
      label: lever.label,
      name: name ?? lever.name,
      count: items.length,
      items,
      prompt,
      url: `claude://code/new?q=${encodeURIComponent(prompt)}&folder=${encodeURIComponent(mainCheckout)}&source=pipeline-yard`,
    };
  };

  {
    const urgent = lanes.inbox.filter((c) => c.urgent);
    const cards = (urgent.length ? urgent : lanes.inbox).slice(0, 4);
    const lever = config.lines.find((line) => line.key === "inbox")?.lever;
    addSwitch("inbox", cards.map((c) => `${c.ticketId} ${c.title}`), cards.map((c) => c.ticketId).join(", "), {
      name: urgent.length ? lever?.name : lever?.nameFallback,
    });
  }
  {
    const cards = lanes.building.filter((c) => c.branch && (c.gh?.state === "draft" || /no self-review/.test(c.note ?? ""))).slice(0, 6);
    addSwitch("building", cards.map((c) => `${c.pr ? `#${c.pr} ` : ""}${c.title}`), cards.map((c) => c.branch).join(", "));
  }
  {
    const cards = lanes.yourMove.filter((c) => c.fixable && c.pr);
    addSwitch("yourMove", cards.map((c) => `#${c.pr} ${c.title}`), cards.map((c) => `#${c.pr}`).join(", "));
  }
  {
    const cards = lanes.waiting.filter((c) => c.pr && c.tone !== "quiet").slice(0, 10);
    addSwitch("waiting", cards.map((c) => `#${c.pr} ${c.title}`), cards.map((c) => `#${c.pr}`).join(", "));
  }
  if (unreleased > 0) {
    addSwitch("release", lanes.release.map((c) => `#${c.pr} ${c.title}`), "", { count: unreleased });
  }
  {
    const cards = lanes.live.filter((c) => c.ticketId && c.pr);
    addSwitch("live", cards.map((c) => `${c.ticketId} ${c.title}`), cards.map((c) => `${c.ticketId} (#${c.pr})`).join(", "));
  }

  // --- The board in the yard: short rows, one for each kind of work. ---
  const laneOfRank = { 1: "yourMove", 2: "yourMove", 3: "waiting", 4: "release", 5: "live", 6: "building" };
  const shortOf = (n) => {
    const pr = n.text.match(/#\d+/)?.[0] ?? "";
    if (n.rank === 1) return `MERGE ${pr}`;
    if (n.rank === 2) return `${/review comments/.test(n.text) ? "FIX REVIEW" : "FIX BLOCKERS"} ${pr}`;
    if (n.rank === 3) return `${n.text.startsWith("Ask") ? "ASK REVIEW" : "NUDGE"} ${pr}`;
    if (n.rank === 4) return `RELEASE ${unreleased} CHANGE${unreleased === 1 ? "" : "S"}`;
    if (n.rank === 5) return `CLOSE ${n.text.match(/[A-Z]+-\d+/)?.[0] ?? "TICKET"}`;
    return `SELF-REVIEW ${n.text.replace(/^[^:]*:\s*/, "").slice(0, 12).toUpperCase()}`;
  };
  needs.sort((a, b) => a.rank - b.rank);
  // One row on the board for each kind of work, with a count.
  const kindOf = (n) => shortOf(n).replace(/\s+(#\d+|[A-Z]+-\d+)$/, "").replace(/^SELF-REVIEW .*/, "SELF-REVIEW");
  const groups = [];
  for (const n of needs) {
    const kind = n.rank === 4 ? shortOf(n) : kindOf(n);
    const last = groups[groups.length - 1];
    if (last && last.kind === kind && last.rank === n.rank) last.items.push(n);
    else groups.push({ kind, rank: n.rank, items: [n] });
  }
  const top = groups.slice(0, 4).map((g) => ({
    rank: g.rank,
    lane: laneOfRank[g.rank],
    short: g.items.length === 1 ? shortOf(g.items[0]) : `${g.kind} ×${g.items.length}`,
    text: g.items.length === 1 ? g.items[0].text : g.items.slice(0, 4).map((n) => n.text).join(" · ") + (g.items.length > 4 ? ` · and ${g.items.length - 4} more` : ""),
  }));

  return { lanes, needs, inboxMore, closedOut, unreleased, switches, groups, top };
}
