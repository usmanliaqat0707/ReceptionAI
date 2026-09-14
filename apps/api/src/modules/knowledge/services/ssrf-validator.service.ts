import dns from "dns";
import { URL } from "url";

export interface SSRFValidationResult {
  allowed: boolean;
  reason?: string;
  resolvedIp?: string;
}

/**
 * Enterprise-grade multi-layer SSRF Validator.
 * Defends against localhost, RFC1918 private subnets, cloud metadata (169.254.169.254),
 * IPv6 loopbacks, carrier-grade NAT, and DNS rebinding attacks.
 */
export class SSRFValidatorService {
  /**
   * Validates a URL against strict SSRF defense policies.
   */
  async validateUrl(urlString: string): Promise<SSRFValidationResult> {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(urlString);
    } catch {
      return { allowed: false, reason: "KNOWLEDGE_SOURCE_INVALID_URL: Invalid URL format" };
    }

    // 1. Protocol / Scheme validation: Only http and https
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return {
        allowed: false,
        reason: `KNOWLEDGE_SSRF_BLOCKED: Disallowed protocol '${parsedUrl.protocol}'. Only http and https are permitted.`,
      };
    }

    const hostname = parsedUrl.hostname.toLowerCase().trim();

    // 2. Reject explicit local/internal names
    if (
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      hostname === "metadata.google.internal"
    ) {
      return {
        allowed: false,
        reason: `KNOWLEDGE_SSRF_BLOCKED: Hostname '${hostname}' is an internal domain.`,
      };
    }

    // 3. DNS resolution & IP range inspection
    try {
      const records = await dns.promises.lookup(hostname, { all: true });
      if (!records || records.length === 0) {
        return { allowed: false, reason: "KNOWLEDGE_FETCH_FAILED: DNS resolution returned no addresses." };
      }

      for (const record of records) {
        const ip = record.address;
        if (this.isPrivateOrRestrictedIp(ip)) {
          return {
            allowed: false,
            reason: `KNOWLEDGE_SSRF_BLOCKED: Hostname '${hostname}' resolved to restricted IP address '${ip}'.`,
            resolvedIp: ip,
          };
        }
      }

      return { allowed: true, resolvedIp: records[0].address };
    } catch (err: any) {
      return {
        allowed: false,
        reason: `KNOWLEDGE_FETCH_FAILED: DNS lookup failed for host '${hostname}': ${err.message}`,
      };
    }
  }

  /**
   * Checks if an IPv4 or IPv6 address belongs to private/internal/reserved ranges.
   */
  isPrivateOrRestrictedIp(ip: string): boolean {
    // IPv6 checks
    if (ip.includes(":")) {
      const normalized = ip.toLowerCase();
      // Loopback
      if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
      // Unspecified
      if (normalized === "::" || normalized === "0:0:0:0:0:0:0:0") return true;
      // Link-local (fe80::/10)
      if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
        return true;
      }
      // Unique Local Addresses (fc00::/7)
      if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
      // IPv4-mapped IPv6 (::ffff:127.0.0.1)
      if (normalized.includes("::ffff:")) {
        const ipv4Part = normalized.split("::ffff:")[1];
        if (ipv4Part && this.isPrivateOrRestrictedIp(ipv4Part)) return true;
      }
      return false;
    }

    // IPv4 checks
    const parts = ip.split(".").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true; // Malformed = restrict

    const [a, b, c] = parts;

    // 0.0.0.0/8 (Current network)
    if (a === 0) return true;

    // 127.0.0.0/8 (Loopback)
    if (a === 127) return true;

    // 10.0.0.0/8 (Private RFC1918)
    if (a === 10) return true;

    // 172.16.0.0/12 (Private RFC1918: 172.16.0.0 - 172.31.255.255)
    if (a === 172 && b >= 16 && b <= 31) return true;

    // 192.168.0.0/16 (Private RFC1918)
    if (a === 192 && b === 168) return true;

    // 169.254.0.0/16 (Link-Local & Cloud Metadata e.g. 169.254.169.254)
    if (a === 169 && b === 254) return true;

    // 100.64.0.0/10 (Carrier-grade NAT)
    if (a === 100 && b >= 64 && b <= 127) return true;

    // 192.0.0.0/24 (IETF Protocol Assignments)
    if (a === 192 && b === 0 && c === 0) return true;

    // 198.18.0.0/15 (Benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true;

    // 224.0.0.0/4 (Multicast)
    if (a >= 224 && a <= 239) return true;

    // 240.0.0.0/4 (Reserved / Broadcast)
    if (a >= 240) return true;

    return false;
  }
}

export const ssrfValidator = new SSRFValidatorService();
