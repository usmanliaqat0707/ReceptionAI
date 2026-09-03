# Authentication & Session Security Architecture

## 1. Opaque Session Tokens

ReceptionAI uses server-managed sessions with cryptographically secure, opaque random tokens:

1. **Token Generation**: When a user registers or logs in, a 32-byte cryptographically secure random token (64 hex characters) is generated using `crypto.randomBytes(32)`.
2. **Token Hashing**: The raw token is hashed using `SHA-256`. Only the `tokenHash` is persisted into the PostgreSQL `sessions` table.
3. **Defense in Depth**: Even in the event of a database compromise or backup leak, attackers cannot forge or hijack sessions because the raw token is never stored in the database.
4. **Cookie Transmission**: The raw token is sent to the client browser in an `httpOnly`, `sameSite: "lax"`, and `secure: true` (in production) cookie named `rai_session`.

## 2. Password Security

- Passwords are hashed using `bcrypt` with `12 salt rounds`.
- Plaintext passwords are never logged, never stored, and never exposed in API responses or audit log metadata.
- Minimum password length is enforced at 8 characters via Zod validation.

## 3. Password Reset & Invalidation Flow

1. User requests a password reset via `POST /api/v1/auth/forgot-password`.
2. A single-use 64-character token is generated and hashed with SHA-256 into `password_reset_tokens` with a 2-hour expiry.
3. Upon successful password reset via `POST /api/v1/auth/reset-password`, the token is consumed (`usedAt = now()`), the user's password hash is updated, and **all active user sessions are immediately revoked** in an atomic transaction.

## 4. Session Revocation & Concurrency Control

- Explicit logout (`POST /api/v1/auth/logout`) sets `revokedAt = now()` on the database session and clears the cookie.
- Users can view all active sessions under `/settings/security`, inspect IP addresses and User-Agent descriptions, and revoke individual sessions or all other sessions simultaneously.
