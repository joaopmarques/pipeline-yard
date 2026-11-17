// Draw the pipeline as a classification yard, in the style of the anatomy skill.
// The yard stands on the ground. Each siding is a stage, and its track runs off both edges of the view.
// Work enters on the left and waits at the exit signal on the right.
// The sidings join one ladder track that runs down into the release road, and on to Production.
// Trains queue at the exit signal, and the one at the front has waited longest. Every train is the same size.
// An engine has a session. A box wagon is a merged change. A flat wagon is a ticket with no session.
// The state of a ticket and of a pull request is part of the train: a flag, a roof beacon, a round sign, a barrier.

import * as k from "../vendor/anatomy/iso-kit.mjs";

const WIDTH = 1600;
const HEIGHT = 880;
const GAP = 54;
// Vehicles are drawn at model size, then enlarged about their own spot on the rails.
const V = 1.3;
const RAIL_TOP = 2.2;
// The part of the yard the camera frames. Tracks run past it and fade.
const VIEW = { x: -205, y: -212, w: 640, d: 384 };
const TRAIL_LEFT = [-215, -250, -285, -330];
const TRAIL_RIGHT = [400, 440, 480, 530];
const PARK_MIN = -90;
// The ladder leaves the first siding at LADDER_X and meets the release road at JOIN_X.
const LADDER_X = 232;
const JOIN_X = 340;
const PORTAL_X = 358;
const SIGN = { x: 196, y: -206, w: 204 };

const trackY = (index) => -132 + index * GAP;

// How far a ticket is, as a share of the stripe on the side of its train.
const progressOf = (status) => {
  const name = (status ?? "").toLowerCase();
  if (!name) return null;
  if (/done/.test(name)) return [1, "#6e79e8"];
  if (/backlog|triage/.test(name)) return [0, "#9aa3b5", true];
  if (/cancel|duplicate/.test(name)) return [1, "#808080"];
  if (/qa|ready/.test(name)) return [0.86, "#4f9cff"];
  if (/review/.test(name)) return [0.66, "#2fb36d"];
  if (/progress/.test(name)) return [0.4, "#e8a317"];
  return [0.1, "#9aa3b5"];
};

const esc = (text) =>
  String(text ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]
  );

