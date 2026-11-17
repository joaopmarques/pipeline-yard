// Build the page: the yard, the drawer with the detail of one line, and the script that moves the camera.
// This module knows the rail yard. It does not know any project.

import { ISO_CSS } from "../vendor/anatomy/iso-kit.mjs";
import { fill } from "./fill.mjs";
import { renderYard } from "./yard.mjs";

export function renderPage(model) {
  const {
    config, repo, linear, sessions, now, prodTag, stagingTag, stagingIsAhead,
    lanes, needs, inboxMore, closedOut, unreleased, switches, groups, top, departed,
  } = model;

// The body is not indented: it holds the page template, and its white space is part of the page.
// --- Render: the yard is the whole page. A click opens the detail. ---
const e = (text) =>
  String(text ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );
const link = (href, text, cls = "") =>
  href ? `<a class="${cls}" href="${e(href)}">${e(text)}</a>` : `<span class="${cls}">${e(text)}</span>`;
const chip = (c) =>
  c.ticketId
    ? link(c.ticketUrl, c.ticketId, `chip ticket${c.urgent ? " urgent" : ""}`)
    : `<span class="chip none">No ticket</span>`;
// Small line icons for the state of a ticket and of a pull request.
const svgIcon = (body, color) =>
  `<svg class="ic" viewBox="0 0 16 16" aria-hidden="true" style="color:${color}">${body}</svg>`;
const GLYPH = {
  check: '<path d="M3.5 8.6l3 3 6-6.6"/>',
  cross: '<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>',
  alert: '<path d="M8 2.6l6 10.4H2z"/><path d="M8 6.6v3M8 11.3v.1"/>',
  dot: '<circle cx="8" cy="8" r="3" fill="currentColor" stroke="none"/>',
  clock: '<circle cx="8" cy="8" r="5.6"/><path d="M8 5v3.2l2 1.2"/>',
  pr: '<circle cx="4" cy="3.6" r="1.7"/><circle cx="4" cy="12.4" r="1.7"/><path d="M4 5.3v5.4" stroke-dasharray="1.6 1.6"/>',
  ship: '<path d="M2.5 8h9.5M8.6 4.4 12.2 8l-3.6 3.6"/>',
  session: '<rect x="2" y="3" width="12" height="10" rx="2"/><path d="M5 6.6 7 8.4l-2 1.8M8.6 10.4h2.4"/>',
};
const linearIcon = (status) => {
  const name = (status ?? "").toLowerCase();
  const ring = '<circle cx="8" cy="8" r="6"/>';
  const full = '<circle cx="8" cy="8" r="7" fill="currentColor" stroke="none"/>';
  if (/done/.test(name)) return svgIcon(`${full}<path d="M5 8.3l2 2 4-4.3" style="stroke:var(--panel)"/>`, "#6e79e8");
  if (/cancel|duplicate/.test(name)) return svgIcon(`${full}<path d="M5.6 5.6l4.8 4.8M10.4 5.6l-4.8 4.8" style="stroke:var(--panel)"/>`, "var(--ink-mute)");
  if (/qa|ready/.test(name)) return svgIcon(`${ring}<path d="M8 4.4a3.6 3.6 0 1 1-3.6 3.6H8z" fill="currentColor" stroke="none"/>`, "#4f9cff");
  if (/review/.test(name)) return svgIcon(`${ring}<path d="M8 4.4a3.6 3.6 0 1 1-3.6 3.6H8z" fill="currentColor" stroke="none"/>`, "#2fb36d");
  if (/progress/.test(name)) return svgIcon(`${ring}<path d="M8 4.4a3.6 3.6 0 0 1 0 7.2z" fill="currentColor" stroke="none"/>`, "#e8a317");
  if (/blocked/.test(name)) return svgIcon(`${ring}<path d="M5 8h6"/>`, "var(--bad)");
  if (/backlog|triage/.test(name)) return svgIcon('<circle cx="8" cy="8" r="6" stroke-dasharray="2 2.2"/>', "var(--ink-mute)");
  return svgIcon(ring, "var(--ink-soft)");
};
const prIcon = (state) => {
  if (state === "merged") {
    return svgIcon('<circle cx="4" cy="3.6" r="1.7"/><circle cx="4" cy="12.4" r="1.7"/><circle cx="12" cy="8.6" r="1.7"/><path d="M4 5.3v5.4M4 5.3c0 2.6 2 3.3 6.3 3.3"/>', "#a371f7");
  }
  const dash = state === "draft" ? ' stroke-dasharray="1.6 1.6"' : "";
  return svgIcon(
    `<circle cx="4" cy="3.6" r="1.7"/><circle cx="4" cy="12.4" r="1.7"/><circle cx="12" cy="12.4" r="1.7"/><path d="M4 5.3v5.4"${dash}/><path d="M12 10.7V7a3 3 0 0 0-3-3H7.6M9.2 2.3 7.4 4l1.8 1.7"/>`,
    state === "draft" ? "var(--ink-mute)" : "#2fb36d"
  );
};
const pill = (tone, glyph, text) => `<span class="st ${tone}">${svgIcon(GLYPH[glyph], "currentColor")}${e(text)}</span>`;
// A card is one sentence, a track of six steps, and the links.
// Each step is a dot: green is done, amber is waiting, red is a problem, grey is not there yet.
const glyph = (name) => svgIcon(GLYPH[name], "currentColor");
const step = (label, tone, icon, tip) =>
  `<li class="step s-${tone}" title="${e(tip)}"><span class="dotc">${icon}</span><span class="cap">${label}</span></li>`;
const stepsOf = (c) => {
  const g = c.gh;
  const merged = g?.state === "merged";
  const out = [];

  out.push(
    c.ticketId
      ? step("Ticket", "plain", linearIcon(c.ticketStatus), `Linear: ${c.ticketStatus ?? "status not loaded yet"}${c.urgent ? ", urgent" : ""}`)
      : step("Ticket", "idle", glyph("dot"), "No Linear ticket")
  );

  if (!g) out.push(step("PR", "idle", glyph("dot"), "No pull request yet"));
  else if (g.state === "draft") out.push(step("PR", "idle", glyph("clock"), "Draft pull request"));
  else out.push(step("PR", "good", glyph("check"), merged ? "Pull request merged" : "Pull request open"));

  if (merged || g?.review === "APPROVED") out.push(step("Review", "good", glyph("check"), "Approved"));
  else if (g?.review === "CHANGES_REQUESTED") out.push(step("Review", "bad", glyph("cross"), "Changes requested"));
  else if (g && g.state !== "draft") out.push(step("Review", "warn", glyph("clock"), c.note === "No reviewer asked" ? "No reviewer asked yet" : "Waiting for review"));
  else out.push(step("Review", "idle", glyph("dot"), "Not in review yet"));

  if (merged || g?.checks === "passing") out.push(step("Checks", "good", glyph("check"), "Checks passed"));
  else if (g?.checks === "failing") out.push(step("Checks", "bad", glyph("cross"), "Checks failing"));
  else if (g?.checks === "running") out.push(step("Checks", "warn", glyph("clock"), "Checks running"));
  else out.push(step("Checks", "idle", glyph("dot"), "No checks yet"));

  if (merged) out.push(step("Merge", "good", glyph("check"), "Merged"));
  else if (g?.merge === "conflicts") out.push(step("Merge", "bad", glyph("alert"), "Merge conflicts"));
  else if (g?.merge === "clean") out.push(step("Merge", "warn", glyph("check"), "Ready to merge"));
  else if (g?.merge === "behind") out.push(step("Merge", "warn", glyph("alert"), "Behind main"));
  else out.push(step("Merge", "idle", glyph("dot"), g?.merge === "blocked" ? "Waiting for approval" : "Not ready to merge"));

  if (!merged) out.push(step("Live", "idle", glyph("dot"), "Not released"));
  else if (c.where?.startsWith("Staging")) out.push(step("Live", "info", glyph("clock"), `On ${c.where}, not in Production`));
  else if (c.where === "Main only") out.push(step("Live", "warn", glyph("clock"), "On main, not on Staging yet"));
  else out.push(step("Live", "good", glyph("check"), `Live in ${c.where ?? "Production"}`));

  return out.join("");
};
const renderCard = (c) => {
  const risk = c.meta?.find((m) => /^(high|medium) risk$/.test(m));
  const links = [
    c.ticketId ? link(c.ticketUrl, c.ticketId, `ref${c.urgent ? " urgent" : ""}`) : "",
    c.pr ? link(c.prUrl, `#${c.pr}`, "ref") : "",
    c.session && c.sessionId
      ? `<a class="ref sess${c.running ? " live" : ""}" href="claude://claude.ai/epitaxy/${e(c.sessionId)}" title="${e(`Open the session: ${c.session}`)}">${glyph("session")}Session</a>`
      : "",
    risk ? `<span class="risk">${e(risk)}</span>` : "",
  ].join("");
  return `
  <article class="card tone-${c.tone ?? "quiet"}">
    <h3>${e(c.title)}</h3>
    ${c.note ? `<p class="note">${e(c.note)}</p>` : ""}
    <ol class="steps">${stepsOf(c)}</ol>
    ${links ? `<p class="links">${links}</p>` : ""}
  </article>`;
};

const stagingAhead = stagingIsAhead ? stagingTag.replace(/-.*$/, "") : null;
const releaseName = stagingAhead ?? "next";
// The words of each panel come from the project config.
const words = {
  release: releaseName,
  staging: stagingTag ?? "empty",
  liveIn: prodTag ?? "Production",
  closedOut: `${closedOut} ticket${closedOut === 1 ? " is" : "s are"}`,
};
const more = Object.fromEntries(config.lines.filter((line) => line.kind === "tickets").map((line) => [line.key, inboxMore]));
const panels = config.lines.map((line) => ({
  key: line.key,
  color: line.color,
  name: fill(line.panel.name, words),
  hint: fill(line.panel.hint, words),
  empty: fill(line.panel.empty, words),
  more: more[line.key],
}));
const panel = (s) => `
  <section class="panel" id="p-${s.key}" style="--c:${s.color}" hidden>
    <h2>${e(s.name)}</h2><p class="hint">${e(s.hint)}</p>
    ${
      lanes[s.key].length === 0
        ? `<p class="empty">${e(s.empty)}</p>`
        : `<div class="cards">${lanes[s.key].map(renderCard).join("")}</div>${
            s.more ? `<p class="empty">+${s.more} more on Linear</p>` : ""
          }`
    }
  </section>`;

// Short lines for the board in the yard. The drawer holds the full sentence.
const switchPanel = (key, s) => `
  <section class="panel" id="p-switch-${key}" style="--c:${panels.find((p) => p.key === key)?.color ?? "#808080"}" hidden>
    <h2>${e(s.name)}</h2>
    <p class="hint">This opens one new Claude session with the prompt below filled in. Nothing starts until you send it there. The list is from the last refresh, and the session checks each item again before it acts.</p>
    <ol class="todo">${s.items.map((item) => `<li><span>${e(item)}</span></li>`).join("")}</ol>
    <p class="prompt">${e(s.prompt)}</p>
    <a class="fire" href="${e(s.url)}" data-fire="${key}">Open the session in Claude</a>
  </section>`;

const yard = renderYard({
  lanes,
  lines: config.lines,
  more,
  releaseName,
  prodTag,
  unreleased,
  departed,
  needs: top,
  moreNeeds: groups.length - top.length,
  builtAt: now,
  switches,
});
const missing = [!linear && "Tickets", !sessions && "Claude sessions"].filter(Boolean);
const dimRules = panels
  .map((s) => `.yard[data-focus="${s.key}"] .train:not([data-lane="${s.key}"])`)
  .join(", ");

const lightTokens = [
  "--anatomy-page:#f2f2ef;--anatomy-card:#f2f2ef;--anatomy-text:#57575a;--anatomy-strong:#18181a;--anatomy-muted:#8c8c90",
  "--anatomy-paper:#f2f2ef;--anatomy-face:#ffffff;--anatomy-top:#ffffff",
  "--anatomy-shade-0:#dcdcd9;--anatomy-shade-1:#e5e5e2;--anatomy-shade-2:#ededea;--anatomy-shade-3:#f4f4f1",
  "--anatomy-lit-top:#ffffff;--anatomy-lit-shade:#eeeeeb;--anatomy-hi:#26262a;--anatomy-mid:#7a7a80;--anatomy-lo:#a8a8ad;--anatomy-faint:#cfcfd2",
  "--anatomy-lit:#000000;--anatomy-halo:#8a8a80;--anatomy-halo-opacity:.3;--anatomy-dot:#3a3a3e",
  "--bg:#f2f2ef;--panel:#fbfbfa;--panel-line:#c9c9cc;--card:#f2f2ef;--card-line:#dcdcd9",
  "--ink:#18181a;--ink-soft:#57575a;--ink-mute:#8c8c90",
  "--top:#ffffff;--shade:#e6e6e3;--s0:#dcdcd9;--s1:#e5e5e2;--s2:#ededea;--s3:#f4f4f1",
  "--grey:#8a8a8f;--grey2:#b4b4b8;--hover:#000000;--on-train:#18181a;--keep:70%",
  "--bad:#e5484d;--bad-top:#ffd5d1;--bad-shade:#f3bab5;--amber:#b86e00;--warn-top:#ffe7b8;--good:#30a46c",
  "--steam:#8f8f94;--tip-bg:#18181a;--tip-ink:#ffffff;--btn-hover:#e9e9e6",
  "--chip-bg:#e3e8ff;--chip-ink:#3e63dd;--urg-bg:#ffe1de;--urg-ink:#c62f2a;--none-bg:#e6e6e3;--none-ink:#6e6e73",
  "--cast:#3c3c2824",
  "--pool:#ffc86a2e;--beam:#ffb84a1c;--scenery:34%",
  "--ballast:#dcdad3;--ballast-side:#cbc9c1;--tie:#b3b0a6",
  "--grid:#e6e6e2;--grid-major:#d6d6d1;--shadow:#3c3c2838;--panel-shadow:0 24px 60px #3c3c2830, 0 2px 8px #3c3c2820",
].join(";");

const html = `<title>Pipeline Yard</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
/* Layout: the isometric rail yard is the whole page. A board in the yard lists what needs the user. A drawer opens on a click. */
/* Theme: dark first. The light block redefines the same tokens and follows the system setting. */
${ISO_CSS}
:root { color-scheme: dark; }
html, body { height: 100%; }
body { background: #0b0b0b; font: 14px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); overflow: hidden; }
[hidden] { display: none !important; }
.yard {
  --ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif;
  --anatomy-mono: var(--ui);
  --anatomy-paper: #0b0b0b; --anatomy-card: #0b0b0b; --anatomy-lo: #505050; --anatomy-faint: #343434; --anatomy-mid: #808080;
  --bg: #0b0b0b; --panel: #131313; --panel-line: #3e3e3e; --card: #0b0b0b; --card-line: #2a2a2a;
  --ink: #e6e6e6; --ink-soft: #a3a3a3; --ink-mute: #6e6e6e;
  --top: #1c1c1c; --shade: #141414; --s0: #0f0f0f; --s1: #121212; --s2: #151515; --s3: #181818;
  --grey: #808080; --grey2: #505050; --hover: #ffffff; --on-train: #ffffff; --keep: 100%;
  --bad: #ff5b52; --bad-top: #5a211d; --bad-shade: #33161a; --amber: #ffb84a; --warn-top: #4a3a17; --good: #5fe0a0;
  --steam: #e6e6e6; --tip-bg: #f2f2ef; --tip-ink: #18181a; --btn-hover: #262626;
  --chip-bg: #1f2440; --chip-ink: #9db4ff; --urg-bg: #3a1a18; --urg-ink: #ff8f87; --none-bg: #1b1b1b; --none-ink: #8c8c90;
  position: relative; height: 100%; color: var(--ink-soft);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { color-scheme: light; }
  :root:not([data-theme="dark"]) body { background: #f2f2ef; }
  :root:not([data-theme="dark"]) .yard { ${lightTokens} }
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="light"] body { background: #f2f2ef; }
:root[data-theme="light"] .yard { ${lightTokens} }

.yard .iso-svg { width: 100%; height: 100%; overflow: hidden; cursor: grab; touch-action: none; }
.panning .iso-svg { cursor: grabbing; }
.panning .train { pointer-events: none; }
.line, .train, .tint, .panel { --cc: color-mix(in srgb, var(--c, #808080) var(--keep), #000000); }

.lamp { stroke: none; }
.lamp-bad { fill: var(--bad); filter: drop-shadow(0 0 4px var(--bad)); }
.lamp-warn { fill: #ffb84a; filter: drop-shadow(0 0 4px #ffb84a); }
.lamp-good { fill: var(--good); filter: drop-shadow(0 0 3px var(--good)); }
.lamp-ring { fill: var(--bg); stroke: var(--bad); stroke-width: 1.4; }
.lamp-off, .lamp-quiet { fill: var(--card-line); }
.lamp-glow { fill: #ffe9b8; filter: drop-shadow(0 0 6px #ffd98a); animation: glow 4s ease-in-out infinite; }
@keyframes glow { 50% { opacity: .55; } }
.blink { animation: blink 1.8s ease-in-out infinite; }
@keyframes blink { 50% { opacity: .25; } }
.iso-face-text { font-family: var(--ui); font-weight: 700; letter-spacing: .02em; font-variant-numeric: tabular-nums; }
.train, .line, .row { cursor: pointer; outline: none; }
.train { transition: transform .25s var(--anatomy-ease), opacity .3s; }
.train:hover, .train:focus-visible { transform: translateY(-5px); }
${dimRules} { opacity: .28; }
.roll { animation: roll 1s var(--anatomy-ease) backwards; animation-delay: var(--d, 0ms); }
@keyframes roll { from { transform: translate(var(--rx), var(--ry)); opacity: 0; } }
.run { animation: shunt 3.6s ease-in-out infinite alternate; }
@keyframes shunt { to { transform: translate(7px, 3.6px); } }
.steam circle { fill: var(--steam); opacity: 0; transform-box: fill-box; transform-origin: center; animation: puff 2.4s linear infinite; }
@keyframes puff { 0% { opacity: .55; transform: translateY(0) scale(.5); } 100% { opacity: 0; transform: translateY(-30px) scale(2); } }
.traverser { animation: traverse 18s var(--anatomy-ease) infinite; }
@keyframes traverse {
  0%, 14% { transform: translate(0, 0); }
  25%, 39% { transform: translate(var(--tx), var(--ty)); }
  50%, 64% { transform: translate(calc(var(--tx) * 2), calc(var(--ty) * 2)); }
  75%, 89% { transform: translate(calc(var(--tx) * 3), calc(var(--ty) * 3)); }
}
.depart { animation: depart 7s cubic-bezier(.6, 0, .9, .5) 1.2s forwards; }
.late { animation: arrive 1.2s ease-out 7.4s both; }
@keyframes arrive { from { opacity: 0; } }
@keyframes depart { 85% { opacity: 1; } 100% { transform: translate(var(--ox), var(--oy)); opacity: 0; } }

/* Each line has its own colour. Red and amber stay for state only. */
.line .iso-face-text[data-tone="hi"] { fill: var(--cc); }
.line .count { fill: color-mix(in srgb, var(--cc) 55%, var(--grey)); }
.line .rail .iso-top, .line .rail .iso-fill { fill: var(--cc); }
.line .rail .iso-edge { stroke: var(--cc); }
.line .bed .iso-fill { fill: color-mix(in srgb, var(--cc) 9%, var(--shade)); }
.line .bed .iso-edge { stroke: color-mix(in srgb, var(--cc) 45%, var(--grey2)); }
.line:hover .bed .iso-edge, .line:focus-visible .bed .iso-edge, .line.on .bed .iso-edge { stroke: var(--hover); }
.line.on .iso-face-text[data-tone="hi"] { fill: var(--hover); }
.tint .iso-top { fill: color-mix(in srgb, var(--cc) 26%, var(--top)); }
.tint .iso-shade { fill: color-mix(in srgb, var(--cc) 14%, var(--shade)); }
.tint .iso-edge { stroke: color-mix(in srgb, var(--cc) 70%, var(--grey)); }
.tint.strong .iso-top, .tint.strong .iso-solid[data-lit] > .iso-top { fill: color-mix(in srgb, var(--cc) 55%, var(--top)); }
.tint.strong .iso-solid[data-lit] > .iso-shade { fill: color-mix(in srgb, var(--cc) 30%, var(--shade)); }
.tint.strong .iso-edge, .tint.strong .iso-solid[data-lit] > .iso-edge { stroke: var(--cc); }
.tint.strong .iso-face-text { fill: var(--on-train); }
.train .iso-top { fill: color-mix(in srgb, var(--cc) 30%, var(--top)); }
.train .iso-shade[data-shade="0"] { fill: color-mix(in srgb, var(--cc) 10%, var(--s0)); }
.train .iso-shade[data-shade="1"] { fill: color-mix(in srgb, var(--cc) 14%, var(--s1)); }
.train .iso-shade[data-shade="2"] { fill: color-mix(in srgb, var(--cc) 18%, var(--s2)); }
.train .iso-shade[data-shade="3"] { fill: color-mix(in srgb, var(--cc) 22%, var(--s3)); }
.train .iso-edge { stroke: var(--cc); }
.train .iso-face-text { fill: var(--on-train); }
.train.loco .iso-solid[data-lit] > .iso-top { fill: color-mix(in srgb, var(--cc) 62%, var(--top)); }
.train.loco .iso-solid[data-lit] > .iso-shade { fill: color-mix(in srgb, var(--cc) 36%, var(--shade)); }
.train.loco .iso-solid[data-lit] > .iso-edge { stroke: var(--cc); }
.train.t-bad .iso-edge, .train.t-bad .iso-solid[data-lit] > .iso-edge { stroke: var(--bad); }
.train.t-bad .iso-solid > .iso-top, .train.t-bad .iso-solid[data-lit] > .iso-top { fill: var(--bad-top); }
.train.t-bad .iso-solid > .iso-shade, .train.t-bad .iso-solid[data-lit] > .iso-shade { fill: var(--bad-shade); }
.train.t-warn .iso-edge { stroke: var(--amber); }
.train.t-warn .iso-solid > .iso-top { fill: var(--warn-top); }
.train:hover .iso-edge, .train:focus-visible .iso-edge, .train:hover .iso-solid[data-lit] > .iso-edge { stroke: var(--hover); }

/* The board in the yard stays black in both themes, like a real one. */
.sign .iso-solid[data-lit] > .iso-top, .sign .iso-solid[data-lit] > .iso-shade, .sign .iso-solid[data-lit] > .iso-fill { fill: #101010; }
.sign .iso-solid[data-lit] > .iso-edge { stroke: #808080; }
.sign .iso-line { stroke: #343434; }
.sign-head { fill: #ffffff; }
.sign-age { fill: #9a9a9a; }
.sign-age.old { fill: #ffb84a; }
.sign-clear { fill: #5fe0a0; }
.row-hit { fill: transparent; stroke: none; }
.row .num { fill: #ff5b52; }
.row .what { fill: #ffe1b0; }
.row:hover .what, .row:focus-visible .what { fill: #ffffff; }
.row:hover .row-hit, .row:focus-visible .row-hit { fill: #ffffff14; }
.row { animation: flap .5s steps(4, end) backwards; animation-delay: var(--d, 0ms); }
@keyframes flap { from { opacity: 0; } }
.sign-more { fill: #9a9a9a; }
.plate-name { fill: var(--anatomy-lo); }

@media (prefers-reduced-motion: reduce) {
  .run, .steam circle, .traverser, .blink, .late, .roll, .row, .lamp-glow { animation: none; }
  .depart { display: none; }
  .train { transition: none; }
}

.ctl { position: absolute; z-index: 1; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; box-shadow: 0 0 0 1px var(--panel-line); background: var(--panel); border-radius: 8px; overflow: hidden; }
.ctl button { all: unset; cursor: pointer; padding: 8px 14px; color: var(--ink); font: 500 13px/1 var(--ui); }
.ctl button + button { box-shadow: -1px 0 0 var(--panel-line); }
.ctl button:hover, .ctl button:focus-visible { background: var(--btn-hover); }
.tip { position: absolute; z-index: 3; pointer-events: none; background: var(--tip-bg); color: var(--tip-ink); font: 500 12.5px/1.35 var(--ui); padding: 7px 10px; border-radius: 6px; max-width: 300px; transform: translate(-50%, calc(-100% - 16px)); }
.drawer { position: absolute; z-index: 2; top: 0; right: 0; bottom: 0; width: min(400px, 100%); overflow-y: auto; background: var(--panel); box-shadow: 0 0 0 1px var(--panel-line); padding: 20px; box-sizing: border-box; animation: slide .28s var(--anatomy-ease); }
@keyframes slide { from { transform: translateX(24px); opacity: 0; } }
.close { all: unset; cursor: pointer; float: right; padding: 5px 10px; border-radius: 6px; color: var(--ink); box-shadow: 0 0 0 1px var(--panel-line); font: 500 12px/1.4 var(--ui); }
.close:hover, .close:focus-visible { box-shadow: 0 0 0 1px var(--hover); }
.panel h2 { font: 700 20px/1.2 var(--ui); letter-spacing: -.01em; color: var(--ink); margin: 0; border-left: 4px solid var(--cc); padding-left: 10px; }
.panel .hint { margin: 6px 0 14px; font-size: 13px; }
.cards { display: grid; gap: 8px; }
.card { background: var(--card); box-shadow: 0 0 0 1px var(--card-line); border-radius: 8px; padding: 10px 12px; min-width: 0; }
.card.tone-bad { box-shadow: 0 0 0 1px var(--bad); }
.card-top { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.card h3 { font: 600 14px/1.35 var(--ui); color: var(--ink); margin: 6px 0 4px; overflow-wrap: anywhere; }
.note { margin: 0; font-size: 13px; font-weight: 500; }
.tone-good .note { color: var(--good); } .tone-warn .note { color: var(--amber); } .tone-bad .note { color: var(--bad); }
.meta { margin: 2px 0 0; font-size: 12px; color: var(--ink-mute); }
.chip, .pr, .where, .working { font: 600 11px/1 var(--ui); padding: 3px 6px; border-radius: 4px; text-decoration: none; white-space: nowrap; font-variant-numeric: tabular-nums; }
.chip.ticket { background: var(--chip-bg); color: var(--chip-ink); } .chip.urgent { background: var(--urg-bg); color: var(--urg-ink); } .chip.none { background: var(--none-bg); color: var(--none-ink); }
.pr { color: var(--ink-soft); padding: 3px 0; } .where { color: var(--amber); padding: 3px 0; } .working { color: var(--good); }
.empty { margin: 0; font-size: 13px; }
.todo { margin: 0 0 14px; padding: 0; list-style: none; display: grid; gap: 6px; counter-reset: n; }
.todo li { counter-increment: n; display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 10px; color: var(--ink); }
.todo li::before { content: counter(n, decimal-leading-zero); font: 600 11px/1.9 var(--ui); color: var(--bad); font-variant-numeric: tabular-nums; }
.keys { margin: 0; padding: 0; list-style: none; display: grid; gap: 6px; font-size: 13px; }
.keys b { color: var(--ink); font-weight: 600; }
a:focus-visible { outline: 1px solid var(--hover); outline-offset: 2px; }

/* Second pass: an isometric grid floor, shadows, a floating panel, larger text, quicker reveals. */
.yard { --grid: #191919; --grid-major: #262626; --shadow: #000000b0; --panel-shadow: 0 24px 60px #000000a0, 0 2px 8px #00000080; }
body { font-size: 15px; }
.grid path { fill: none; stroke: var(--grid); stroke-width: 1; vector-effect: non-scaling-stroke; }
.grid .grid-major { stroke: var(--grid-major); }
.ground-shadow { fill: var(--shadow); stroke: none; filter: blur(26px); opacity: .7; transform: translateY(18px); }
.train { filter: drop-shadow(0 4px 3px var(--shadow)); }
.sign { filter: drop-shadow(0 12px 14px var(--shadow)); }
.traverser { filter: drop-shadow(0 3px 2px var(--shadow)); }
.roll { animation-duration: .45s; }
.row { animation-duration: .25s; }
.drawer { top: 16px; right: 0; bottom: 16px; border-radius: 18px; box-shadow: 0 0 0 1px var(--panel-line), var(--panel-shadow); animation-duration: .16s; padding: 22px; }
.ctl { box-shadow: 0 0 0 1px var(--panel-line), 0 8px 24px var(--shadow); border-radius: 10px; }
.ctl button { font-size: 14px; padding: 9px 15px; }
.tip { font-size: 13.5px; box-shadow: 0 6px 18px var(--shadow); }
.close { font-size: 13px; }
.panel h2 { font-size: 22px; }
.panel .hint { font-size: 14px; }
.cards { gap: 10px; }
.card { border-radius: 12px; padding: 12px 14px; }
.card h3 { font-size: 15.5px; margin: 0 0 4px; }
.card h3 .working { margin-left: 8px; font-size: 12px; vertical-align: 2px; }
.note { font-size: 14px; margin-bottom: 8px; }
.meta { font-size: 13px; margin-top: 8px; }
.empty, .keys, .todo { font-size: 14px; }
.facts { list-style: none; margin: 8px 0 0; padding: 0; display: grid; gap: 7px; }
.facts li { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; font-size: 13.5px; color: var(--ink-soft); }
.facts b { color: var(--ink); font-weight: 600; }
.ic { width: 16px; height: 16px; flex: none; fill: none; stroke: currentColor; stroke-width: 1.5; stroke-linecap: round; stroke-linejoin: round; }
.ref { font: 600 12.5px/1 var(--ui); font-variant-numeric: tabular-nums; text-decoration: none; padding: 3px 6px; border-radius: 5px; background: var(--chip-bg); color: var(--chip-ink); }
.ref.urgent { background: var(--urg-bg); color: var(--urg-ink); }
.ref.none { background: var(--none-bg); color: var(--none-ink); }
.st { display: inline-flex; align-items: center; gap: 4px; font: 600 12px/1 var(--ui); padding: 3px 7px 3px 5px; border-radius: 999px; background: var(--none-bg); color: var(--ink-soft); }
.st .ic { width: 12px; height: 12px; stroke-width: 2; }
.st.good { color: var(--good); } .st.bad { color: var(--bad); } .st.warn { color: var(--amber); } .st.info { color: var(--chip-ink); } .st.mute { color: var(--ink-mute); }

/* Third pass: no CSS filter and no mask on the drawing. WebKit repaints them in software on every frame. */
.yard { --cast: #00000070; }
.train, .sign, .traverser, .lamp, .lamp-bad, .lamp-warn, .lamp-good, .lamp-glow { filter: none; }
.iso-halo { display: none; }
.cast { fill: var(--cast); stroke: none; }
.cast.soft { opacity: .45; }
.lamp-halo { opacity: .24; animation: none; }
.tip, .ctl { box-shadow: 0 0 0 1px var(--panel-line); }

/* Fourth pass: upright line signs, the ladder track, and the age guides. */
.linesign { cursor: pointer; outline: none; }
.linesign:hover .iso-edge, .linesign:focus-visible .iso-edge { stroke: var(--hover); }
.ladder .bed .iso-fill { fill: color-mix(in srgb, var(--grey2) 16%, var(--bg)); }
.ladder .bed .iso-edge { stroke: none; }
.ladder .iso-line[data-tone="hi"] { stroke: var(--grey); }
.ladder .flow-line { stroke: #2dd4bf; stroke-width: 2; stroke-dasharray: 3 9; animation-duration: 900ms; }

/* Fifth pass: tracks that fade off the view, state built into the trains, age signs, scenery, light. */
.yard { --pool: #ffd98a1c; --beam: #fff2c838; --scenery: 26%; }
.fade.f1 .rail .iso-top, .fade.f1 .rail .iso-fill { fill: color-mix(in srgb, var(--cc) 62%, var(--bg)); }
.fade.f2 .rail .iso-top, .fade.f2 .rail .iso-fill { fill: color-mix(in srgb, var(--cc) 36%, var(--bg)); }
.fade.f3 .rail .iso-top, .fade.f3 .rail .iso-fill { fill: color-mix(in srgb, var(--cc) 15%, var(--bg)); }
.fade.f1 .rail .iso-edge { stroke: color-mix(in srgb, var(--cc) 62%, var(--bg)); }
.fade.f2 .rail .iso-edge { stroke: color-mix(in srgb, var(--cc) 36%, var(--bg)); }
.fade.f3 .rail .iso-edge { stroke: color-mix(in srgb, var(--cc) 15%, var(--bg)); }
.fade.f1 .bed .iso-edge, .fade.f1 .iso-line { stroke: color-mix(in srgb, var(--grey2) 62%, var(--bg)); }
.fade.f2 .bed .iso-edge, .fade.f2 .iso-line { stroke: color-mix(in srgb, var(--grey2) 36%, var(--bg)); }
.fade.f3 .bed .iso-edge, .fade.f3 .iso-line { stroke: color-mix(in srgb, var(--grey2) 15%, var(--bg)); }
.fade .bed .iso-fill { fill: var(--bg); }
.line .bed .iso-edge { stroke: none; }
.line:hover .bed .iso-edge, .line:focus-visible .bed .iso-edge, .line.on .bed .iso-edge { stroke: none; }
.line:hover .rail .iso-edge, .line:focus-visible .rail .iso-edge, .line.on .rail .iso-edge { stroke: var(--hover); }

.gauge-track, .gauge { fill: none; stroke-linecap: round; }
.gauge-track { stroke: var(--grey2); stroke-width: 2.4; }
.gauge { stroke-width: 3; }
.flag { stroke: var(--ink); stroke-width: 1; stroke-linejoin: round; }
.flag-good { fill: #2fb36d; }
.flag-bad { fill: var(--bad); }
.flag-wait { fill: var(--panel); stroke-dasharray: 2.5 2; }
.train.draft .iso-edge { stroke-dasharray: 4 3; }
.train.draft .iso-top { fill: color-mix(in srgb, var(--cc) 9%, var(--top)); }
.train.draft .iso-shade { fill: var(--shade); }

.agesign .iso-top, .agesign .iso-shade { fill: var(--panel); }
.agesign .iso-edge { stroke: var(--grey2); }
.age-mark { fill: var(--ink-soft); }
.age-lead { fill: var(--ink-mute); }
.pool { fill: var(--pool); stroke: none; }
.beam { fill: var(--beam); stroke: none; }
.tree .iso-top { fill: color-mix(in srgb, var(--cc) var(--scenery), var(--top)); }
.tree .iso-shade { fill: color-mix(in srgb, var(--cc) calc(var(--scenery) * 0.7), var(--shade)); }
.tree .iso-edge { stroke: color-mix(in srgb, var(--cc) 45%, var(--grey2)); }

/* Sixth pass: the Linear status as a round sign, and larger flags. */
.roundel-back { fill: var(--panel); stroke: none; }
.roundel-ring { fill: none; stroke-width: 1.8; }
.roundel-ring.dashed { stroke-dasharray: 2.4 2.2; }
.roundel-fill { stroke: none; }
.roundel-check { fill: none; stroke: var(--panel); stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.flag { stroke-width: 1.2; }
.flag-wait { stroke-dasharray: 3.5 2.5; }

/* Seventh pass: a card is four rows with a line between them, and the app window has a close button. */
.facts { margin: 12px 0 0; gap: 0; border-top: 1px solid var(--card-line); }
.facts li { display: grid; grid-template-columns: 16px 56px minmax(0, 1fr); gap: 10px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--card-line); }
.lbl { font: 600 10.5px/1 var(--ui); letter-spacing: .07em; text-transform: uppercase; color: var(--ink-mute); }
.val { display: flex; flex-wrap: wrap; gap: 6px 8px; align-items: center; min-width: 0; font-size: 14px; color: var(--ink-soft); }
.val b { color: var(--ink); font-weight: 600; }
.quiet { color: var(--ink-mute); }
.sess { color: var(--ink); font-weight: 600; text-decoration: underline; text-decoration-color: var(--grey2); text-underline-offset: 3px; overflow-wrap: anywhere; }
.sess:hover { text-decoration-color: var(--ink); }
.card { padding: 14px 16px 12px; }
.card h3 { font-size: 16px; }
.note { margin-bottom: 0; }
.meta { margin-top: 10px; }
.quit { all: unset; box-sizing: border-box; position: absolute; z-index: 4; top: 14px; right: 0; width: 38px; height: 38px; display: grid; place-items: center; cursor: pointer; border-radius: 50%; background: var(--panel); color: var(--ink); box-shadow: 0 0 0 1px var(--panel-line); font: 500 16px/1 var(--ui); }
.quit:hover, .quit:focus-visible { background: var(--btn-hover); box-shadow: 0 0 0 1px var(--hover); }
.native .drawer { top: 64px; }

/* Eighth pass: no reveal animation. A card is a sentence, a six-step track, and its links. */
.roll, .row { animation: none; }
.steps { list-style: none; margin: 14px 0 12px; padding: 0; display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); }
.step { position: relative; display: grid; justify-items: center; gap: 6px; }
.step + .step::before { content: ""; position: absolute; top: 12px; left: -50%; width: 100%; height: 2px; background: var(--card-line); }
.dotc { position: relative; z-index: 1; width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center; background: var(--none-bg); color: var(--ink-mute); box-shadow: 0 0 0 3px var(--card); }
.dotc .ic { width: 14px; height: 14px; stroke-width: 2.2; }
.s-plain .dotc { background: var(--card); }
.s-plain .dotc .ic { width: 20px; height: 20px; stroke-width: 1.5; }
.s-good .dotc { background: color-mix(in srgb, var(--good) 20%, var(--card)); color: var(--good); }
.s-warn .dotc { background: color-mix(in srgb, var(--amber) 22%, var(--card)); color: var(--amber); }
.s-bad .dotc { background: color-mix(in srgb, var(--bad) 22%, var(--card)); color: var(--bad); }
.s-info .dotc { background: var(--chip-bg); color: var(--chip-ink); }
.cap { font: 600 9.5px/1 var(--ui); letter-spacing: .05em; text-transform: uppercase; color: var(--ink-mute); }
.s-warn .cap { color: var(--amber); }
.s-bad .cap { color: var(--bad); }
.links { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; margin: 0; }
.ref { padding: 4px 7px; }
.ref.sess { display: inline-flex; align-items: center; gap: 5px; background: var(--none-bg); color: var(--ink); text-decoration: none; }
.ref.sess .ic { width: 13px; height: 13px; stroke-width: 1.8; }
.ref.sess.live { color: var(--good); }
.ref.sess:hover { box-shadow: 0 0 0 1px var(--hover); }
.risk { margin-left: auto; font-size: 12px; color: var(--ink-mute); }

/* Ninth pass: the switch at the end of a line, and its confirm panel. */
.lever { cursor: pointer; outline: none; }
.lever .arm { fill: none; stroke: var(--ink); stroke-width: 4; stroke-linecap: round; }
.lever .knob { fill: var(--bad); stroke: var(--ink); stroke-width: 1.2; }
.lever .knob-halo { fill: var(--bad); opacity: .22; }
.lever:hover .knob-halo, .lever:focus-visible .knob-halo { opacity: .5; }
.lever:hover .iso-edge, .lever:focus-visible .iso-edge { stroke: var(--hover); }
.lever .thrown, .lever.on .rest { display: none; }
.lever.on .thrown { display: inline; }
.lever.on .knob, .lever.on .knob-halo { fill: var(--good); }
.prompt { margin: 0 0 14px; padding: 10px 12px; border-radius: 10px; background: var(--card); box-shadow: 0 0 0 1px var(--card-line); font-size: 13.5px; color: var(--ink-soft); }
.fire { display: block; text-align: center; padding: 12px 14px; border-radius: 10px; background: var(--ink); color: var(--panel); font: 600 15px/1.2 var(--ui); text-decoration: none; }
.fire:hover, .fire:focus-visible { box-shadow: 0 0 0 2px var(--panel), 0 0 0 4px var(--ink); }
.todo li br + .quiet { font-size: 13px; }

/* Tenth pass: ballast under the rails, rails that join without seams, body colour by line, solid flags. */
.yard { --ballast: #222226; --ballast-side: #18181b; --tie: #3d3d44; }
.line .bed .iso-top, .ladder .bed .iso-top { fill: var(--ballast); }
.line .bed .iso-fill, .line .bed .iso-shade, .ladder .bed .iso-fill, .ladder .bed .iso-shade { fill: var(--ballast-side); }
.fade.f1 .bed .iso-top, .fade.f1 .bed .iso-fill, .fade.f1 .bed .iso-shade { fill: color-mix(in srgb, var(--ballast) 62%, var(--bg)); }
.fade.f2 .bed .iso-top, .fade.f2 .bed .iso-fill, .fade.f2 .bed .iso-shade { fill: color-mix(in srgb, var(--ballast) 36%, var(--bg)); }
.fade.f3 .bed .iso-top, .fade.f3 .bed .iso-fill, .fade.f3 .bed .iso-shade { fill: color-mix(in srgb, var(--ballast) 15%, var(--bg)); }
.line .iso-line, .ladder .iso-line[data-tone="lo"] { stroke: var(--tie); }
.line .rail .iso-edge, .line:hover .rail .iso-edge, .line:focus-visible .rail .iso-edge, .line.on .rail .iso-edge,
.fade.f1 .rail .iso-edge, .fade.f2 .rail .iso-edge, .fade.f3 .rail .iso-edge { stroke: none; }
.line .rail .iso-shade { fill: var(--cc); }
.fade.f1 .rail .iso-shade { fill: color-mix(in srgb, var(--cc) 62%, var(--bg)); }
.fade.f2 .rail .iso-shade { fill: color-mix(in srgb, var(--cc) 36%, var(--bg)); }
.fade.f3 .rail .iso-shade { fill: color-mix(in srgb, var(--cc) 15%, var(--bg)); }
.fade.f1 .iso-line { stroke: color-mix(in srgb, var(--tie) 62%, var(--bg)); }
.fade.f2 .iso-line { stroke: color-mix(in srgb, var(--tie) 36%, var(--bg)); }
.fade.f3 .iso-line { stroke: color-mix(in srgb, var(--tie) 15%, var(--bg)); }
.line:hover .rail .iso-top, .line:focus-visible .rail .iso-top, .line.on .rail .iso-top { fill: var(--hover); }
.train.t-warn .iso-solid > .iso-top { fill: color-mix(in srgb, var(--cc) 30%, var(--top)); }
.flag-wait { fill: var(--panel); stroke-dasharray: none; }
.flag { stroke-width: 1.4; }
</style>
<div class="iso yard" style="--rx:${yard.roll[0].toFixed(1)}px;--ry:${yard.roll[1].toFixed(1)}px">
  ${yard.svg}
  <div class="ctl" role="group" aria-label="View"><button type="button" data-open="help" aria-label="What am I looking at">?</button><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="fit">Fit</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button></div>
  <button class="quit" type="button" hidden aria-label="Close the yard">✕</button>
  <div class="tip" hidden></div>
  <aside class="drawer" hidden aria-label="Detail"><button class="close" type="button">Close</button>
    ${panels.map(panel).join("")}
    ${Object.entries(switches).map(([key, s]) => switchPanel(key, s)).join("")}
    <section class="panel" id="p-help" hidden>
      <h2>Pipeline Yard</h2>
      <p class="hint">${e(repo.nameWithOwner)} · Production ${e(prodTag ?? "none")} · Staging ${e(stagingTag ?? "none")}${missing.length ? ` · Not loaded: ${e(missing.join(", "))}` : ""}</p>
      ${needs.length ? `<ol class="todo">${needs.map((n) => `<li>${e(n.text)}</li>`).join("")}</ol>` : `<p class="empty">Nothing is waiting on you.</p>`}
      <ul class="keys">
        <li><b>Line</b> One stage of work. Its signal is red when something on it needs you.</li>
        <li><b>Engine</b> Work with a session on it. Steam means it is working now.</li>
        <li><b>Flat wagon</b> A ticket nobody started. A red ring means urgent.</li>
        <li><b>Box wagon</b> A merged change. Coupled to the release engine once it is on Staging.</li>
        <li><b>Red</b> Do this next. At most three things are red. <b>Amber</b> Needs you soon. <b>Green</b> Good to go.</li>
        <li><b>Lever at the end of a line</b> Opens one Claude session made for that line. It shows what it will do first, and nothing starts until you send the prompt in Claude.</li>
        <li><b>Card</b> Six steps from ticket to live. Green is done, amber is waiting, red is a problem, grey is not there yet. Hover a step to read it.</li>
        <li><b>Flag on the cab</b> The review. Green is approved, red is changes requested, an empty outline is no review yet.</li>
        <li><b>Beacon on the roof</b> The checks. Flashing red has failed, flashing amber is running, steady green has passed.</li>
        <li><b>Circle on the side</b> The Linear status, drawn the way Linear draws it: empty for Todo, part filled for In Progress and In Review, a tick for Done.</li>
        <li><b>Red barrier</b> Merge conflicts. <b>Dashed outline</b> A draft pull request.</li>
        <li><b>Order</b> Trains queue at the exit signal. The one at the front has been open longest.</li>
        <li><b>Flow</b> Every line drains down the ladder track into the release road, then through PROD.</li>
        <li><b>Move</b> Drag to pan. Pinch, or hold ⌘ and scroll, to zoom. Double-click to zoom in.</li>
      </ul>
    </section>
  </aside>
</div>
<script>
(function () {
  var yard = document.querySelector(".yard");
  var svg = yard.querySelector(".iso-svg");
  var tip = yard.querySelector(".tip");
  var drawer = yard.querySelector(".drawer");
  var still = matchMedia("(prefers-reduced-motion: reduce)");

  // Inside the menu bar app, a button closes the window.
  var host = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.yard;
  if (host) {
    var quit = yard.querySelector(".quit");
    quit.hidden = false;
    yard.classList.add("native");
    quit.addEventListener("click", function (ev) { ev.stopPropagation(); host.postMessage("close"); });
  }

  // The SVG viewBox is the camera.
  var base = svg.viewBox.baseVal;
  var FULL = { x: base.x, y: base.y, w: base.width, h: base.height };
  var view = { x: FULL.x, y: FULL.y, w: FULL.w, h: FULL.h };
  var anim = 0;
  var dragged = false;
  function clampView(v) {
    v.w = Math.max(FULL.w / 7, Math.min(FULL.w, v.w));
    v.h = (v.w * FULL.h) / FULL.w;
    v.x = Math.max(FULL.x - v.w * 0.4, Math.min(FULL.x + FULL.w - v.w * 0.6, v.x));
    v.y = Math.max(FULL.y - v.h * 0.4, Math.min(FULL.y + FULL.h - v.h * 0.6, v.y));
    return v;
  }
  function apply() {
    svg.setAttribute("viewBox", view.x.toFixed(1) + " " + view.y.toFixed(1) + " " + view.w.toFixed(1) + " " + view.h.toFixed(1));
  }
  function flyTo(next, ms) {
    cancelAnimationFrame(anim);
    if (!ms || still.matches) {
      view = next;
      apply();
      return;
    }
    var from = { x: view.x, y: view.y, w: view.w, h: view.h };
    var start = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - start) / ms);
      var k = 1 - Math.pow(1 - t, 3);
      view = { x: from.x + (next.x - from.x) * k, y: from.y + (next.y - from.y) * k, w: from.w + (next.w - from.w) * k, h: from.h + (next.h - from.h) * k };
      apply();
      if (t < 1) anim = requestAnimationFrame(step);
    })(start);
  }
  function toSvg(x, y) {
    var pt = svg.createSVGPoint();
    pt.x = x;
    pt.y = y;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function zoomAt(x, y, factor, ms) {
    var at = toSvg(x, y);
    var w = Math.max(FULL.w / 7, Math.min(FULL.w, view.w * factor));
    var k = w / view.w;
    var next = w >= FULL.w ? { x: FULL.x, y: FULL.y, w: FULL.w, h: FULL.h } : clampView({ x: at.x - (at.x - view.x) * k, y: at.y - (at.y - view.y) * k, w: w, h: 0 });
    flyTo(next, ms);
  }
  function centre() {
    var r = svg.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }
  function unitsPerPixel(w) {
    var r = svg.getBoundingClientRect();
    return Math.max((w || view.w) / r.width, (((w || view.w) * FULL.h) / FULL.w) / r.height);
  }
  // Frame one line, and leave room for the drawer on the right.
  function focus(key) {
    var line = svg.querySelector('.line[data-lane="' + key + '"]');
    if (!line) return;
    var bb = line.getBBox();
    var wide = svg.getBoundingClientRect().width;
    var open = 1 - Math.min(400, wide * 0.4) / wide;
    var w = Math.min(FULL.w, Math.max((bb.width * 1.1) / open, FULL.w * 0.5));
    flyTo(clampView({ x: bb.x + bb.width / 2 - (w * open) / 2, y: bb.y + bb.height / 2 - ((w * FULL.h) / FULL.w) / 2 - 20, w: w, h: 0 }), 300);
  }

  function open(key) {
    drawer.querySelectorAll(".panel").forEach(function (p) { p.hidden = p.id !== "p-" + key; });
    svg.querySelectorAll(".line").forEach(function (l) { l.classList.toggle("on", l.dataset.lane === key); });
    drawer.hidden = false;
    drawer.scrollTop = 0;
    tip.hidden = true;
    if (key === "help" || key.indexOf("switch-") === 0) {
      yard.removeAttribute("data-focus");
      if (key !== "help") focus(key.slice(7));
    } else {
      yard.dataset.focus = key;
      focus(key);
    }
  }
  function close() {
    if (drawer.hidden) return;
    drawer.hidden = true;
    yard.removeAttribute("data-focus");
    svg.querySelectorAll(".line.on").forEach(function (l) { l.classList.remove("on"); });
    flyTo({ x: FULL.x, y: FULL.y, w: FULL.w, h: FULL.h }, 260);
  }
  yard.addEventListener("click", function (ev) {
    if (dragged) return;
    var fire = ev.target.closest("[data-fire]");
    if (fire) {
      svg.querySelectorAll('.lever[data-open="switch-' + fire.dataset.fire + '"]').forEach(function (l) { l.classList.add("on"); });
      if (host) {
        ev.preventDefault();
        host.postMessage({ open: fire.getAttribute("href") });
      }
      return;
    }
    var opener = ev.target.closest("[data-open]");
    var hit = ev.target.closest("[data-lane]");
    if (opener) open(opener.dataset.open);
    else if (hit) open(hit.dataset.lane);
    else if (!ev.target.closest(".drawer") && !ev.target.closest(".ctl") && !ev.target.closest(".quit")) close();
  });
  yard.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") close();
    var hit = ev.target.closest && ev.target.closest("[data-lane]");
    if (hit && (ev.key === "Enter" || ev.key === " ")) {
      ev.preventDefault();
      open(hit.dataset.lane);
    }
    if (ev.target.closest && ev.target.closest(".drawer")) return;
    var c = centre();
    if (ev.key === "+" || ev.key === "=") zoomAt(c[0], c[1], 0.6, 260);
    if (ev.key === "-") zoomAt(c[0], c[1], 1 / 0.6, 260);
    if (ev.key === "0") zoomAt(c[0], c[1], 100, 260);
  });
  drawer.querySelector(".close").addEventListener("click", function (ev) { ev.stopPropagation(); close(); });
  yard.querySelectorAll("[data-zoom]").forEach(function (b) {
    b.addEventListener("click", function () {
      var c = centre();
      var kind = b.dataset.zoom;
      zoomAt(c[0], c[1], kind === "in" ? 0.6 : kind === "out" ? 1 / 0.6 : 100, 260);
    });
  });

  svg.addEventListener("wheel", function (ev) {
    ev.preventDefault();
    if (ev.ctrlKey || ev.metaKey) {
      zoomAt(ev.clientX, ev.clientY, Math.exp(ev.deltaY * 0.01), 0);
    } else {
      var u = unitsPerPixel();
      flyTo(clampView({ x: view.x + ev.deltaX * u, y: view.y + ev.deltaY * u, w: view.w, h: view.h }), 0);
    }
  }, { passive: false });

  // One pointer pans. Two pointers pinch.
  var pointers = {};
  var down = null;
  var pinch = null;
  function spread() {
    var ids = Object.keys(pointers);
    var a = pointers[ids[0]];
    var b = pointers[ids[1]];
    return { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  svg.addEventListener("pointerdown", function (ev) {
    if (ev.pointerType === "mouse" && ev.button !== 0) return;
    pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    if (Object.keys(pointers).length === 2) {
      pinch = spread();
      down = null;
    } else {
      down = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y, moved: false };
    }
  });
  svg.addEventListener("pointermove", function (ev) {
    if (!pointers[ev.pointerId]) return;
    pointers[ev.pointerId] = { x: ev.clientX, y: ev.clientY };
    if (pinch && Object.keys(pointers).length === 2) {
      var now = spread();
      zoomAt(now.x, now.y, pinch.d / Math.max(1, now.d), 0);
      pinch = now;
      dragged = true;
      return;
    }
    if (!down) return;
    var dx = ev.clientX - down.x;
    var dy = ev.clientY - down.y;
    if (!down.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
    if (!down.moved) {
      down.moved = true;
      svg.setPointerCapture(ev.pointerId);
      yard.classList.add("panning");
      tip.hidden = true;
    }
    var u = unitsPerPixel();
    flyTo(clampView({ x: down.vx - dx * u, y: down.vy - dy * u, w: view.w, h: view.h }), 0);
  });
  function lift(ev) {
    delete pointers[ev.pointerId];
    if ((down && down.moved) || pinch) {
      dragged = true;
      yard.classList.remove("panning");
      setTimeout(function () { dragged = false; }, 0);
    }
    if (Object.keys(pointers).length < 2) pinch = null;
    down = null;
  }
  svg.addEventListener("pointerup", lift);
  svg.addEventListener("pointercancel", lift);
  svg.addEventListener("dblclick", function (ev) {
    if (!ev.target.closest("[data-lane]")) zoomAt(ev.clientX, ev.clientY, ev.shiftKey ? 2 : 0.5, 260);
  });

  function say(target, x, y) {
    var train = target.closest && target.closest(".train, .row");
    tip.hidden = !train;
    if (!train) return;
    var box = yard.getBoundingClientRect();
    tip.textContent = train.dataset.tip;
    tip.style.left = Math.max(160, Math.min(box.width - 160, x - box.left)) + "px";
    tip.style.top = Math.max(60, y - box.top) + "px";
  }
  yard.addEventListener("pointermove", function (ev) { if (!down || !down.moved) say(ev.target, ev.clientX, ev.clientY); });
  yard.addEventListener("pointerleave", function () { tip.hidden = true; });
  yard.addEventListener("focusin", function (ev) {
    var r = ev.target.getBoundingClientRect();
    say(ev.target, r.left + r.width / 2, r.top);
  });

  // The board says how old the data is.
  var stamp = svg.querySelector("[data-built]");
  function age() {
    var mins = Math.round((Date.now() - Number(stamp.dataset.built)) / 60000);
    stamp.textContent = mins < 1 ? "JUST NOW" : mins < 60 ? mins + " MIN AGO" : Math.round(mins / 60) + " H AGO";
    stamp.classList.toggle("old", mins > 120);
  }
  if (stamp) {
    age();
    setInterval(age, 60000);
  }
})();
</script>
`;


return html;
}
