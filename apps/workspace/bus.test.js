import { describe, it, expect } from "vitest";
import { SuiteBus } from "./bus.js";
import { makeParam, makeCommand } from "@enkerli/protocol";

describe("SuiteBus (the in-page transport)", () => {
  it("delivers a valid message to subscribers", () => {
    const bus = new SuiteBus();
    const seen = [];
    bus.subscribe((m) => seen.push(m));
    const ok = bus.publish(makeParam("external", { id: "morph", value: 0.5 }, { to: "vane" }));
    expect(ok).toBe(true);
    expect(seen).toHaveLength(1);
    expect(seen[0].body.id).toBe("morph");
  });

  it("drops a malformed message (never on the wire)", () => {
    const bus = new SuiteBus();
    const seen = [];
    bus.subscribe((m) => seen.push(m));
    expect(bus.publish({ not: "a message" })).toBe(false);
    expect(seen).toHaveLength(0);
  });

  it("routes by destination: a module only hears its own + broadcast", () => {
    const bus = new SuiteBus();
    const vane = [], serpe = [];
    bus.subscribe((m) => vane.push(m), { to: "vane" });
    bus.subscribe((m) => serpe.push(m), { to: "serpe" });
    bus.publish(makeParam("external", { id: "morph", value: 1 }, { to: "vane" }));
    bus.publish(makeCommand("external", { name: "mutate", args: { amount: 0.3 } }, { to: "serpe" }));
    bus.publish(makeParam("external", { id: "x", value: 1 }, { to: "*" })); // broadcast
    expect(vane).toHaveLength(2);   // its own + broadcast
    expect(serpe).toHaveLength(2);  // its own + broadcast
  });

  it("dedupes by id — a round-tripped message delivers once, not twice", () => {
    const bus = new SuiteBus();
    const seen = [];
    bus.subscribe((m) => seen.push(m));
    const msg = makeParam("external", { id: "morph", value: 0.5 }, { to: "vane" });
    bus.publish(msg);
    bus.publish(msg); // same id — e.g. handed back by a bridge server
    expect(seen).toHaveLength(1);
  });

  it("unsubscribe stops delivery", () => {
    const bus = new SuiteBus();
    const seen = [];
    const off = bus.subscribe((m) => seen.push(m));
    off();
    bus.publish(makeParam("external", { id: "morph", value: 0.5 }, { to: "vane" }));
    expect(seen).toHaveLength(0);
  });
});