export function renderYard(model) {
  // The lines come from the project config. Each has a key, a kind, a colour, and a name.
  // Kinds: "tickets" and "work" are sidings that end at the ladder. "release" and "arrivals" run on.
  const LINES = model.lines;
  const REL = LINES.findIndex((line) => line.kind === "release");
  const ARR = LINES.findIndex((line) => line.kind === "arrivals");
  const exitX = (index) => LADDER_X + ((JOIN_X - LADDER_X) * index) / REL;
  const P = k.fitProjection(
    [...k.boxCorners(VIEW, 0, 0), [SIGN.x, SIGN.y, 126], [SIGN.x + SIGN.w, SIGN.y, 126], [-186, trackY(0) - 12, 26]],
    WIDTH,
    HEIGHT,
    { pad: 14, azimuth: 63, elevation: 33 }
  );
  const at = (point) => k.iso(point, P);
  const S = (paths, style) => k.solidSvg(paths, style);
  const L = (d, style) => k.lineSvg(d, style);
  const D = (points, style) => k.dotsSvg(points, style);
  const slab = (plan, z, h, style, steps = 3, bevel = 0) =>
    S(k.slabOf(plan, z, h, P, steps, bevel), style);
  const post = (x, y, r, z, h, style, steps = 14) => S(k.cylinder(x, y, r, z, h, P, steps), style);
  const floorText = (x, y, text, size, tone) =>
    k.faceTextSvg(k.topMatrix([x, y], 0.1, P, "x"), text, { size, tone });
  const lamp = (point, r, tone, extra = "") => {
    const [cx, cy] = at(point);
    const centre = `cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}"`;
    const halo = ["bad", "warn", "good", "glow"].includes(tone) ? `<circle class="lamp lamp-${tone} lamp-halo" ${centre} r="${(r * 2.2).toFixed(1)}"/>` : "";
    return `${halo}<circle class="lamp lamp-${tone}${extra}" ${centre} r="${r}"/>`;
  };
  const cast = (plan, z) => `<path class="cast" d="${k.onTop(k.ringOf(plan, 3), z, P, true)}"/>`;
  const shape = (points, cls, extra = "") =>
    `<path class="${cls}"${extra} d="M${points.map((p) => at(p).map((n) => n.toFixed(1)).join(" ")).join("L")}Z"/>`;
  const upright = (x, face, z, text, size, anchor = "start", cls = "") =>
    `<text class="iso-face-text ${cls}" transform="${k.sideMatrix([x, face], z, P, "left")}" font-size="${size}" text-anchor="${anchor}">${esc(text)}</text>`;

  // Upright things go in one list and paint back to front.
  const items = [];
  const put = (x, y, svg) => items.push({ depth: k.depthOf([x, y, 0], P), svg });

  // --- The ground: a grid in the same projection, in rings of solid lines. ---
  // A gradient or a mask on long lines is slow in WebKit.
  const RINGS = [
    [0, 520, 1],
    [520, 760, 0.6],
    [760, 980, 0.3],
    [980, 1180, 0.12],
  ];
  const HUB = [110, 0];
  const gridOf = (pick, [inner, outer]) => {
    const out = [];
    for (let v = -1200; v <= 1320; v += 40) {
      if (!pick(v)) continue;
      for (const axis of [0, 1]) {
        const off = Math.abs(v - HUB[axis]);
        if (off >= outer) continue;
        const far = Math.sqrt(outer * outer - off * off);
        const near = off < inner ? Math.sqrt(inner * inner - off * off) : 0;
        const mid = HUB[1 - axis];
        const spans = near > 0 ? [[-far, -near], [near, far]] : [[-far, far]];
        for (const [a, b] of spans) {
          const from = axis === 0 ? [v, mid + a, 0] : [mid + a, v, 0];
          const to = axis === 0 ? [v, mid + b, 0] : [mid + b, v, 0];
          out.push(k.segment(from, to, P));
        }
      }
    }
    return out.join("");
  };
  const base = [
    `<g class="grid">${RINGS.map(
      ([inner, outer, alpha]) =>
        `<path stroke-opacity="${alpha}" d="${gridOf((v) => v % 200 !== 0, [inner, outer])}"/>` +
        `<path class="grid-major" stroke-opacity="${alpha}" d="${gridOf((v) => v % 200 === 0, [inner, outer])}"/>`
    ).join("")}</g>`,
  ];

  // --- The ladder: every working siding drains into the release road. ---
  {
    const a = [LADDER_X, trackY(0)];
    const b = [JOIN_X, trackY(REL)];
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dir = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
    const side = [dir[1], -dir[0]];
    const along = (s, off = 0) => [a[0] + dir[0] * s + side[0] * off, a[1] + dir[1] * s + side[1] * off];
    const ring = [along(0, 7.6), along(length, 7.6), along(length, -7.6), along(0, -7.6)];
    const ladder = [S(k.extrude(ring, 0, 1.2, P), { tone: "lo", crease: "none", className: "bed" })];
    const ties = [];
    for (let s = 5; s < length - 3; s += 5) ties.push(k.onTop([along(s, -6.5), along(s, 6.5)], 1.2, P));
    ladder.push(L(ties.join(""), { tone: "lo" }));
    ladder.push(L(k.onTop([along(0, -4.9), along(length, -4.9)], RAIL_TOP, P) + k.onTop([along(0, 4.9), along(length, 4.9)], RAIL_TOP, P), { tone: "hi" }));
    ladder.push(L(k.onTop([along(4), along(length - 4)], RAIL_TOP + 0.2, P), { tone: "hi", flow: true, className: "flow-line" }));
    base.push(`<g class="ladder">${ladder.join("")}</g>`);
  }

  // --- Tracks. Each one fades in three steps where it leaves the view. ---
  const lineState = (cards) => {
    if (cards.some((c) => c.tone === "bad")) return "bad";
    if (cards.some((c) => c.tone === "warn")) return "warn";
    if (cards.some((c) => c.urgent)) return "warn";
    return cards.length ? "good" : "off";
  };
  const piece = (y, from, to, cls) => {
    const out = [slab({ x: from, y: y - 7.6, w: to - from, d: 15.2, r: 0 }, 0, 1.2, { tone: "lo", crease: "none", className: "bed" }, 2)];
    const ties = k.topTicks(from + 2, to - 2, 5, 5, y - 6.5, 1.2, [13, 13], P);
    out.push(L(ties.minor + ties.major, { tone: "lo" }));
    for (const ry of [y - 5.4, y + 4.4]) {
      out.push(slab({ x: from, y: ry - 0.2, w: to - from, d: 1.4, r: 0 }, 1.2, 1, { tone: "hi", crease: "none", className: "rail" }, 2));
    }
    return cls ? `<g class="${cls}">${out.join("")}</g>` : out.join("");
  };

  LINES.forEach((line, index) => {
    const y = trackY(index);
    const cards = model.lanes[line.key];
    const more = model.more?.[line.key] ?? 0;
    const runsOn = index >= REL;
    const end = runsOn ? TRAIL_RIGHT[0] : exitX(index);
    const track = [];
    for (let step = 3; step >= 1; step--) track.push(piece(y, TRAIL_LEFT[step], TRAIL_LEFT[step - 1], `fade f${step}`));
    track.push(piece(y, TRAIL_LEFT[0], end, ""));
    if (runsOn) {
      for (let step = 1; step <= 3; step++) track.push(piece(y, TRAIL_RIGHT[step - 1], TRAIL_RIGHT[step], `fade f${step}`));
    }
    base.push(`<g class="line" style="--c:${line.color}" data-lane="${line.key}" role="button" tabindex="0" aria-label="${esc(`${line.name}: ${cards.length + more}. ${line.hint}`)}">${track.join("")}</g>`);

    // The name of the line stands upright behind its track, like a station sign.
    const state = lineState(cards);
    const sw = line.name.length * 6.6 + 32;
    const sx = -186;
    const sy = y - 12;
    const face = sy + 2.4;
    put(
      sx + sw / 2,
      sy,
      `<g class="tint strong linesign" style="--c:${line.color}" data-lane="${line.key}" role="button" tabindex="0" aria-label="${esc(`${line.name}: ${cards.length + more}`)}">` +
        [
          cast({ x: sx + 4, y: sy + 4, w: sw, d: 7, r: 1.5 }, 0.05),
          post(sx + 8, sy + 1.2, 1.1, 0, 6, { tone: "mid", crease: "none" }, 8),
          post(sx + sw - 8, sy + 1.2, 1.1, 0, 6, { tone: "mid", crease: "none" }, 8),
          slab({ x: sx, y: sy, w: sw, d: 2.4, r: 0.6 }, 6, 18, { tone: "hi", lit: true }, 2, 0.4),
          upright(sx + 5, face, 11.4, line.name, 10),
          upright(sx + sw - 5, face, 11.4, String(cards.length + more), 10, "end", "sign-count"),
          lamp([sx + sw - 5, face, 21], 2, state, state === "bad" ? " blink" : ""),
        ].join("") +
        "</g>"
    );

    {
      const sw = model.switches?.[line.key];
      if (sw) {
        // A ground lever: throw it to start work on this line.
        const lx = runsOn ? (line.kind === "release" ? 424 : 356) : end + (index === REL - 1 ? 68 : 30);
        const ly = runsOn ? y + 24 : y;
        const text = `${sw.label} ${sw.count}`;
        const pw = text.length * 4.5 + 9;
        const arm = (dx) =>
          `<path class="arm" d="${k.segment([lx, ly, 4.4], [lx + dx, ly, 23], P)}"/>` +
          (() => {
            const [kx, ky] = at([lx + dx, ly, 23]);
            return `<circle class="knob-halo" cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="13"/><circle class="knob" cx="${kx.toFixed(1)}" cy="${ky.toFixed(1)}" r="7"/>`;
          })();
        put(
          lx,
          ly,
          `<g class="lever tint strong" style="--c:${line.color}" data-open="switch-${line.key}" data-tip="${esc(`${sw.name} (${sw.count})`)}" role="button" tabindex="0" aria-label="${esc(sw.name)}">` +
            [
              shape([[lx - pw / 2 - 1, ly + 11, 0], [lx + pw / 2 + 1, ly + 11, 0], [lx + pw / 2 + 1, ly, 38], [lx - pw / 2 - 1, ly, 38]], "row-hit"),
              cast({ x: lx - 8, y: ly - 2, w: 24, d: 16, r: 2 }, 0.05),
              slab({ x: lx - 12, y: ly - 7, w: 24, d: 14, r: 1.6 }, 0, 4.4, { tone: "hi", lit: true }, 3, 0.6),
              L(k.lineOnTop([lx - 8, ly], [lx + 8, ly], 4.4, P), { tone: "hi" }),
              `<g class="rest">${arm(-10)}</g>`,
              `<g class="thrown">${arm(10)}</g>`,
              slab({ x: lx - pw / 2, y: ly + 9, w: pw, d: 1.6, r: 0.4 }, 0, 10, { tone: "hi", lit: true }, 2, 0.3),
              upright(lx, ly + 10.6, 2.6, text, 6.4, "middle", "lever-label"),
            ].join("") +
            "</g>"
        );
      }
    }

    if (!runsOn) {
      // Exit signal: work waits here until it may move on.
      const ex = end - 9;
      const ey = y + 12;
      put(
        ex,
        ey,
        [
          post(ex, ey, 2.4, 0, 1, { tone: "lo" }),
          post(ex, ey, 0.9, 1, 21, { tone: "mid", crease: "none" }, 10),
          `<g class="tint" style="--c:${line.color}">${slab({ x: ex - 2, y: ey - 2, w: 4, d: 4, r: 0.8 }, 22, 7, { tone: "mid" }, 3, 0.4)}</g>`,
          lamp([ex + 2, ey, 25.5], 3, state, state === "bad" ? " blink" : ""),
        ].join("")
      );
    }
  });

  // --- Vehicles ---
  const shortId = (card) => {
    if (card.ticketId) return card.ticketId.replace(/^[A-Z]+-/, "");
    return card.pr ? String(card.pr) : "";
  };
  const tipOf = (card) =>
    [card.ticketId ?? (card.pr ? `#${card.pr}` : "No ticket"), card.title, card.note].filter(Boolean).join(" · ");

  const wheels = (cx, y, len) => {
    const xs = len < 14 ? [-0.3, 0.3] : [-0.36, -0.14, 0.14, 0.36];
    const centres = xs.map((share) => [cx + share * len, y + 4.5, RAIL_TOP + 1.7]);
    const rod = len >= 20 ? L(k.segment(centres[0], centres[centres.length - 1], P), { tone: "mid" }) : "";
    return L(centres.map((c) => k.sideRing(c, 1.7, "y", P, 14)).join(""), { tone: "mid" }) + rod + D(centres.map(at), { size: 0.7 });
  };
  const chassis = (cx, y, len) =>
    cast({ x: cx - len / 2 + 2.2, y: y - 4.5 + 3.4, w: len, d: 9, r: 2 }, 1.25) +
    slab({ x: cx - len / 2, y: y - 4.5, w: len, d: 9, r: 0.8 }, RAIL_TOP + 1.6, 1.6, { tone: "lo" }, 2) +
    wheels(cx, y, len);
  const roofText = (cx, y, z, text, size) =>
    text
      ? k.faceTextSvg(k.topMatrix([cx, y + size * 0.36], z, P, "x"), text, { size, tone: "hi", anchor: "middle" })
      : "";
  const TOP = RAIL_TOP + 3.2;

  // The Linear status is a round sign on the side of the train, drawn the way Linear draws it.
  const roundel = (card, cx0, face, z0, r) => {
    const progress = progressOf(card.ticketStatus);
    if (!progress) return "";
    const [share, color, dashed] = progress;
    const on = (dx, dz) => [cx0 + dx, face, z0 + dz];
    const arc = (from, to, rr, steps) =>
      Array.from({ length: steps + 1 }, (_, i) => {
        const angle = from + ((to - from) * i) / steps;
        return on(Math.sin(angle) * rr, Math.cos(angle) * rr);
      });
    const out = [shape(arc(0, Math.PI * 2, r, 20), "roundel-back")];
    if (share >= 1) {
      out.push(shape(arc(0, Math.PI * 2, r, 20), "roundel-fill", ` style="fill:${color}"`));
      const tick = [on(-r * 0.42, 0), on(-r * 0.1, -r * 0.34), on(r * 0.46, r * 0.36)];
      out.push(`<path class="roundel-check" d="M${tick.map((p) => at(p).map((n) => n.toFixed(1)).join(" ")).join("L")}"/>`);
    } else {
      if (share > 0.2) {
        out.push(shape([on(0, 0), ...arc(0, Math.PI * 2 * share, r * 0.62, 14)], "roundel-fill", ` style="fill:${color}"`));
      }
      out.push(shape(arc(0, Math.PI * 2, r, 20), `roundel-ring${dashed ? " dashed" : ""}`, ` style="stroke:${color}"`));
    }
    return out.join("");
  };

  function engine(cx, y, card, { len = 24, label = shortId(card), big = false } = {}) {
    const lit = card.tone === "bad" || big;
    const tone = "hi";
    const h = big ? 8 : 6.4;
    const roof = TOP + h + 4.9;
    const cab = { x: cx - len / 2 + 0.4, y: y - 4.4, w: 7.6, d: 8.8, r: 1 };
    const out = [chassis(cx, y, len)];
    out.push(slab(cab, TOP, h + 4, { tone, lit }, 3));
    out.push(slab(k.insetPlan(cab, -0.8), TOP + h + 4, 0.9, { tone, lit }, 3, 0.3));
    const boiler = { x: cx - len / 2 + 8, y: y - 3.7, w: len - 8.4, d: 7.4, r: 3.2 };
    out.push(slab(boiler, TOP, h, { tone, lit }, 5, 0.5));
    out.push(
      L(
        [boiler.x + 3.4, boiler.x + boiler.w - 4.6]
          .map((bx) => k.lineOnTop([bx, y - 3.1], [bx, y + 3.7], TOP + h, P) + k.rise([bx, y + 3.7], TOP, TOP + h, P))
          .join(""),
        { tone: "lo" }
      )
    );
    out.push(slab({ x: cx + len / 2 - 0.5, y: y - 4.7, w: 1.2, d: 9.4, r: 0.3 }, RAIL_TOP + 1.3, 2.3, { tone, lit }, 2));
    out.push(D([-2.7, 2.7].map((dy) => at([cx + len / 2 + 0.75, y + dy, RAIL_TOP + 2.5])), { size: 0.9 }));
    out.push(L(k.sideSeam(boiler, TOP + h * 0.45, P, 5), { tone: "faint" }));
    out.push(roundel(card, cx - len / 2 + 4.2, y + 4.4, TOP + (h + 4) * 0.5, 3.1));
    out.push(roofText(cx + (big ? 2.6 : 1.3), y, TOP + h, label, big ? 5.2 : label.length > 3 ? 4.6 : 5.6));
    out.push(post(cx + len / 2 - 2.5, y, 1.4, TOP + h, 3.4, { tone, lit }, 12));
    out.push(post(cx + len / 2 - 2.5, y, 1.8, TOP + h + 3.4, 0.7, { tone, lit }, 12));
    if (card.tone !== "quiet" || card.urgent) {
      out.push(lamp([cx + len / 2 - 0.3, y, TOP + h * 0.55], 2.8, card.tone === "quiet" ? "warn" : card.tone));
    }

    const gh = card.gh;
    if (gh && gh.state !== "merged") {
      // Checks: a beacon on the cab roof. Red and flashing is a failure, amber and flashing is a run in progress.
      if (gh.checks) {
        const bx = cx - len / 2 + 5.4;
        const by = y + 1.6;
        out.push(post(bx, by, 1.2, roof, 0.9, { tone }, 10));
        const kind = { failing: "bad", running: "warn", passing: "good" }[gh.checks];
        out.push(lamp([bx, by, roof + 1.5], 1.8, kind, gh.checks === "passing" ? "" : " blink"));
      }
      // Review: a flag on the cab. Green is approved, red is changes requested, an empty outline is no review yet.
      if (gh.review) {
        const fx = cx - len / 2 + 1.6;
        const fy = y - 2.8;
        out.push(L(k.rise([fx, fy], roof, roof + 11, P), { tone: "hi" }));
        const kind = { APPROVED: "good", CHANGES_REQUESTED: "bad", REVIEW_REQUIRED: "wait" }[gh.review] ?? "wait";
        out.push(shape([[fx, fy, roof + 11], [fx + 9, fy, roof + 8.2], [fx, fy, roof + 5.4]], `flag flag-${kind}`));
      }
      // Conflicts: a red barrier across the rails in front of the engine.
      if (gh.merge === "conflicts") {
        const bx = cx + len / 2 + 2.6;
        out.push(
          `<g class="tint strong" style="--c:#ff5b52">${post(bx, y - 5.8, 0.7, RAIL_TOP, 3.6, { tone: "hi", crease: "none" }, 6)}${post(bx, y + 5.8, 0.7, RAIL_TOP, 3.6, { tone: "hi", crease: "none" }, 6)}${slab({ x: bx - 0.8, y: y - 7, w: 1.6, d: 14, r: 0.3 }, RAIL_TOP + 3.6, 2.2, { tone: "hi", lit: true }, 2)}</g>`
        );
      }
    }

    if (card.running || big) {
      const [px, py] = at([cx + len / 2 - 2.5, y, TOP + h + 5]);
      out.push(
        `<g class="steam">${[0, 1, 2].map((n) => `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="3.4" style="animation-delay:${n * 0.8}s"/>`).join("")}</g>`
      );
    }
    return out.join("");
  }

  function wagon(cx, y, card, { len = 18, flat = false, plain = false } = {}) {
    const lit = card.tone === "bad";
    const tone = "hi";
    const out = [chassis(cx, y, len)];
    if (flat) {
      out.push(slab({ x: cx - len / 2 + 0.4, y: y - 4.3, w: len - 0.8, d: 8.6, r: 0.6 }, TOP, 1, { tone, lit }, 2));
      out.push(D([-1, 1].flatMap((s) => [-1, 1].map((t) => at([cx + s * (len / 2 - 1.6), y + t * 3.2, TOP + 1]))), { size: 0.8 }));
      out.push(roofText(cx, y, TOP + 1, shortId(card), 5.6));
    } else {
      const body = { x: cx - len / 2 + 0.5, y: y - 4.3, w: len - 1, d: 8.6, r: 0.8 };
      out.push(slab(body, TOP, plain ? 5.4 : 6.6, { tone, lit }, 3));
      if (!plain) out.push(slab(k.insetPlan(body, -0.5), TOP + 6.6, 0.8, { tone, lit }, 3, 0.3));
      if (!plain) {
        out.push(L(k.sideSeam(body, TOP + 5.8, P, 3), { tone: "faint" }));
        out.push(roundel(card, cx, y + 4.3, TOP + 2.9, 2.6));
        out.push(roofText(cx, y, TOP + 7.4, shortId(card), 5.8));
      } else {
        out.push(L(k.sideSeam(body, TOP + 4.2, P, 3), { tone: "faint" }));
      }
    }
    if (!plain && (card.tone !== "quiet" || card.urgent)) {
      out.push(lamp([cx + len / 2 - 0.1, y, TOP + (flat ? 0.6 : 3.4)], 2.6, card.urgent && card.tone === "quiet" ? "ring" : card.tone));
    }
    return out.join("");
  }

  const coupling = (x0, x1, y) => L(k.segment([x0, y, RAIL_TOP + 2.6], [x1, y, RAIL_TOP + 2.6], P), { tone: "mid" });

  const enlarge = (cx, y, body) => {
    const [ax, ay] = at([cx, y, RAIL_TOP]);
    return `<g transform="translate(${ax.toFixed(1)} ${ay.toFixed(1)}) scale(${V}) translate(${(-ax).toFixed(1)} ${(-ay).toFixed(1)})">${body}</g>`;
  };
  const colorOf = Object.fromEntries(LINES.map((line) => [line.key, line.color]));
  const releaseColor = LINES[REL].color;
  const arrivalsColor = LINES[ARR]?.color ?? releaseColor;
  let rolled = 0;
  const vehicle = (lane, cx, y, card, raw) => {
    const body = enlarge(cx, y, raw);
    const inner = `<g class="roll" style="--d:${rolled++ * 14}ms">${card.running ? `<g class="run">${body}</g>` : body}</g>`;
    const kind = `t-${card.tone ?? "quiet"}${card.gh?.state === "draft" ? " draft" : ""}${lane === LINES[REL].key && model.departed?.cars?.length ? " late" : ""}`;
    put(
      cx,
      y,
      `<g class="train ${kind}" style="--c:${colorOf[lane]}" data-lane="${lane}" data-tip="${esc(tipOf(card))}" role="button" tabindex="0" aria-label="${esc(tipOf(card))}">${inner}</g>`
    );
  };

  // Trains queue at the exit signal. The one that has waited longest stands at the front.
  const queue = (cards, lengthOf, from, to) => {
    const list = cards.map((card) => ({ card, len: lengthOf(card) })).sort((p, q) => (q.card.age ?? 0) - (p.card.age ?? 0));
    let edge = to;
    for (const item of list) {
      item.x = edge - item.len / 2;
      edge = item.x - item.len / 2 - 3.5;
    }
    return list.filter((item) => item.x - item.len / 2 >= from - 0.5);
  };

  const RELEASE_FRONT = 310;
  LINES.forEach((line, index) => {
    const y = trackY(index);
    const cards = model.lanes[line.key];
    if (line.kind === "tickets") {
      for (const { card, x } of queue(cards, () => 18 * V, PARK_MIN, exitX(index) - 18)) {
        vehicle(line.key, x, y, card, wagon(x, y, card, { flat: true }));
      }
    } else if (line.kind === "release") {
      // The release engine faces Production. Changes on Staging are coupled behind it.
      const aboard = cards.filter((c) => c.where?.startsWith("Staging"));
      const waiting = cards.filter((c) => !c.where?.startsWith("Staging"));
      const front = RELEASE_FRONT;
      const loco = { tone: "good", title: `Release ${model.releaseName}`, note: `${aboard.length} coupled at Staging, ${waiting.length} not coupled yet` };
      put(front, y, `<g class="train loco${model.departed?.cars?.length ? " late" : ""}" style="--c:${releaseColor}" data-lane="${line.key}" data-tip="${esc(`Release ${model.releaseName} · ${loco.note}`)}" role="button" tabindex="0" aria-label="${esc(`Release ${model.releaseName}. ${loco.note}`)}">${enlarge(front, y, engine(front, y, loco, { len: 30, label: model.releaseName, big: true }))}</g>`);
      aboard.slice(0, 9).forEach((card, n) => {
        const cx = front - 35 - n * 27;
        vehicle(line.key, cx, y, card, coupling(cx + 9, cx + 11, y) + wagon(cx, y, card));
      });
      const tail = front - 35 - Math.min(aboard.length, 9) * 27 - 22;
      waiting.slice(0, 4).forEach((card, n) => vehicle(line.key, tail - n * 27, y, card, wagon(tail - n * 27, y, card)));
    } else if (line.kind === "arrivals") {
      cards.slice(0, 6).forEach((card, n) => vehicle(line.key, 318 - n * 27, y, card, wagon(318 - n * 27, y, card)));
    } else {
      for (const { card, x } of queue(cards, () => 24 * V, PARK_MIN, exitX(index) - 18)) {
        vehicle(line.key, x, y, card, engine(x, y, card));
      }
    }
  });

  // A release that left since the last refresh drives out through the portal once.
  if (model.departed?.cars?.length) {
    const y = trackY(REL);
    const front = RELEASE_FRONT - 16;
    const body = [enlarge(front, y, engine(front, y, { tone: "good" }, { len: 30, label: model.departed.tag, big: true }))];
    model.departed.cars.slice(0, 8).forEach((card, n) => {
      const cx = front - 35 - n * 27;
      body.push(enlarge(cx, y, coupling(cx + 9, cx + 11, y) + wagon(cx, y, { ...card, tone: "good" })));
    });
    const [ox, oy] = k.axisVector(P, [420, 0, 0]);
    put(PORTAL_X - 6, y, `<g class="depart train" style="--c:${arrivalsColor};--ox:${ox.toFixed(1)}px;--oy:${oy.toFixed(1)}px" aria-hidden="true">${body.reverse().join("")}</g>`);
  }

  // --- Portal to Production, at the end of the release road ---
  {
    const y = trackY(REL);
    // The headlight of the release engine falls on the rails ahead of it.
    base.push(shape([[RELEASE_FRONT + 21, y - 2, RAIL_TOP + 0.3], [PORTAL_X + 30, y - 9, RAIL_TOP + 0.3], [PORTAL_X + 30, y + 9, RAIL_TOP + 0.3], [RELEASE_FRONT + 21, y + 2, RAIL_TOP + 0.3]], "beam"));
    put(PORTAL_X, y - 13, post(PORTAL_X, y - 13, 1.5, 0, 31, { tone: "mid", crease: "none" }, 12));
    const lintel = { x: PORTAL_X - 2.2, y: y - 15, w: 4.4, d: 30, r: 0.8 };
    put(
      PORTAL_X + 1,
      y + 14,
      [
        post(PORTAL_X, y + 13, 1.5, 0, 31, { tone: "mid", crease: "none" }, 12),
        `<g class="tint strong" style="--c:${arrivalsColor}">${slab(lintel, 31, 9, { tone: "hi", lit: true }, 3, 0.5)}</g>`,
        k.faceTextSvg(k.sideMatrix([PORTAL_X + 2.2, y + 11.5], 33.2, P, "right"), "PROD", { size: 6.6, tone: "hi" }),
        lamp([PORTAL_X + 2.2, y - 11.5, 35.5], 2.6, model.unreleased ? "warn" : "good"),
      ].join("")
    );
    base.push(floorText(PORTAL_X + 8, y + 24, model.prodTag ?? "", 8, "mid"));
  }

  // Goods platform and a small station beside the arrivals line: unloading is the evidence comment.
  if (ARR >= 0) {
    const y = trackY(ARR);
    const plat = { x: 196, y: y + 9.5, w: 140, d: 14, r: 1 };
    const hut = { x: 204, y: y + 11.5, w: 20, d: 9, r: 0.6 };
    put(
      plat.x + plat.w,
      plat.y + plat.d,
      `<g class="tint" style="--c:${arrivalsColor}">` + [
        cast({ x: plat.x + 3, y: plat.y + 4, w: plat.w, d: plat.d, r: 1 }, 0.05),
        slab(plat, 0, 4.4, { tone: "mid" }, 3, 0.5),
        L(k.planOutline(k.insetPlan(plat, 1.6), 4.4, P, 3), { tone: "faint" }),
        slab(hut, 4.4, 9, { tone: "mid" }, 2, 0.3),
        L(k.rise([hut.x + 5, hut.y + hut.d], 4.4, 10.4, P) + k.rise([hut.x + 9, hut.y + hut.d], 4.4, 10.4, P) + k.segment([hut.x + 5, hut.y + hut.d, 10.4], [hut.x + 9, hut.y + hut.d, 10.4], P), { tone: "lo" }),
        slab(k.insetPlan(hut, -1.4), 13.4, 1.6, { tone: "hi" }, 2, 0.4),
        slab({ x: 296, y: y + 12, w: 8, d: 7, r: 0.6 }, 4.4, 6, { tone: "mid" }, 2, 0.3),
        slab({ x: 306, y: y + 13, w: 6, d: 5, r: 0.6 }, 4.4, 4, { tone: "mid" }, 2, 0.3),
        slab({ x: 298, y: y + 13, w: 5, d: 5, r: 0.6 }, 10.4, 3.4, { tone: "mid" }, 2, 0.3),
      ].join("") + "</g>"
    );
  }

  // Yard lamps between the lines. Each one lights a pool on the ground.
  for (const [x, y] of [[-60, -176], [130, -176], [40, 180], [452, -51]]) {
    base.push(`<path class="pool" d="${k.ring(x + 4, y, 20, 0.05, P, 28)}"/>`);
    put(
      x,
      y,
      [
        post(x, y, 1.8, 0, 1, { tone: "lo" }, 10),
        post(x, y, 0.7, 1, 33, { tone: "mid", crease: "none" }, 8),
        slab({ x: x - 0.8, y: y - 0.8, w: 6, d: 1.6, r: 0.4 }, 34, 1.2, { tone: "mid" }, 2),
        lamp([x + 4.6, y, 33.6], 1.8, "glow"),
      ].join("")
    );
  }

  // A few trees at the edges of the yard.
  for (const [x, y, size] of [[-160, -196, 1], [-136, -206, 0.8], [-182, -208, 0.7], [56, -210, 0.9], [78, -200, 0.7], [470, 176, 1], [492, 164, 0.75], [448, 186, 0.7], [-150, 176, 0.9], [-126, 182, 0.65], [430, -150, 0.8]]) {
    put(
      x,
      y,
      `<g class="tint tree" style="--c:#5fa873">` +
        [
          `<path class="cast" d="${k.ring(x + 4 * size, y + 4 * size, 6.4 * size, 0.05, P, 16)}"/>`,
          post(x, y, 0.9 * size, 0, 5 * size, { tone: "mid", crease: "none" }, 6),
          post(x, y, 6 * size, 5 * size, 4.4 * size, { tone: "mid" }, 12),
          post(x, y, 4.6 * size, 9.4 * size, 4 * size, { tone: "mid" }, 12),
          post(x, y, 2.8 * size, 13.4 * size, 3.4 * size, { tone: "mid" }, 10),
        ].join("") +
        "</g>"
    );
  }

  // Departure board behind the yard: what needs the user now. Each row opens its line.
  {
    const rowsN = Math.max(1, model.needs.length) + (model.moreNeeds ? 1 : 0);
    const rowH = 15;
    const z0 = 24;
    const bh = 20 + rowsN * rowH + 5;
    const panel = { x: SIGN.x, y: SIGN.y, w: SIGN.w, d: 5, r: 1 };
    const face = SIGN.y + 5;
    const onFace = (x, z, str, size, cls, extra = "") =>
      `<text class="iso-face-text ${cls}" transform="${k.sideMatrix([x, face], z, P, "left")}" font-size="${size}"${extra}>${esc(str)}</text>`;
    const quad = (x0, x1, za, zb) =>
      `M${[[x0, za], [x1, za], [x1, zb], [x0, zb]].map(([x, z]) => at([x, face, z]).map((n) => n.toFixed(1)).join(" ")).join("L")}Z`;
    const top = z0 + bh;
    const out = [
      cast({ x: SIGN.x + 8, y: SIGN.y + 8, w: SIGN.w, d: 14, r: 2 }, 0.05),
      post(SIGN.x + 16, SIGN.y + 2.5, 2.6, 0, 1.2, { tone: "lo" }),
      post(SIGN.x + SIGN.w - 16, SIGN.y + 2.5, 2.6, 0, 1.2, { tone: "lo" }),
      post(SIGN.x + 16, SIGN.y + 2.5, 1.5, 1.2, z0 - 1.2, { tone: "mid", crease: "none" }, 12),
      post(SIGN.x + SIGN.w - 16, SIGN.y + 2.5, 1.5, 1.2, z0 - 1.2, { tone: "mid", crease: "none" }, 12),
      slab(panel, z0, bh, { tone: "hi", lit: true }, 3, 0.6),
      L(k.segment([SIGN.x + 4, face, top - 19], [SIGN.x + SIGN.w - 4, face, top - 19], P), { tone: "mid" }),
      onFace(SIGN.x + 8, top - 15, model.needs.length ? "NEEDS YOU NOW" : "ALL CLEAR", 11, model.needs.length ? "sign-head" : "sign-clear"),
      onFace(SIGN.x + SIGN.w - 8, top - 15, "", 6.8, "sign-age", ` text-anchor="end" data-built="${model.builtAt}"`),
      lamp([SIGN.x + SIGN.w - 60, face, top - 12], 3, model.needs.length ? "bad" : "good", model.needs.length ? " blink" : ""),
    ];
    model.needs.forEach((need, n) => {
      const z = top - 20 - (n + 1) * rowH;
      out.push(
        `<g class="row" style="--d:${100 + n * 55}ms" data-lane="${need.lane}" data-tip="${esc(need.text)}" role="button" tabindex="0" aria-label="${esc(need.text)}">` +
          `<path class="row-hit" d="${quad(SIGN.x + 3, SIGN.x + SIGN.w - 3, z, z + rowH)}"/>` +
          onFace(SIGN.x + 8, z + 4, `0${n + 1}`, 9.8, "num") +
          onFace(SIGN.x + 28, z + 4, need.short, 9.8, "what") +
          "</g>"
      );
      out.push(L(k.segment([SIGN.x + 4, face, z], [SIGN.x + SIGN.w - 4, face, z], P), { tone: "faint" }));
    });
    if (model.moreNeeds) {
      const z = top - 20 - (model.needs.length + 1) * rowH;
      out.push(
        `<g class="row" style="--d:${100 + model.needs.length * 55}ms" data-open="help" data-tip="See everything that needs you" role="button" tabindex="0" aria-label="${model.moreNeeds} more">` +
          `<path class="row-hit" d="${quad(SIGN.x + 3, SIGN.x + SIGN.w - 3, z, z + rowH)}"/>` +
          onFace(SIGN.x + 28, z + 4, `+${model.moreNeeds} MORE`, 9.8, "sign-more") +
          "</g>"
      );
    }
    put(SIGN.x + SIGN.w / 2, SIGN.y, `<g class="sign">${out.join("")}</g>`);
  }

  items.sort((a, b) => a.depth - b.depth);

  const total = LINES.reduce((sum, line) => sum + model.lanes[line.key].length + (model.more?.[line.key] ?? 0), 0);
  const svg = k.figureSvg({
    width: WIDTH,
    height: HEIGHT,
    label: `A model railway yard with six sidings, one for each stage of work. ${total} vehicles stand on them, the oldest nearest the exit. The sidings join a ladder track that runs into the release road, where a release engine faces a portal marked Production.`,
    body: [base.join(""), items.map((item) => item.svg).join("")],
  });

  return { svg, total, roll: k.axisVector(P, [-90, 0, 0]) };
}
