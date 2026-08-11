/**
 * Captured seeds as suite library items.
 *
 * A seed is four bytes, but a *captured* seed is more: what the hardware said
 * it sounded like at the moment it was heard, whether it was worth keeping, and
 * where it came from. That is exactly the shape the suite envelope carries
 * (LIBRARY_SPEC.md), so seeds are `kind: "patch"` items rather than a private
 * JSON format — searchable by scale, tempo or engine alongside everything else.
 *
 * The payload is the RND-specific part, carried verbatim as the spec intends:
 * adoption means wrapping, not migrating.
 *
 * The C++ side (rnd-companion, Source/App/SeedLibrary.cpp) writes the same
 * envelope, so a library exported from the plugin opens here and vice versa.
 */
import {
  newId,
  nowIso,
  type LibraryItem,
} from "@enkerli/library";

import { formatSeed, parseSeed, rootName, scaleName, type DeviceStatus } from "./index.js";

export const SEED_FORMAT = "rnd-seed";
export const SEED_FORMAT_VERSION = 1;

export type Rating = "unrated" | "keep" | "pass";

/** The RND-specific payload inside the envelope. */
export interface SeedPayload {
  /** Canonical hex, e.g. "0xaa442ce7". The number is in facets. */
  seed: string;
  rating: Rating;
  note?: string;
  /**
   * What the device reported while this seed was playing. Absent when the seed
   * was captured without a full dump — a sparser entry, still a valid one.
   */
  captured?: {
    patchMode: number;
    tempoBpm: number;
    /** The root the device was playing *then*; it moves while a patch runs. */
    rootWhenCaptured: number;
    scaleIndex: number;
    engines: string[];
  };
}

export interface SeedItemInput {
  seed: number;
  rating?: Rating;
  note?: string;
  status?: DeviceStatus;
  /** Overrides for round-tripping an existing item. */
  id?: string;
  savedAt?: string;
  generatorVersion?: string;
}

/**
 * Facets are what makes a library searchable, so everything worth filtering on
 * goes here as a scalar — including the human-readable scale and root names,
 * because a person searching for "dorian" should not have to know it is 6.
 */
function facetsFor(seed: number, rating: Rating, status?: DeviceStatus): Record<string, string | number | boolean> {
  const facets: Record<string, string | number | boolean> = {
    seedValue: seed >>> 0,
    rating,
    hasStatus: Boolean(status && status.tempoBpm !== undefined),
  };

  if (status?.tempoBpm !== undefined) facets.tempoBpm = status.tempoBpm;
  if (status?.patchMode !== undefined) facets.patchMode = status.patchMode;

  if (status?.scaleIndex !== undefined) {
    facets.scaleIndex = status.scaleIndex;
    facets.scale = scaleName(status.scaleIndex);
  }

  if (status?.root !== undefined) {
    facets.rootWhenCaptured = status.root;
    facets.rootName = rootName(status.root);
  }

  if (status?.engines.length) {
    facets.trackCount = status.engines.length;
    facets.engines = status.engines.map((e) => e.name).join(", ");
  }

  return facets;
}

export function seedToLibraryItem(input: SeedItemInput): LibraryItem {
  const rating: Rating = input.rating ?? "unrated";
  const hex = formatSeed(input.seed);
  const status = input.status;
  const complete = Boolean(status && status.tempoBpm !== undefined);

  const payload: SeedPayload = { seed: hex, rating };
  if (input.note) payload.note = input.note;

  if (complete && status) {
    payload.captured = {
      patchMode: status.patchMode ?? 0,
      tempoBpm: status.tempoBpm ?? 0,
      rootWhenCaptured: status.root ?? 0,
      scaleIndex: status.scaleIndex ?? 0,
      engines: status.engines.map((e) => e.name),
    };
  }

  const item: LibraryItem = {
    envelope: "enkerli-library-item",
    envelopeVersion: 1,
    id: input.id ?? newId(),
    kind: "patch",
    format: SEED_FORMAT,
    formatVersion: SEED_FORMAT_VERSION,
    // The title is the seed: it is the identity a person recognises, and
    // LIBRARY_SPEC forbids deriving `id` from it, not the other way round.
    title: hex,
    app: "rnd-companion",
    savedAt: input.savedAt ?? nowIso(),
    provenance: {
      generator: { app: "rnd-companion", ...(input.generatorVersion ? { version: input.generatorVersion } : {}) },
      // Captured from hardware the user owns; the suite's default for user
      // material, and this project ships under the Unlicense.
      license: "Unlicense",
    },
    facets: facetsFor(input.seed, rating, complete ? status : undefined),
    payload: payload as unknown as Record<string, unknown>,
  };

  const tags = [rating, ...(complete && status?.scaleIndex !== undefined ? [scaleName(status.scaleIndex)] : [])];
  item.tags = tags;

  return item;
}

/** Reads a seed item back. Returns null when it is not one of ours. */
export function libraryItemToSeed(item: LibraryItem): (SeedItemInput & { rating: Rating }) | null {
  if (item.format !== SEED_FORMAT) return null;

  const payload = item.payload as unknown as SeedPayload | undefined;
  if (!payload) return null;

  const seed = parseSeed(payload.seed);
  if (seed === null) return null;

  const captured = payload.captured;

  return {
    seed,
    rating: payload.rating ?? "unrated",
    ...(payload.note ? { note: payload.note } : {}),
    ...(captured
      ? {
          status: {
            patchMode: captured.patchMode,
            tempoBpm: captured.tempoBpm,
            root: captured.rootWhenCaptured,
            scaleIndex: captured.scaleIndex,
            engines: captured.engines.map((name, index) => ({ index, name })),
          } satisfies DeviceStatus,
        }
      : {}),
    id: item.id,
    savedAt: item.savedAt,
  };
}
