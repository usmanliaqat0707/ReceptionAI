import { URL } from "url";
import * as cheerio from "cheerio";
import { ssrfValidator } from "./ssrf-validator.service";
import { htmlExtractor } from "../extractors/html.extractor";
import { ExtractedDocument } from "../extractors/text.extractor";
import {
  CRAWL_RESPONSE_TIMEOUT_MS,
  MAX_CRAWL_DEPTH,
  MAX_CRAWL_PAGES,
  MAX_FILE_SIZE_BYTES,
} from "@receptionai/config";

export interface CrawlOptions {
  maxPages?: number;
  maxDepth?: number;
  includePatterns?: string[];
  excludePatterns?: string[];
  sameOriginOnly?: boolean;
}

export interface CrawledPage {
  url: string;
  document: ExtractedDocument;
  httpStatus: number;
}

export class WebsiteCrawlerService {
  /**
   * Normalizes a URL by stripping fragments and trailing slashes.
   */
  normalizeUrl(urlString: string): string {
    try {
      const parsed = new URL(urlString);
      parsed.hash = "";
      let path = parsed.pathname;
      if (path.length > 1 && path.endsWith("/")) {
        path = path.slice(0, -1);
      }
      parsed.pathname = path;
      return parsed.toString();
    } catch {
      return urlString;
    }
  }

  /**
   * Crawls an authorized public website within strict security and resource bounds.
   */
  async crawlWebsite(rootUrlString: string, options?: CrawlOptions): Promise<CrawledPage[]> {
    const normalizedRoot = this.normalizeUrl(rootUrlString);

    // Initial SSRF check on root URL
    const ssrfCheck = await ssrfValidator.validateUrl(normalizedRoot);
    if (!ssrfCheck.allowed) {
      throw new Error(ssrfCheck.reason || "KNOWLEDGE_SSRF_BLOCKED: Root URL rejected.");
    }

    const maxPages = Math.min(options?.maxPages || MAX_CRAWL_PAGES, MAX_CRAWL_PAGES);
    const maxDepth = Math.min(options?.maxDepth || MAX_CRAWL_DEPTH, MAX_CRAWL_DEPTH);
    const sameOriginOnly = options?.sameOriginOnly !== false;

    const rootOrigin = new URL(normalizedRoot).origin;
    const visited = new Set<string>();
    const queue: Array<{ url: string; depth: number }> = [{ url: normalizedRoot, depth: 0 }];
    const pages: CrawledPage[] = [];

    while (queue.length > 0 && pages.length < maxPages) {
      const current = queue.shift()!;
      const currentUrl = this.normalizeUrl(current.url);

      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);

      // Re-validate SSRF for this specific URL
      const currentCheck = await ssrfValidator.validateUrl(currentUrl);
      if (!currentCheck.allowed) {
        continue;
      }

      try {
        const fetchRes = await this.safeFetch(currentUrl);
        if (!fetchRes) continue;

        const { text, status, contentType, finalUrl } = fetchRes;
        visited.add(this.normalizeUrl(finalUrl));

        if (status >= 200 && status < 300 && text) {
          try {
            const document = htmlExtractor.extract(text, finalUrl);
            pages.push({
              url: finalUrl,
              document,
              httpStatus: status,
            });
          } catch (extractErr) {
            // Failed extraction on a single page shouldn't kill entire crawl
            console.warn(`Extraction failed on page ${finalUrl}:`, extractErr);
          }

          // Discover links if within depth limit
          if (current.depth < maxDepth && contentType.includes("text/html")) {
            const $ = cheerio.load(text);
            $("a[href]").each((_, el) => {
              const href = $(el).attr("href");
              if (!href) return;

              try {
                const resolved = new URL(href, finalUrl);
                // Scheme check
                if (resolved.protocol !== "http:" && resolved.protocol !== "https:") return;

                // Same origin constraint
                if (sameOriginOnly && resolved.origin !== rootOrigin) return;

                // Extension check (skip media/binaries)
                const pathLower = resolved.pathname.toLowerCase();
                if (pathLower.match(/\.(pdf|jpg|jpeg|png|gif|svg|zip|tar|gz|mp3|mp4|exe|css|js)$/)) {
                  return;
                }

                const normResolved = this.normalizeUrl(resolved.toString());
                if (!visited.has(normResolved) && !queue.some((q) => q.url === normResolved)) {
                  queue.push({ url: normResolved, depth: current.depth + 1 });
                }
              } catch {
                // Ignore malformed links
              }
            });
          }

          // If no links discovered so far (common with CSR/Next.js/React apps), check XML sitemap
          if (queue.length === 0 && pages.length < maxPages) {
            try {
              const sitemapUrls = await this.discoverSitemapUrls(rootOrigin);
              for (const sUrl of sitemapUrls) {
                const norm = this.normalizeUrl(sUrl);
                if (!visited.has(norm) && !queue.some((q) => q.url === norm)) {
                  queue.push({ url: norm, depth: 1 });
                }
              }
            } catch {
              // Ignore sitemap discovery failures
            }
          }
        }
      } catch (pageErr) {
        console.warn(`Crawl error on ${currentUrl}:`, pageErr);
      }
    }

