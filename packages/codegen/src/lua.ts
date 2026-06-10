/**
 * Serialize JSON-compatible data to a Lua table literal.
 *
 * This is how PdLua externals (proggen, voiceleader, chord dictionaries)
 * consume the suite's canonical data: the TypeScript source of truth emits
 * Lua tables at build time instead of hand-maintained copies drifting.
 */

export type LuaValue =
  | null
  | boolean
  | number
  | string
  | LuaValue[]
  | { [key: string]: LuaValue };

const LUA_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const LUA_KEYWORDS = new Set([
  "and", "break", "do", "else", "elseif", "end", "false", "for", "function",
  "goto", "if", "in", "local", "nil", "not", "or", "repeat", "return",
  "then", "true", "until", "while",
]);

function escapeString(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r")}"`;
}

function serialize(value: LuaValue, indent: number, depth: number): string {
  if (value === null) return "nil";
  switch (typeof value) {
    case "boolean":
      return value ? "true" : "false";
    case "number":
      if (!Number.isFinite(value)) throw new Error(`Cannot serialize non-finite number: ${value}`);
      return String(value);
    case "string":
      return escapeString(value);
  }

  const pad = " ".repeat(indent * (depth + 1));
  const closePad = " ".repeat(indent * depth);

  if (Array.isArray(value)) {
    if (value.length === 0) return "{}";
    const items = value.map((v) => pad + serialize(v, indent, depth + 1));
    return `{\n${items.join(",\n")},\n${closePad}}`;
  }

  const entries = Object.entries(value);
  if (entries.length === 0) return "{}";
  const items = entries.map(([k, v]) => {
    const key = LUA_IDENT.test(k) && !LUA_KEYWORDS.has(k) ? k : `[${escapeString(k)}]`;
    return `${pad}${key} = ${serialize(v, indent, depth + 1)}`;
  });
  return `{\n${items.join(",\n")},\n${closePad}}`;
}

/** Render a value as a Lua table literal expression. */
export function toLua(value: LuaValue, indent = 2): string {
  return serialize(value, indent, 0);
}

/** Render a complete Lua module file: `return <table>`, with a generated-file banner. */
export function toLuaModule(value: LuaValue, sourceName: string): string {
  return `-- Generated from ${sourceName} by @enkerli/codegen — do not edit by hand.\nreturn ${toLua(value)}\n`;
}
