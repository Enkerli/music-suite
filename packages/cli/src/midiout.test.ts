import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { listMidiPorts, resolveMidiPort, noteMessageToMidi, createMidiPlayer, type MidiPort } from "./midiout.js";
import { sendMessage } from "./index.js";

const noteMsg = (over: object = {}) =>
  sendMessage({ to: "vane", note: { notes: [60], velocity: 100, durationMs: 250, ...over } });

describe("noteMessageToMidi", () => {
  it("emits breath (CC2 = velocity) before the note-ons — Vane's envelope contract", () => {
    const evs = noteMessageToMidi(noteMsg({ notes: [60, 64], velocity: 90 }));
    expect(evs[0]).toEqual({ afterMs: 0, bytes: [0xb0, 2, 90] });
    expect(evs[1]).toEqual({ afterMs: 0, bytes: [0x90, 60, 90] });
    expect(evs[2]).toEqual({ afterMs: 0, bytes: [0x90, 64, 90] });
  });
  it("durationMs schedules matching note-offs", () => {
    const evs = noteMessageToMidi(noteMsg({ notes: [60, 64], durationMs: 500 }));
    const offs = evs.filter((e) => e.afterMs === 500);
    expect(offs.map((e) => e.bytes)).toEqual([[0x80, 60, 0], [0x80, 64, 0]]);
  });
  it("gate:'off' is immediate note-offs, no breath", () => {
    const evs = noteMessageToMidi(sendMessage({ to: "vane", note: { notes: [60, 64], gate: "off" } }));
    expect(evs).toEqual([
      { afterMs: 0, bytes: [0x80, 60, 0] },
      { afterMs: 0, bytes: [0x80, 64, 0] },
    ]);
  });
  it("the body's own channel wins over the option; both are 1-based", () => {
    const evs = noteMessageToMidi(noteMsg({ channel: 10 }), { channel: 3 });
    expect(evs[1]!.bytes[0]).toBe(0x90 | 9); // channel 10 → status nibble 9
    const evs2 = noteMessageToMidi(noteMsg(), { channel: 3 });
    expect(evs2[1]!.bytes[0]).toBe(0x90 | 2);
  });
  it("breathCc: null disables the breath stand-in; a custom cc is honored", () => {
    expect(noteMessageToMidi(noteMsg(), { breathCc: null })[0]!.bytes[0]).toBe(0x90);
    expect(noteMessageToMidi(noteMsg(), { breathCc: 11 })[0]!.bytes).toEqual([0xb0, 11, 100]);
  });
  it("non-note messages produce nothing", () => {
    expect(noteMessageToMidi(sendMessage({ to: "serpe", command: { name: "mutate" } }))).toEqual([]);
  });
  it("a breath envelope becomes a timed CC curve (per-note wind articulation)", () => {
    const evs = noteMessageToMidi(noteMsg({
      notes: [46], velocity: 118, durationMs: 400,
      env: [{ at: 0, value: 1 }, { at: 0.15, value: 0.45 }, { at: 1, value: 0.65 }],
    }));
    // The at=0 point replaces the velocity stand-in, still before the note-on.
    expect(evs[0]).toEqual({ afterMs: 0, bytes: [0xb0, 2, 127] });
    expect(evs[3]!.bytes).toEqual([0x90, 46, 118]);
    // The rest of the curve rides the note's life.
    expect(evs[1]).toEqual({ afterMs: 60, bytes: [0xb0, 2, Math.round(0.45 * 127)] });
    expect(evs[2]).toEqual({ afterMs: 400, bytes: [0xb0, 2, Math.round(0.65 * 127)] });
  });
  it("an envelope without durationMs falls back to the velocity stand-in", () => {
    const evs = noteMessageToMidi(noteMsg({ notes: [46], velocity: 90, durationMs: undefined, env: [{ at: 0, value: 1 }] }));
    expect(evs[0]).toEqual({ afterMs: 0, bytes: [0xb0, 2, 90] });
  });
});

