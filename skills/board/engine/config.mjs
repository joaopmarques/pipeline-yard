// Check a project config before the yard is built.
// A wrong config must stop with a clear message. It must not draw a wrong yard.

const HEX = /^#[0-9a-fA-F]{6}$/;
const KINDS = ["tickets", "work", "release", "arrivals"];

export function validate(config, preset) {
  const problems = [];
  const need = (ok, message) => {
    if (!ok) problems.push(message);
  };

  need(typeof config.preset === "string", 'Set "preset" to the name of a file in presets/.');
  need(config.release && typeof config.release.branch === "string", 'Set "release.branch" to the branch that pull requests merge into.');
  need(["tags", "none"].includes(config.release?.mode ?? "tags"), '"release.mode" is "tags" or "none".');
  if ((config.release?.mode ?? "tags") === "tags") {
    for (const name of ["production", "staging"]) {
      try {
        new RegExp(config.release?.[name] ?? "");
        need(Boolean(config.release?.[name]), `Set "release.${name}" to a pattern that matches the tags of that environment.`);
      } catch {
        problems.push(`"release.${name}" is not a valid pattern.`);
      }
    }
  }
  for (const name of ["staleReviewDays", "inboxLimit", "redMax"]) {
    need(Number.isInteger(config[name]) && config[name] >= 0, `"${name}" is a whole number, zero or more.`);
  }
  for (const name of ["inboxStatuses", "qaStatuses"]) {
    need(Array.isArray(config[name]), `"${name}" is a list of status names. Use an empty list if there is no tracker.`);
  }
  need(config.labels && typeof config.labels === "object", 'Set "labels". Use null for a label the project does not have.');

  // The project section holds what the lever skills read. Every part of it is optional.
  const project = config.project ?? {};
  const text = (value) => value === undefined || value === null || typeof value === "string";
  const texts = (value) => value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
  for (const name of ["gates", "rules", "lowRiskLabels", "releaseDocs"]) {
    need(texts(project[name]), `"project.${name}" is a list of texts.`);
  }
  for (const name of ["tracker", "decisions", "reviewSkill", "rerunReview", "chat", "stagingCommand", "productionCommand"]) {
    need(text(project[name]), `"project.${name}" is a text, or null.`);
  }
  for (const name of ["stagingCommand", "productionCommand"]) {
    need(!project[name] || project[name].includes("{version}"), `"project.${name}" needs "{version}" where the version goes.`);
  }

  const lines = Array.isArray(config.lines) ? config.lines : [];
  need(lines.length > 0, 'Set "lines": one entry for each line of the yard.');
  const keys = lines.map((line) => line.key);
  need(new Set(keys).size === keys.length, "Two lines have the same key.");
  for (const key of preset.LINE_KEYS) {
    need(keys.includes(key), `The preset needs a line with the key "${key}".`);
  }
  for (const line of lines) {
    const where = `Line "${line.key}"`;
    need(preset.LINE_KEYS.includes(line.key), `${where}: the preset does not know this key. It knows: ${preset.LINE_KEYS.join(", ")}.`);
    need(KINDS.includes(line.kind), `${where}: "kind" is one of ${KINDS.join(", ")}.`);
    need(preset.LINE_KINDS[line.key] === undefined || preset.LINE_KINDS[line.key] === line.kind, `${where}: the preset expects the kind "${preset.LINE_KINDS[line.key]}".`);
    need(HEX.test(line.color ?? ""), `${where}: "color" is a hex colour such as #4f9cff.`);
    need(typeof line.name === "string" && line.name.length > 0 && line.name.length <= 12, `${where}: "name" is the sign text, 12 characters at most.`);
    need(line.panel && ["name", "hint", "empty"].every((part) => typeof line.panel[part] === "string"), `${where}: "panel" needs "name", "hint", and "empty".`);
    if (line.lever) {
      need(["label", "name", "skill", "prompt"].every((part) => typeof line.lever[part] === "string"), `${where}: "lever" needs "label", "name", "skill", and "prompt".`);
      need((line.lever.label ?? "").length <= 7, `${where}: the lever label is 7 characters at most.`);
    }
  }
  need(lines.filter((line) => line.kind === "release").length === 1, 'The yard needs exactly one line of the kind "release".');
  need(lines.filter((line) => line.kind === "arrivals").length <= 1, 'The yard takes one line of the kind "arrivals" at most.');
  const release = lines.findIndex((line) => line.kind === "release");
  need(lines.every((line, index) => (index < release) === (line.kind === "tickets" || line.kind === "work")), 'Put every "tickets" and "work" line before the "release" line, and "arrivals" after it.');
  return problems;
}
