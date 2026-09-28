# Admin frontend review

Scope: frontend only. Backend implementation, API security, hosting, and server deployment are excluded. The requested temporary local login is treated as the current prototype mechanism, not a backend task.

Verdict: the main admin screens work, but the frontend is not yet ready for release because of the following UI errors and incomplete workflows.

## Confirmed findings

1. **Period selection is misleading — medium.** `Frontend/src/components/audit/AuditFilters.jsx:28` has only Today, This Week and This Month options. Initial/reset state is empty, and manual date edits set `custom`. In a real browser the dropdown displays Today in all three cases without applying today's range. Add matching default and Custom options; verify displayed and applied filters agree.

2. **Audit load failures appear as empty/successful refresh — high.** `Frontend/src/components/audit/AuditLogView.jsx:45` catches errors only in the console. A malformed saved ledger can show “No Audit Log entries found” or leave old results visible without explaining that refresh failed. Display a load error and Retry action; distinguish failed loading, loading, no data and no search matches. `auditStore.js:14` validates arrays but not their records; a null row reaches `availableOfficerIds()` and throws when reading officerId. Validate records before rendering.

3. **Audit persistence failures do not reach the user — high.** `Frontend/src/services/apiService.js:280` returns null after a failed save. Activity saving does the same in `activityStore.js:26`. Quota exhaustion can leave an operation appearing complete with no corresponding audit/activity entry. Propagate persistence errors to visible feedback and avoid reporting full success when recording failed. This behavior was reproduced with an isolated storage stub in the preceding review.

4. **Downloaded backup has no import workflow — medium.** `Frontend/src/components/admin/BackupPage.jsx` can create/download backups and restore entries already in its browser history, but cannot select and restore a downloaded JSON file. If browser data is lost, the downloaded file cannot be restored through this page. Add file selection, validation, confirmation and failure feedback if downloaded backups are intended to be recoverable. Existing account-password recovery limitations must be clearly communicated rather than silently promising complete recovery.

5. **Keyboard navigation is incomplete — medium.** `Frontend/src/components/layout/Sidebar.jsx:122` renders Audit Logs as a clickable div without keyboard behavior; the collapse action does the same. Audit table rows in `AuditLogView.jsx` use onClick without a keyboard-operable link/button. Keyboard users cannot complete these navigation workflows. Use native buttons/links and retain clear focus styles.

6. **Audit detail/receipt workflow is disconnected — medium.** `AuditLogView.jsx:43` initializes selectedLog to null; there is no action setting it to a record. Row clicks resume proceedings directly. The verification modal and Print Receipt control are therefore unreachable, and exportToJson is also unused. If these are intended product actions, provide explicit controls; otherwise remove dead code. The currently unreachable receipt renderer also contains unescaped document.write interpolation and invented validation/hash fallbacks; resolve these before exposing it. This corrects the previous review's implication that receipt printing was currently reachable.

7. **Dashboard totals do not refresh while open — medium.** `AdminWorkspace.jsx:21` loads users and proceedings only on mount. Activity subscribes to storage updates but the totals do not. A second tab can add/edit records while the open dashboard continues showing old totals. Subscribe consistently or provide a refresh action.

8. **Dashboard wording needs a product decision — low.** Failure counts DRAFT records, following the earlier label-only request. That label does not represent processing failures. Keep this distinction explicit or define and count actual failure states. Active officer status represents enabled accounts, not who is currently logged in; logout does not make an account inactive. No account-status control is treated as missing because its removal was explicitly requested.

## Checks

- Existing production build and all 25 frontend tests passed during this review session.
- Isolated headless browser: temporary admin login; empty dashboard; add officer; success message; edit officer; unchanged-save disabled; audit navigation; Period initial/manual/reset behavior; backup empty state.
- User Management at 390px viewport: page width remained 390px, with no horizontal page overflow.
- Extended browser run: create/download backup, open restore confirmation and cancel, edit and save My Profile all passed. The full restore was not performed.
- No uncaught application runtime exceptions occurred in that completed browser run. Early test attempts used the wrong selector for the clickable Audit Logs div; those were test harness errors, not application crashes.
- Source review: profile/password forms, backup confirmation, recent activity, notifications, table/filter actions, local account and data services.

This is not a claim that every browser, populated-data edge case, accessibility criterion or workflow has been exhaustively tested. No application code or user data was changed by this review; test accounts live only in an isolated temporary browser profile.

Release recommendation: resolve findings 1–5, decide the intended audit-detail workflow, then run complete populated/empty/error-state browser regression tests. Backend changes are outside this report.
