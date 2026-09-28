# Admin production readiness review — 25 September 2026

Verdict: **not ready for production**. The admin interface is a local prototype. Passing compilation and unit tests does not establish secure multi-user operation.

This was a source review with local checks, not a live deployment penetration test. No application code or real records were changed during this review.

## Release blockers

1. **Critical — backend authorization trusts the caller.** `Backend/api.py:239` defaults the user-creation role header to admin. Template creation/update/delete and user deletion follow the same pattern. Updating users trusts `x_user_role` and `x_user_id` headers rather than an authenticated server session. User listing and audit read/write endpoints have no authentication dependency. Require server-verified identity and permissions for every sensitive endpoint; removing only the default header is insufficient.

2. **Critical — temporary administrator credentials ship in the frontend.** `Frontend/src/services/temporaryLogin.js:3` and `accountStore.js:63` provide a known credential that creates an administrator locally. Normal authentication, role assignment, and password hashes also depend on editable browser storage. Replace with server authentication and remove production access to the temporary bootstrap. The older initial-admin setup functions also remain in `accountStore.js:45` although the login UI was removed.

3. **High — export filename can escape the output directory.** `Backend/api.py:462` accepts a filename from the request and joins it directly to `OUTPUT_DIR` before writing. Absolute paths and parent-directory segments are not rejected. Use a server-generated filename, validate the resolved output path, and authenticate the route. This was identified statically; no filesystem exploit was executed.

4. **High — printed audit receipts permit HTML injection.** `Frontend/src/components/audit/AuditLogView.jsx:94` inserts case number, party information, and document content directly into `document.write`. A record containing HTML can become active markup in the same-origin print window. Build the receipt using text nodes or escape every interpolated value; restrict the print window's privileges.

5. **High — admin data is not centrally persisted or shared.** `adminStore.js:13`, `apiService.js:257`, and `activityStore.js:10` read browser storage rather than the database. `AdminNotifications.jsx:20` consequently cannot notify an admin about an officer working on another device/browser. Browser data can be altered or cleared, and concurrent tabs can overwrite each other's read/modify/write updates. Wire these flows to authenticated server endpoints and an authoritative audit/event store.

## Functional errors and gaps

6. **High — dispatch contract mismatch and misleading completion.** `App.jsx:247` inserts `response.auditEntry` into the ledger, but `Backend/api.py:324` returns only success/message/receipt. The client also hardcodes September 2026. The endpoint records a database status and generates a receipt locally; it makes no external DRO submission. It does not assign the generated receipt back to the entry before saving. Define one response contract, persist the actual saved entry and receipt, use the real date, and only claim dispatch after a confirmed delivery integration.

7. **High — failed audit saves are silently accepted.** `apiService.js:280` catches storage failures and returns null. Callers in `RRAssistantView.jsx:173` and `:224` await the call without checking its result, so completion can appear successful without a saved audit record. `activityStore.js:26` similarly logs failures only to the console. An isolated quota-failure check reproduced the null result. Propagate failure and show an actionable error; make the operation and audit event transactional where required.

8. **Medium — receipts still invent validation information.** `AuditLogView.jsx:122` substitutes 96% grounding and 0.04 risk, and `:124` substitutes a fixed hash. These are remaining fabricated fallback values despite the mock-data cleanup. Display “Not recorded” when absent and preserve legitimate zero values with nullish checks.

9. **Medium — Period filter display does not represent state.** `AuditFilters.jsx:28` provides only today/week/month options, but `auditFilters.js:1` initializes/resets to an empty value and manual dates set custom. Neither value has a matching option. The displayed selection can therefore imply a period that is not applied. Restore matching placeholder/custom options or deliberately redesign the state mapping.

10. **High for disaster recovery — backup cannot restore working accounts to a fresh browser.** `adminStore.js:2` deliberately excludes credentials and activity history, and the backup page restores only browser data. Restored officer accounts have no corresponding credentials in a new browser. Server uploads, generated documents and PostgreSQL are not backed up. This is acceptable only as the documented prototype export, not production recovery. Provide server backups and a tested credential recovery strategy without putting plaintext passwords in exports.

11. **Medium — misleading health/startup status and incomplete dependency manifest.** `Backend/api.py:55` logs database startup failure and continues; `:100` returns online even when the database probe fails. `Backend/db.py:12` requires psycopg2, but it is absent from `Backend/requirements.txt`. Establish a dependency-complete deployment and readiness checks that fail when required services are unavailable.

12. **Medium — uploads collide and lack an application size limit.** `Backend/api.py:362` writes uploads to a filename derived only from the original name, with no byte-limit check. Concurrent uploads of the same name can overwrite each other. Use unique server-side names, bounded uploads, and ownership checks on generated-file downloads.

13. **Medium — dashboard Failure is a renamed draft count.** `AdminWorkspace.jsx:38` counts DRAFT records as failures. This follows the earlier request to change the label only, but it is not an actual failure metric. Agree on real failure states before using it for operational reporting.

## Verification performed

- Frontend production build: passed.
- Existing account, admin storage, activity, audit storage and audit-filter tests: **25 passed, 0 failed**.
- Python syntax compilation: **16 backend modules passed**.
- Isolated storage-quota reproduction: confirmed audit saving resolves null instead of rejecting; no real storage accessed.
- Reviewed dashboard, user management, profile/password settings, backups, notifications, audit filtering/printing, authentication, and associated backend routes.

Not verified: live PostgreSQL/OCR/Ollama/DRO integrations, deployed infrastructure, dependency vulnerability scan, or a fresh end-to-end browser regression. Existing backend integration tests write database records, so they were not run against an unidentified database.

Recommended sequence: server authentication/authorization and temporary-access removal; path and HTML-injection fixes; central persistence and dispatch contract; reliable auditing and recovery; then full deployment and browser integration tests.
