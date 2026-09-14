import crypto from "crypto";
import { encryptText, decryptText } from "@receptionai/security";

export interface GoogleOAuthStatePayload {
  workspaceId: string;
  userId: string;
  nonce: string;
  expiresAt: number;
}

export interface GoogleTokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: Date;
  scope?: string;
  tokenType: string;
}

export interface GoogleCalendarMeta {
  id: string;
  summary: string;
  primary?: boolean;
  timeZone?: string;
  accessRole?: string;
}

export class GoogleOAuthService {
  private clientId: string;
  private clientSecret: string;
  private redirectUri: string;
  private secretKey: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || "google_client_id_placeholder";
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || "google_client_secret_placeholder";
    const apiUrl = process.env.API_URL || "http://localhost:4000";
    this.redirectUri =
      process.env.GOOGLE_REDIRECT_URI || `${apiUrl}/api/v1/integrations/google-calendar/callback`;
    this.secretKey = process.env.SESSION_SECRET || "super_secret_session_secret_at_least_32_characters";
  }

  /**
   * Generates a tamper-proof signed state token bound to user, workspace, and 15-minute expiry.
   */
  generateAuthUrl(params: { workspaceId: string; userId: string }): {
    url: string;
    state: string;
  } {
    const payload: GoogleOAuthStatePayload = {
      workspaceId: params.workspaceId,
      userId: params.userId,
      nonce: crypto.randomBytes(16).toString("hex"),
      expiresAt: Date.now() + 15 * 60 * 1000,
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", this.secretKey)
      .update(encodedPayload)
      .digest("base64url");

    const state = `${encodedPayload}.${signature}`;

    const scopes = [
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/calendar.readonly",
    ].join(" ");

    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", this.clientId);
    authUrl.searchParams.set("redirect_uri", this.redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);

    return {
      url: authUrl.toString(),
      state,
    };
  }

  /**
   * Verifies state token signature and expiration.
   */
  verifyState(state: string): GoogleOAuthStatePayload {
    const parts = state.split(".");
    if (parts.length !== 2) {
      throw new Error("Invalid OAuth state format");
    }

    const [encodedPayload, signature] = parts;
    const expectedSignature = crypto
      .createHmac("sha256", this.secretKey)
      .update(encodedPayload)
      .digest("base64url");

    if (signature !== expectedSignature) {
      throw new Error("OAuth state signature mismatch or tampered");
    }

    const decoded = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as GoogleOAuthStatePayload;

    if (Date.now() > decoded.expiresAt) {
      throw new Error("OAuth state token has expired");
    }

    return decoded;
  }

  /**
   * Exchanges an authorization code for access and refresh tokens.
   */
  async exchangeCodeForTokens(code: string): Promise<GoogleTokenResponse> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: this.redirectUri,
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Google token exchange failed: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as any;
    const expiresInSec = data.expires_in || 3600;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      tokenExpiresAt: new Date(Date.now() + expiresInSec * 1000),
      scope: data.scope,
      tokenType: data.token_type || "Bearer",
    };
  }

  /**
   * Refreshes an expired access token using the stored refresh token.
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    tokenExpiresAt: Date;
  }> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Google token refresh failed: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as any;
    const expiresInSec = data.expires_in || 3600;

    return {
      accessToken: data.access_token,
      tokenExpiresAt: new Date(Date.now() + expiresInSec * 1000),
    };
  }

  /**
   * Fetches the user's calendars to allow selection.
   */
  async listUserCalendars(accessToken: string): Promise<GoogleCalendarMeta[]> {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to list Google calendars: ${res.status} ${errorText}`);
    }

    const data = (await res.json()) as any;
    return (data.items || []).map((c: any) => ({
      id: c.id,
      summary: c.summary,
      primary: !!c.primary,
      timeZone: c.timeZone,
      accessRole: c.accessRole,
    }));
  }

  /**
   * Helper to encrypt credential JSON at rest.
   */
  encryptCredentials(creds: {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt: string;
    scope?: string;
  }): string {
    return encryptText(JSON.stringify(creds), this.secretKey);
  }

  /**
   * Helper to decrypt credential JSON.
   */
  decryptCredentials(encrypted: string): {
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt: string;
    scope?: string;
  } {
    const decrypted = decryptText(encrypted, this.secretKey);
    return JSON.parse(decrypted);
  }
}

export const googleOAuthService = new GoogleOAuthService();
