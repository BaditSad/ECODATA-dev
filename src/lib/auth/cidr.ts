/**
 * Edge-safe IP / CIDR matching.
 *
 * No Node `net` module — this runs in middleware. IPv4-mapped IPv6
 * (`::ffff:192.0.2.1`) is normalised to IPv4 so a hotel that registered a
 * v4 prefix still matches guests the edge saw as mapped v6.
 */

const IPV4_RE =
  /^(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/;

export function normalizeIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();
  if (!value || value === "unknown") return null;

  if (value === "::1") return "127.0.0.1";

  if (value.startsWith("::ffff:")) {
    const mapped = value.slice("::ffff:".length);
    if (IPV4_RE.test(mapped)) return mapped;
  }

  if (IPV4_RE.test(value)) return value;

  const v6 = expandIPv6(value);
  return v6 ? compactIPv6(v6) : null;
}

export function isValidCidr(value: string): boolean {
  return parseCidr(value) !== null;
}

/**
 * Suggest a prefix to register for the address the server actually sees.
 *
 * Private IPv4 is stored as /24 so DHCP guests on the same LAN match.
 * Public IPv4 (hotel NAT) is /32 — that single egress address *is* the Wi-Fi.
 */
export function suggestCidr(ip: string): string | null {
  const normalised = normalizeIp(ip);
  if (!normalised) return null;
  if (IPV4_RE.test(normalised)) {
    if (isPrivateIPv4(normalised)) {
      const parts = normalised.split(".");
      return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
    }
    return `${normalised}/32`;
  }
  return `${normalised}/64`;
}

export function ipInCidr(ip: string, cidr: string): boolean {
  const parsed = parseCidr(cidr);
  const normalised = normalizeIp(ip);
  if (!parsed || !normalised) return false;

  if (parsed.version === 4) {
    if (!IPV4_RE.test(normalised)) return false;
    const mask =
      parsed.prefix === 0 ? 0 : (0xffff_ffff << (32 - parsed.prefix)) >>> 0;
    return (ipv4ToInt(normalised) & mask) === (parsed.networkInt & mask);
  }

  const expanded = expandIPv6(normalised);
  if (!expanded) return false;
  const prefixBits = parsed.prefix;
  const ipBits = ipv6ToBits(expanded);
  const netBits = ipv6ToBits(parsed.networkGroups);
  return ipBits.slice(0, prefixBits) === netBits.slice(0, prefixBits);
}

export function ipInAnyCidr(ip: string, cidrs: readonly string[] | null | undefined): boolean {
  if (!cidrs || cidrs.length === 0) return false;
  return cidrs.some((cidr) => ipInCidr(ip, cidr));
}

/**
 * Parse a manager-typed list (comma, space or newline separated).
 * Empty input is valid and means "no on-network admission".
 */
export function parseCidrList(
  raw: string
): { cidrs: string[] } | { error: string } {
  const tokens = raw
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean);

  const cidrs: string[] = [];
  for (const token of tokens) {
    const parsed = parseCidr(token);
    if (!parsed) {
      return {
        error: `"${token}" is not a usable prefix. IPv4 must be /8–/32 (not 0.0.0.0); IPv6 /32–/128.`,
      };
    }
    if (!cidrs.includes(parsed.canonical)) cidrs.push(parsed.canonical);
  }
  return { cidrs };
}

export function parseCidr(
  value: string
):
  | { version: 4; prefix: number; networkInt: number; canonical: string }
  | { version: 6; prefix: number; networkGroups: number[]; canonical: string }
  | null {
  const trimmed = value.trim().toLowerCase();
  const slash = trimmed.lastIndexOf("/");
  if (slash <= 0) return null;

  const address = trimmed.slice(0, slash);
  const prefixRaw = Number(trimmed.slice(slash + 1));
  if (!Number.isInteger(prefixRaw)) return null;

  if (IPV4_RE.test(address)) {
    if (prefixRaw < 8 || prefixRaw > 32) return null;
    if (address === "0.0.0.0") return null;
    const networkInt =
      ipv4ToInt(address) &
      (prefixRaw === 0 ? 0 : (0xffff_ffff << (32 - prefixRaw)) >>> 0);
    const canonical = `${intToIPv4(networkInt)}/${prefixRaw}`;
    return { version: 4, prefix: prefixRaw, networkInt, canonical };
  }

  const groups = expandIPv6(address);
  if (!groups) return null;
  if (prefixRaw < 32 || prefixRaw > 128) return null;
  const masked = maskIPv6(groups, prefixRaw);
  return {
    version: 6,
    prefix: prefixRaw,
    networkGroups: masked,
    canonical: `${compactIPv6(masked)}/${prefixRaw}`,
  };
}

function ipv4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function intToIPv4(value: number): string {
  return [
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255,
  ].join(".");
}

function isPrivateIPv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return (
    (n >>> 24) === 10 ||
    (n >>> 24) === 127 ||
    ((n >>> 24) === 172 && ((n >>> 16) & 0xff) >= 16 && ((n >>> 16) & 0xff) <= 31) ||
    ((n >>> 24) === 192 && ((n >>> 16) & 0xff) === 168)
  );
}

function expandIPv6(ip: string): number[] | null {
  if (ip.includes(".")) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;

  const parseSide = (side: string | undefined): number[] | null => {
    if (!side) return [];
    const parts = side.split(":");
    const out: number[] = [];
    for (const part of parts) {
      if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
      out.push(parseInt(part, 16));
    }
    return out;
  };

  if (halves.length === 1) {
    const groups = parseSide(halves[0]);
    return groups && groups.length === 8 ? groups : null;
  }

  const head = parseSide(halves[0]);
  const tail = parseSide(halves[1]);
  if (!head || !tail) return null;
  const missing = 8 - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...Array.from({ length: missing }, () => 0), ...tail];
}

function compactIPv6(groups: number[]): string {
  return groups.map((group) => group.toString(16)).join(":");
}

function maskIPv6(groups: number[], prefix: number): number[] {
  return groups.map((group, index) => {
    const start = index * 16;
    if (prefix <= start) return 0;
    if (prefix >= start + 16) return group;
    const keep = prefix - start;
    const mask = (0xffff << (16 - keep)) & 0xffff;
    return group & mask;
  });
}

function ipv6ToBits(groups: number[]): string {
  return groups.map((group) => group.toString(2).padStart(16, "0")).join("");
}
