# Security Review Notes

- Replace all development secrets before any deployment.
- Never expose `.env` or database credentials in GitHub.
- Configure TLS at the edge and restrict database network access.
- Enforce least privilege for PostgreSQL and staff roles.
- Add MFA and session revocation before real staff use.
- Add signed webhook verification and replay prevention per chosen messaging provider.
- Implement case-level authorization and district assignment policy before exposing the staff queue.
- Set rate limits by route and by source, with abuse monitoring that avoids logging personal content.
- Encrypt backups and define tested recovery objectives.
- Establish incident response, breach assessment, deletion and retention policies.
- Run dependency scanning, SAST, DAST and independent penetration testing.
- No real user data in development, demo, logs or test fixtures.
