/**
 * The stdio ↔ browser bridge (docs/CONTROL_PLANE.md: "one message model,
 * several transports" — this is the adapter BETWEEN two of them). A tiny
 * localhost HTTP server that fans NDJSON SuiteMessages out to browsers over
 * Server-Sent Events; the workspace's Bridge module republishes them onto the
 * `enkerli-workspace` BroadcastChannel, so a shell pipe reaches every tab:
 *
 *   msuite accompany --play | msuite bridge     (CLI side, shell → browser)
 *   workspace → Bridge module → connect          (browser side)
 *
 * FULL DUPLEX: the same POST /send a browser uses to push a locally-
 * originated bus message (a knob move, a click) back to the bridge is ALSO
 * echoed to the bridge's own stdout as NDJSON — so the process sitting on the
 * OTHER end of the pipe sees it too:
 *
 *   msuite accompany --play | msuite bridge | msuite recv
 *                              ▲               ▲
 *                    plays TO browsers   browser traffic arrives HERE
 *
 * `bridge` consumes stdin (things to send) and produces stdout (things
 * received back) — one process sitting in the middle of a pipe, both
 * directions live at once. (stdin-relayed messages are NOT echoed back to
 * stdout — only genuinely browser/HTTP-originated ones — so a shell pipeline
 * never gets its own input handed back to it.)
 *
 * SSE over node:http, no dependencies. CORS is wide open ON PURPOSE: the
 * bridge binds to localhost and carries validated control-plane messages —
 * the same-origin wall it crosses is the point. POST /send accepts one-shot
 * messages too (curl, Apple Shortcuts, anything that can speak HTTP).
 */
import { createServer, type Server, type ServerResponse } from "node:http";
import { createInterface } from "node:readline";
import { validateMessage, type SuiteMessage } from "@enkerli/protocol";

export interface BridgeOptions {
  /** 0 = ephemeral (tests). Default 8765. */
  port?: number;
  host?: string;
  /** NDJSON source (the pipe). Omit/null for HTTP-only operation. */
  input?: NodeJS.ReadableStream | null;
  /** Where browser/HTTP-originated messages are echoed (full duplex — see
   *  module docstring). Default process.stdout; injectable for tests. */
  output?: NodeJS.WritableStream;
  /** Status/diagnostic lines (default stderr keeps stdout pipe-clean). */
  log?: (line: string) => void;
}

export interface Bridge {
  port: number;
  clients(): number;
  /** Total messages accepted (from stdin OR POST /send). */
  received(): number;
  /** Of those, how many arrived via POST /send (the browser→shell direction). */
  fromBrowsers(): number;
  /** Validate + fan out; false if the message was rejected. */
  broadcast(msg: unknown): boolean;
  close(): Promise<void>;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  // A public HTTPS page (e.g. the GitHub Pages workspace) fetching this
  // localhost server is a "private network" request under Chrome's PNA
  // check — the preflight is rejected unless the server opts in with this
  // header, which otherwise looks like the connection just needing a
  // manual retry after the browser's first (blocked) attempt.
  "Access-Control-Allow-Private-Network": "true",
};

export function startBridge(opts: BridgeOptions = {}): Promise<Bridge> {
  const log = opts.log ?? ((line: string) => process.stderr.write(line + "\n"));
  const output = opts.output ?? process.stdout;
  const clients = new Set<ServerResponse>();
  let received = 0;
  let fromBrowsers = 0;

  const broadcast = (msg: unknown): boolean => {
    if (!validateMessage(msg).ok) return false;
    received++;
    const frame = `data: ${JSON.stringify(msg)}\n\n`;
    for (const res of clients) res.write(frame);
    return true;
  };

  const server: Server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }
    if (req.method === "GET" && url.pathname === "/events") {
      res.writeHead(200, {
        ...CORS,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      });
      res.write(": enkerli-suite bridge\n\n"); // open the stream immediately
      clients.add(res);
      log(`bridge: browser connected (${clients.size} listening)`);
      req.on("close", () => { clients.delete(res); log(`bridge: browser left (${clients.size} listening)`); });
      return;
    }
    if (req.method === "POST" && url.pathname === "/send") {
      let body = "";
      req.on("data", (c) => { body += c; });
      req.on("end", () => {
        let parsed: unknown;
        let ok = false;
        try { parsed = JSON.parse(body); ok = broadcast(parsed); } catch { /* not JSON */ }
        if (ok) {
          // Full duplex: a POST is browser/HTTP-originated by construction
          // (the stdin path calls broadcast() directly, never through here),
          // so it's exactly the traffic the OTHER end of a `| msuite bridge |`
          // pipe wants to see. Echo it — never what stdin just fed in.
          fromBrowsers++;
          output.write(JSON.stringify(parsed) + "\n");
        }
        res.writeHead(ok ? 204 : 400, CORS);
        res.end(ok ? undefined : "not a valid SuiteMessage");
      });
      return;
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
      res.end(JSON.stringify({ bridge: "enkerli-suite", v: 1, clients: clients.size, received, fromBrowsers }));
      return;
    }
    res.writeHead(404, CORS);
    res.end();
  });

  // SSE streams die silently behind some proxies without traffic; heartbeat.
  const heartbeat = setInterval(() => { for (const res of clients) res.write(": ♥\n\n"); }, 25000);
  heartbeat.unref?.();

  if (opts.input) {
    const rl = createInterface({ input: opts.input });
    rl.on("line", (line) => {
      const t = line.trim();
      if (!t) return;
      let parsed: unknown;
      try { parsed = JSON.parse(t); } catch { log(`bridge: skipped a non-JSON line`); return; }
      if (!broadcast(parsed)) log(`bridge: skipped an invalid message`);
    });
    rl.on("close", () => log("bridge: input ended — still serving (Ctrl-C to stop)"));
  }

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(opts.port ?? 8765, opts.host ?? "127.0.0.1", () => {
      const addr = server.address();
      const port = typeof addr === "object" && addr ? addr.port : (opts.port ?? 8765);
      resolve({
        port,
        clients: () => clients.size,
        received: () => received,
        fromBrowsers: () => fromBrowsers,
        broadcast,
        close: () => new Promise<void>((done) => {
          clearInterval(heartbeat);
          for (const res of clients) res.end();
          clients.clear();
          server.close(() => done());
        }),
      });
    });
  });
}

/** Re-exported for the workspace side's symmetry; the browser republishes
 *  exactly what validateMessage admits. */
export type { SuiteMessage };
