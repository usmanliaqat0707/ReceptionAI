import { describe, it, expect } from "vitest";
import { ssrfValidator } from "../src/modules/knowledge/services/ssrf-validator.service";

describe("Phase 5 SSRF Validator Service Security Tests", () => {
  it("rejects loopback IPv4 addresses (127.0.0.1)", async () => {
    const res = await ssrfValidator.validateUrl("http://127.0.0.1:8080/admin");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("KNOWLEDGE_SSRF_BLOCKED");
  });

  it("rejects localhost hostname", async () => {
    const res = await ssrfValidator.validateUrl("http://localhost:3000/internal");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("internal domain");
  });

  it("rejects RFC1918 Class A private addresses (10.0.0.0/8)", async () => {
    const res = await ssrfValidator.validateUrl("http://10.0.0.1/status");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("KNOWLEDGE_SSRF_BLOCKED");
  });

  it("rejects RFC1918 Class B private addresses (172.16.0.0/12)", async () => {
    const res = await ssrfValidator.validateUrl("http://172.16.0.5/api");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("KNOWLEDGE_SSRF_BLOCKED");
  });

  it("rejects RFC1918 Class C private addresses (192.168.0.0/16)", async () => {
    const res = await ssrfValidator.validateUrl("http://192.168.1.1/router");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("KNOWLEDGE_SSRF_BLOCKED");
  });

  it("rejects AWS / Cloud Metadata endpoint (169.254.169.254)", async () => {
    const res = await ssrfValidator.validateUrl("http://169.254.169.254/latest/meta-data/");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("KNOWLEDGE_SSRF_BLOCKED");
  });

  it("rejects Carrier-Grade NAT addresses (100.64.0.0/10)", async () => {
    const res = await ssrfValidator.validateUrl("http://100.64.1.1/metadata");
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("KNOWLEDGE_SSRF_BLOCKED");
  });

  it("rejects non-HTTP protocols (ftp, file, gopher)", async () => {
    const resFile = await ssrfValidator.validateUrl("file:///etc/passwd");
    expect(resFile.allowed).toBe(false);
    expect(resFile.reason).toContain("Disallowed protocol");

    const resFtp = await ssrfValidator.validateUrl("ftp://ftp.example.com/files");
    expect(resFtp.allowed).toBe(false);
    expect(resFtp.reason).toContain("Disallowed protocol");

    const resGopher = await ssrfValidator.validateUrl("gopher://gopher.floodgap.com");
    expect(resGopher.allowed).toBe(false);
    expect(resGopher.reason).toContain("Disallowed protocol");
  });

  it("accepts legitimate public domains (example.com)", async () => {
    const res = await ssrfValidator.validateUrl("https://example.com/about");
    expect(res.allowed).toBe(true);
    expect(res.resolvedIp).toBeDefined();
  });
});
