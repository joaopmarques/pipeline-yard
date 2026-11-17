// Fill a text template from the project config.
// "{name}" takes a value. "{n|one thing|many things}" picks a form by the count.
export function fill(template, values = {}, count = 0) {
  return String(template ?? "")
    .replace(/\{n\|([^|}]*)\|([^}]*)\}/g, (_, one, many) => (count === 1 ? one : many))
    .replace(/\{(\w+)\}/g, (whole, name) => (name in values ? String(values[name]) : whole));
}