    if (pages.length === 0) {
      throw new Error("KNOWLEDGE_FETCH_FAILED: No readable pages could be fetched from the website.");
    }

    return pages;
  }

  /**
   * Attempts to discover page URLs from standard sitemap locations
   * (e.g. /sitemap.xml, /sitemap_index.xml). Highly effective for modern CSR / Next.js sites.
   */
  async discoverSitemapUrls(rootOrigin: string): Promise<string[]> {
    const candidateEndpoints = [
      `${rootOrigin}/sitemap.xml`,
      `${rootOrigin}/sitemap_index.xml`,
    ];
    const discoveredUrls = new Set<string>();

    for (const endpoint of candidateEndpoints) {
      try {
        const res = await this.safeFetch(endpoint);
        if (!res || !res.text || res.status < 200 || res.status >= 300) continue;

        const locRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
        let match;
        const subSitemaps: string[] = [];

        while ((match = locRegex.exec(res.text)) !== null) {
          const loc = match[1].trim();
          if (loc.endsWith(".xml")) {
            subSitemaps.push(loc);
          } else {
            try {
              const parsed = new URL(loc);
              if (parsed.origin === rootOrigin) {
                discoveredUrls.add(loc);
              }
            } catch {}
          }
        }

        // Follow sub-sitemaps (e.g. sitemap-pages.xml)
        for (const subSitemap of subSitemaps.slice(0, 5)) {
          try {
            const subRes = await this.safeFetch(subSitemap);
            if (!subRes || !subRes.text) continue;
            let subMatch;
            const subLocRegex = /<loc>(https?:\/\/[^<]+)<\/loc>/gi;
            while ((subMatch = subLocRegex.exec(subRes.text)) !== null) {
              const subLoc = subMatch[1].trim();
              if (!subLoc.endsWith(".xml")) {
                try {
                  const parsed = new URL(subLoc);
                  if (parsed.origin === rootOrigin) {
                    discoveredUrls.add(subLoc);
                  }
                } catch {}
              }
            }
          } catch {}
        }

        if (discoveredUrls.size > 0) break;
      } catch {
        // Continue to next candidate endpoint
      }
    }

    return Array.from(discoveredUrls);
  }

  /**
   * Performs an SSRF-safe HTTP GET request with redirect re-validation,
   * timeouts, and response size guards.
   */
  private async safeFetch(
    urlString: string,
    redirectCount = 0
  ): Promise<{ text: string; status: number; contentType: string; finalUrl: string } | null> {
    if (redirectCount > 4) {
      throw new Error("KNOWLEDGE_FETCH_FAILED: Exceeded maximum allowed redirects.");
    }

    // SSRF check on target URL
    const check = await ssrfValidator.validateUrl(urlString);
    if (!check.allowed) {
      throw new Error(check.reason || "KNOWLEDGE_SSRF_BLOCKED: Redirect target blocked.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CRAWL_RESPONSE_TIMEOUT_MS);

    try {
      const response = await fetch(urlString, {
        method: "GET",
        headers: {
          "User-Agent": "ReceptionAI-Bot/1.0 (+https://receptionai.com/bot)",
          Accept: "text/html,application/xhtml+xml,text/xml,application/xml,text/plain;q=0.9",
        },
        redirect: "manual", // Handle redirects manually to re-run SSRF validation on every hop
        signal: controller.signal,
      });

      // Handle HTTP redirects (301, 302, 303, 307, 308)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) return null;
        const redirectUrl = new URL(location, urlString).toString();
        return this.safeFetch(redirectUrl, redirectCount + 1);
      }

      const contentType = response.headers.get("content-type") || "";
      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain") &&
        !contentType.includes("application/xhtml+xml") &&
        !contentType.includes("xml")
      ) {
        return null; // Skip non-text content
      }

      // Read response with bounded size guard
      const reader = response.body?.getReader();
      if (!reader) return null;

      const chunks: Uint8Array[] = [];
      let totalBytes = 0;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.length;
          if (totalBytes > MAX_FILE_SIZE_BYTES) {
            reader.cancel();
            throw new Error("KNOWLEDGE_FETCH_FAILED: Response body exceeded maximum allowed size (5MB).");
          }
          chunks.push(value);
        }
      }

      const fullBuffer = Buffer.concat(chunks);
      const text = fullBuffer.toString("utf-8");

      return {
        text,
        status: response.status,
        contentType,
        finalUrl: urlString,
      };
    } catch (fetchErr: any) {
      if (redirectCount === 0) {
        try {
          const parsed = new URL(urlString);
          if (!parsed.hostname.startsWith("www.")) {
            parsed.hostname = `www.${parsed.hostname}`;
            return await this.safeFetch(parsed.toString(), redirectCount + 1);
          }
        } catch {
          // ignore
        }
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const websiteCrawler = new WebsiteCrawlerService();
