# RR Assistant frontend

This application is for Revenue Recovery proceedings: uploaded source data populates the existing fixed proceedings templates. Use RR Assistant terminology rather than GDP, grievance processing, or petition OCR branding.

The admin workspace follows the supplied GDP dashboard reference visually, tailored to RR proceedings. Admin login opens Dashboard, User Management and Backup; officer login opens RR Assistant. Keep the generated proceedings editor and correction chat in the desktop 60/40 layout.

## Current admin scope

- Frontend-only demo login; selecting Admin is not server authorization.
- User Management stores an editable local officer directory with roles, taluks and active/inactive status. It does not provision accounts or change login access.
- Dashboard counts saved browser-local proceedings sessions; it does not report database health or server-wide totals.
- Backup exports local officer records, audit records, latest edited RR draft, and preferences as versioned JSON.
- Restore validates and previews the file, then replaces these local records and signs out after confirmation.
- Original source uploads, backend templates, generated server files, databases, credentials, and accounts are outside this backup. Download generated documents separately.

## Verification

Run `npm run build` and `node --test src/services/adminStore.test.js` from this directory.
