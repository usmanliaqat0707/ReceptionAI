# ReceptionAI — SSRF Defense & Security Architecture

## 1. Threat Model
Knowledge ingestion allows business users to input external website URLs for documentation crawling. Without strict controls, malicious actors or compromised accounts could execute Server-Side Request Forgery (SSRF) attacks against:
- Internal microservices and APIs on localhost (`127.0.0.1`, `[::1]`).
- Internal RFC1918 subnets (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Cloud Provider Metadata Services (AWS, GCP, Azure: `169.254.169.254`, `metadata.google.internal`).
- Carrier-Grade NAT (`100.64.0.0/10`).
- Non-HTTP protocols (`file:///etc/passwd`, `ftp://`, `gopher://`).
- DNS Rebinding and HTTP 3xx redirect loops.

---

## 2. Multi-Layer Defenses (`SSRFValidatorService`)

### 2.1 Protocol Whitelisting
Only `http:` and `https:` schemes are permitted. All others are blocked before socket allocation.

### 2.2 Hostname Filter
Explicit rejection of:
- `localhost`
- `*.localhost`
- `*.local`
- `*.internal`
- `metadata.google.internal`

### 2.3 Pre-Request DNS Resolution
Before connecting, the hostname is resolved via `dns.promises.lookup({ all: true })`. Every resolved IPv4 and IPv6 address is verified against restricted subnets:
- Loopback: `127.0.0.0/8`, `::1`
- RFC1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`
- Link-Local & Metadata: `169.254.0.0/16`, `fe80::/10`
- Carrier-Grade NAT: `100.64.0.0/10`
- IPv6 Unique Local: `fc00::/7`
- IPv4-mapped IPv6: `::ffff:0:0/96`

### 2.4 Redirect Validation
HTTP redirects (`301`, `302`, `307`, `308`) are NOT blindly followed.
`WebsiteCrawlerService` re-validates each redirect target URL through `SSRFValidatorService` and limits max redirect depth to 5.
