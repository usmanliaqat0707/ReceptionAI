Review ONLY the changes introduced by this pull request.

Follow AGENTS.md and any nested AGENTS.md files that cover the changed
paths. Prioritize findings in this order:

1. Cross-tenant reads or writes, or missing requireWorkspaceAccess
2. Secret, token, or PII leakage in logs, responses, or git
3. AI tool mutations that skip the gateway, confirmation, or comms policy
4. SSRF or untrusted knowledge used as instructions
5. Unverified webhooks or OAuth state handling
6. Missing tests for the security-sensitive path that changed

Do not comment on formatting that CI already enforces. Be concise. For
each finding, name the file, the risk, the relevant AGENTS.md rule, and a
safe alternative. If there are no serious issues, say so in a short
paragraph and list any residual test gaps.
