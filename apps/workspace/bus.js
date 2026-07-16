/**
 * SuiteBus — the workspace's in-page transport for the control & interop plane
 * (docs/CONTROL_PLANE.md §1: "one message model, several transports"). The
 * third transport, after SysEx (MIDI) and stdio-NDJSON (headless pipes): here
 * the carrier is an in-page pub/sub, optionally bridged to a BroadcastChannel
 * so separate browser tabs/windows are separate modules on the same bus.
 *
 * Same message model throughout: it carries @enkerli/protocol SuiteMessages and
 * honors their `to`/`from` routing (`*` = broadcast). Invalid messages are
 * dropped (never put a malformed message on the wire — the encodeMessage rule,
 * applied to this transport too).
 */
import { validateMessage } from "@enkerli/protocol";

export class SuiteBus extends EventTarget {
  /** @param {{channelName?: string}} [opts] cross-tab BroadcastChannel name. */
  constructor(opts = {}) {
    super();
    this.channel = null;
    if (opts.channelName && typeof BroadcastChannel !== "undefined") {
      this.channel = new BroadcastChannel(opts.channelName);
      this.channel.onmessage = (e) => this._deliver(e.data, true);
    }
  }

  /**
   * Put a message on the bus. Validated first; returns true if delivered,
   * false if it was rejected as malformed. Bridged to other tabs when a
   * channel is configured.
   */
  publish(msg) {
    if (!validateMessage(msg).ok) return false;
    this._deliver(msg, false);
    if (this.channel) this.channel.postMessage(msg);
    return true;
  }

  _deliver(msg, remote) {
    this.dispatchEvent(new CustomEvent("suitemessage", { detail: { msg, remote } }));
  }

  /**
   * Subscribe to messages. With `to`, only messages addressed to that app id
   * (or broadcast `*`) are delivered — the routing a module wants. Returns an
   * unsubscribe function.
   * @param {(msg: any, meta: {remote: boolean}) => void} handler
   * @param {{to?: string}} [opts]
   */
  subscribe(handler, opts = {}) {
    const fn = (e) => {
      const { msg, remote } = e.detail;
      if (!opts.to || msg.to === "*" || msg.to === opts.to) handler(msg, { remote });
    };
    this.addEventListener("suitemessage", fn);
    return () => this.removeEventListener("suitemessage", fn);
  }

  close() { if (this.channel) this.channel.close(); }
}
