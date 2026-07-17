import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PassThrough } from "node:stream";
import { get, request } from "node:http";
import { startBridge, type Bridge } from "./bridge.js";
import { sendMessage, toNdjson } from "./index.js";

/** Open an SSE client and hand back received `data:` payloads as they land. */
function sseClient(port: number) {
  const datas: string[] = [];
  const waiters: Array<(v: string) => void> = [];
  const req = get({ port, path: "/events" }, (res) => {
    let buf = "";
    res.setEncoding("utf8");
    res.on("data", (chunk: string) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf("\n\n")) !== -1) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const data = frame.split("\n").filter((l) => l.startsWith("data: ")).map((l) => l.slice(6)).join("\n");
        if (data) (waiters.shift() ?? ((v) => datas.push(v)))(data);
      }
    });
  });
  return {
    next: () => datas.length ? Promise.resolve(datas.shift()!) : new Promise<string>((res) => waiters.push(res)),
    close: () => req.destroy(),
  };
}

function post(port: number, path: string, body: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = request({ port, path, method: "POST", headers: { "Content-Type": "application/json" } },
      (res) => { res.resume(); resolve(res.statusCode ?? 0); });
    req.on("error", reject);
    req.end(body);
  });
}

function getJson(port: number, path: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    get({ port, path }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (c: string) => { body += c; });
      res.on("end", () => resolve(JSON.parse(body)));
    }).on("error", reject);
  });
}

/** Collects lines written to a PassThrough as an NDJSON output sink. */
function outputLines(stream: PassThrough): { next(): Promise<string> } {
  let buf = "";
  const lines: string[] = [];
  const waiters: Array<(v: string) => void> = [];
  stream.on("data", (chunk: Buffer) => {
    buf += chunk.toString("utf8");
    let i;
    while ((i = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (line) (waiters.shift() ?? ((v) => lines.push(v)))(line);
    }
  });
  return { next: () => (lines.length ? Promise.resolve(lines.shift()!) : new Promise<string>((res) => waiters.push(res))) };
}

describe("startBridge (stdio-NDJSON ↔ SSE, full duplex)", () => {
  let bridge: Bridge;
  const input = new PassThrough();
  const output = new PassThrough();
  const out = outputLines(output);
  beforeAll(async () => {
    bridge = await startBridge({ port: 0, input, output, log: () => {} });
  });
  afterAll(async () => {
    await bridge.close();
  });

  it("reports status at / including the duplex counters", async () => {
    const status = await getJson(bridge.port, "/");
    expect(status).toMatchObject({ bridge: "enkerli-suite", v: 1, clients: 0, received: 0, fromBrowsers: 0 });
  });

  it("fans a POST /send message out to SSE clients AND echoes it to output (full duplex)", async () => {
    const client = sseClient(bridge.port);
    await new Promise((r) => setTimeout(r, 50)); // let the stream open
    const before = bridge.fromBrowsers();
    const msg = sendMessage({ to: "vane", note: { notes: [60, 64, 67], durationMs: 250 } });
    expect(await post(bridge.port, "/send", JSON.stringify(msg))).toBe(204);
    expect(JSON.parse(await client.next())).toEqual(msg);       // → browsers (SSE)
    expect(JSON.parse(await out.next())).toEqual(msg);          // → the shell pipe (stdout)
    expect(bridge.fromBrowsers()).toBe(before + 1);
    client.close();
  });

  it("rejects invalid POST bodies with 400", async () => {
    expect(await post(bridge.port, "/send", "not json")).toBe(400);
    expect(await post(bridge.port, "/send", JSON.stringify({ hello: "world" }))).toBe(400);
  });

  it("relays NDJSON written to its input (the shell pipe) but does NOT echo it back to output", async () => {
    const client = sseClient(bridge.port);
    await new Promise((r) => setTimeout(r, 50));
    const before = bridge.fromBrowsers();
    const msg = sendMessage({ to: "vane", param: { id: "morph", value: 0.5 } });
    input.write(toNdjson(msg));
    expect(JSON.parse(await client.next())).toEqual(msg);
    // A stdin-relayed message must never bounce back onto output — the shell
    // pipeline would receive its own input, an infinite duplex loop.
    expect(bridge.fromBrowsers()).toBe(before);
    client.close();
  });

  it("drops invalid input lines without disturbing the stream", async () => {
    const client = sseClient(bridge.port);
    await new Promise((r) => setTimeout(r, 50));
    input.write("garbage line\n");
    input.write(JSON.stringify({ not: "a message" }) + "\n");
    const msg = sendMessage({ to: "serpe", command: { name: "mutate" } });
    input.write(toNdjson(msg));
    expect(JSON.parse(await client.next())).toEqual(msg); // only the valid one arrives
    client.close();
  });
});
