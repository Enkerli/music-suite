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

describe("startBridge (stdio-NDJSON → SSE)", () => {
  let bridge: Bridge;
  const input = new PassThrough();
  beforeAll(async () => {
    bridge = await startBridge({ port: 0, input, log: () => {} });
  });
  afterAll(async () => {
    await bridge.close();
  });

  it("reports status at /", async () => {
    const status = await getJson(bridge.port, "/");
    expect(status).toMatchObject({ bridge: "enkerli-suite", v: 1 });
  });

  it("fans a POST /send message out to SSE clients", async () => {
    const client = sseClient(bridge.port);
    await new Promise((r) => setTimeout(r, 50)); // let the stream open
    const msg = sendMessage({ to: "vane", note: { notes: [60, 64, 67], durationMs: 250 } });
    expect(await post(bridge.port, "/send", JSON.stringify(msg))).toBe(204);
    expect(JSON.parse(await client.next())).toEqual(msg);
    client.close();
  });

  it("rejects invalid POST bodies with 400", async () => {
    expect(await post(bridge.port, "/send", "not json")).toBe(400);
    expect(await post(bridge.port, "/send", JSON.stringify({ hello: "world" }))).toBe(400);
  });

  it("relays NDJSON written to its input (the shell pipe)", async () => {
    const client = sseClient(bridge.port);
    await new Promise((r) => setTimeout(r, 50));
    const msg = sendMessage({ to: "vane", param: { id: "morph", value: 0.5 } });
    input.write(toNdjson(msg));
    expect(JSON.parse(await client.next())).toEqual(msg);
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
