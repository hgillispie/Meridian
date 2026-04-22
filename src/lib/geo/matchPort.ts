import type { PortRecord } from '@/hooks/usePorts';

/**
 * AIS `Destination` fields are chaotic free-form text entered by ship crews.
 * Examples from real traffic: "SGSIN", "SG SIN", "SINGAPORE", ">SGSIN",
 * "ROTTERDAM >CNSHA", "PIRAEUS", "HAMBURG DE", "US LAX".
 *
 * Strategy: normalize the string, then try in order —
 *   1. Exact UN/LOCODE match (5-char) anywhere in the text
 *   2. Exact port-name match (case/space-insensitive)
 *   3. Word-substring match of the full port name
 *
 * Returns the best-match port or null. False positives are preferable to
 * false negatives here — a wrong destination draws a wrong lane, which is
 * easier to notice than a missing lane.
 */

function normalize(s: string): string {
  return s
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Index key = normalized alphanumeric form of the port name/country for fast
// lookup. Built lazily the first time matchPortFromDestination is called
// with a ports list so we don't pay the cost unless routes are rendered.
let indexedPorts: PortRecord[] | null = null;
let nameIndex: Map<string, PortRecord> | null = null;
let codeIndex: Map<string, PortRecord> | null = null;

function ensureIndex(ports: PortRecord[]) {
  if (indexedPorts === ports && nameIndex && codeIndex) return;
  nameIndex = new Map();
  codeIndex = new Map();
  for (const p of ports) {
    codeIndex.set(p.unlocode.toUpperCase(), p);
    nameIndex.set(normalize(p.name), p);
    // AIS sometimes drops the country suffix ("ROTTERDAM NL") so also
    // index the base name without parenthetical qualifiers.
    const base = normalize(p.name.replace(/\(.+?\)/g, ''));
    if (base) nameIndex.set(base, p);
  }
  indexedPorts = ports;
}

export function matchPortFromDestination(
  destination: string | undefined,
  ports: PortRecord[]
): PortRecord | null {
  if (!destination) return null;
  if (!ports.length) return null;
  ensureIndex(ports);
  const norm = normalize(destination);
  if (!norm) return null;

  // 1. UN/LOCODE — look for any 5-letter token matching an indexed code.
  const tokens = norm.split(' ');
  // Also try concatenations: "SG SIN" → "SGSIN".
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.length === 5 && codeIndex!.has(t)) return codeIndex!.get(t)!;
    if (i + 1 < tokens.length) {
      const joined = t + tokens[i + 1];
      if (joined.length === 5 && codeIndex!.has(joined))
        return codeIndex!.get(joined)!;
    }
  }

  // 2. Exact normalized name match.
  if (nameIndex!.has(norm)) return nameIndex!.get(norm)!;

  // 3. Full-name substring — e.g. "ROTTERDAM >CNSHA" contains "ROTTERDAM".
  for (const [name, port] of nameIndex!) {
    if (name.length >= 4 && norm.includes(name)) return port;
  }

  return null;
}