describe("createMidiPlayer", () => {
  const harness = () => {
    const written: number[][] = [];
    const timers: Array<{ fn: () => void; ms: number }> = [];
    const player = createMidiPlayer({
      write: (b) => written.push([...b]),
      schedule: (fn, ms) => timers.push({ fn, ms }),
    });
    return { written, timers, player };
  };

  it("writes note-on now, fires the scheduled note-off later, tracks active count", () => {
    const { written, timers, player } = harness();
    expect(player.handleMessage(noteMsg())).toBe(true);
    expect(written).toEqual([[0xb0, 2, 100], [0x90, 60, 100]]);
    expect(player.activeCount()).toBe(1);
    expect(timers[0]!.ms).toBe(250);
    timers[0]!.fn();
    expect(written.at(-1)).toEqual([0x80, 60, 0]);
    expect(player.activeCount()).toBe(0);
  });

  it("overlapping repeats of the same note refcount — the first off doesn't kill the second voice's tracking", () => {
    const { timers, player } = harness();
    player.handleMessage(noteMsg());
    player.handleMessage(noteMsg());
    expect(player.activeCount()).toBe(1); // same key, refcounted
    timers[0]!.fn();
    expect(player.activeCount()).toBe(1); // one voice still sounding
    timers[1]!.fn();
    expect(player.activeCount()).toBe(0);
  });

  it("allOff silences everything sounding and sends CC123 — the Ctrl-C safety", () => {
    const { written, player } = harness();
    player.handleMessage(noteMsg({ notes: [60, 64, 67], durationMs: 60000 }));
    written.length = 0;
    player.allOff();
    expect(written).toContainEqual([0x80, 60, 0]);
    expect(written).toContainEqual([0x80, 64, 0]);
    expect(written).toContainEqual([0x80, 67, 0]);
    expect(written).toContainEqual([0xb0, 123, 0]);
    expect(player.activeCount()).toBe(0);
  });

  it("ignores non-note traffic silently", () => {
    const { written, player } = harness();
    expect(player.handleMessage(sendMessage({ to: "vane", param: { id: "morph", value: 1 } }))).toBe(false);
    expect(written).toEqual([]);
  });
});

describe("port discovery (ALSA rawmidi, fixture roots)", () => {
  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), "midiout-"));
    const dev = join(root, "snd");
    const proc = join(root, "asound");
    mkdirSync(dev, { recursive: true });
    mkdirSync(join(proc, "card1"), { recursive: true });
    mkdirSync(join(proc, "card2"), { recursive: true });
    writeFileSync(join(dev, "midiC1D0"), "");
    writeFileSync(join(dev, "midiC2D0"), "");
    writeFileSync(join(dev, "midiC2D1"), "");
    writeFileSync(join(dev, "controlC1"), ""); // not a midi device — ignored
    writeFileSync(join(proc, "card1", "id"), "USBMIDI\n");
    writeFileSync(join(proc, "card2", "id"), "VirMIDI\n");
    return { devRoot: dev, procRoot: proc };
  };

  it("enumerates midiC*D* with card ids, sorted", () => {
    const ports = listMidiPorts(fixture());
    expect(ports.map((p) => `${p.id}/${p.device}`)).toEqual(["USBMIDI/0", "VirMIDI/0", "VirMIDI/1"]);
  });

  it("resolves: absolute path passthrough, 'virtual' → snd-virmidi, substring by card id", () => {
    const ports = listMidiPorts(fixture());
    expect(resolveMidiPort("/dev/snd/midiC9D0", ports)).toBe("/dev/snd/midiC9D0");
    expect(resolveMidiPort("virtual", ports)).toMatch(/midiC2D0$/);
    expect(resolveMidiPort("usb", ports)).toMatch(/midiC1D0$/);
    expect(() => resolveMidiPort("nope", ports)).toThrow(/no port matches "nope".*USBMIDI/s);
  });

  it("empty machine: friendly modprobe hint", () => {
    expect(() => resolveMidiPort("virtual", [] as MidiPort[])).toThrow(/snd-virmidi/);
  });
});
