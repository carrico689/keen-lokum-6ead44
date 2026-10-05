# my REGIONS ledger

## Architecture

This is a private, shared personal ledger built with TanStack Start, React 19, TypeScript, Vite, and Netlify. The public home page renders an empty, locked workspace shell; actual account details, transactions, member identities, and activity are fetched only after authentication. Do not introduce fabricated ledger entries or third-party institution branding.

## Key directories

- `src/routes/index.tsx` renders the application; `__root.tsx` owns metadata and document markup.
- `src/components/LedgerApp.tsx` manages navigation, data fetching, filtering, totals, pagination, and exports.
- `src/components/EntryDialogs.tsx` implements account and transaction entry, editing, details, and deletion.
- `src/components/AuthDialog.tsx` implements sign-in, private invitations, recovery, and password setup.
- `src/components/Dialog.tsx` uses native modal dialogs for focus management and keyboard accessibility.
- `src/components/BalanceChart.tsx` derives balance history exclusively from recorded entries.
- `src/lib/ledger.ts` contains shared interfaces and pure money, date, balance, and CSV helpers. It is safe to import in client code.
- `src/styles.css` contains the forest-green and warm-white design, responsive layouts, and motion preferences.
- `netlify/functions/ledger.mts` is the authenticated CRUD API at `/api/ledger`.
- `netlify/functions/access.mts` sends invitation emails at `/api/access`, restricted to the approved roster and limited to once per address every five minutes.
- `netlify/functions/identity.mts` restricts Identity lifecycle events and assigns server-controlled roles.
- `netlify/lib/access.ts` is the server-only access roster. Never import it into browser code.
- `db/schema.ts` defines all persistent tables; `db/index.ts` initializes the native Netlify Database Drizzle adapter.
- `netlify/database/migrations/` contains generated migrations; `drizzle.config.ts` selects this directory.

## Security and access

Use `@netlify/identity` for authentication. Require confirmed Identity users and resolve permissions from the server-side approved email roster. Do not trust browser-selected access tabs or user-editable metadata for authorization. Team members are editors; viewer permissions are enforced by the API, not just hidden controls. The unspecified role on the fourth supplied address intentionally defaults to viewer.

The invitation endpoint is an intentional bootstrap path: an approved person can request their own invitation before any account exists. The runtime Identity operator token is used only server-side to send the invitation. The endpoint never returns it or discloses the roster. Passwords are chosen by each person through the emailed link; never hardcode, log, publish, or embed passwords in summaries. Do not add a public signup path or broaden access without explicit user instructions.

Protect mutation and invitation requests with `verifyRequestOrigin`. Return private API responses with `Cache-Control: private, no-store`. Clear loaded ledger data on logout or authorization failures. Keep financial entries out of logs, public SSR markup, and browser persistence. Identity-managed session storage is separate from ledger data.

## Data conventions

Use Netlify Database with `@netlify/database`, `drizzle-orm@beta`, and `drizzle-kit@beta`. No local files, browser localStorage, in-memory stores, or external databases may replace durable storage. Define schema changes in `db/schema.ts`, then generate a named migration with `pnpm exec drizzle-kit generate --name descriptive_name`. Check `netlify db status` before migration work. The first published deploy provisions the database; before that, status may report that no branch exists. Applied migrations are immutable.

All monetary values are stored and calculated as integer USD cents. Parse decimal inputs with `parseMoney`; do not use floating-point arithmetic for money. A transfer is one record referencing distinct source and destination accounts. It reduces one account and increases the other without changing aggregate balance. Opening balances precede all recorded transactions. Current totals and charts include all recorded dates; the period selector filters transaction flow summaries and table entries. Sort chronology by date, creation timestamp, then record ID.

Changes and their activity records are committed in a single database transaction. Ledger reads use a read-only repeatable-read transaction so accounts, transactions, and history come from a consistent snapshot. Updates and deletes compare `updatedAt` for optimistic concurrency. Accounts referenced by any transaction cannot be deleted. The audit feed displays the latest 100 changes. CSV exports reflect current table filters and escape spreadsheet formula prefixes; they contain account numbers and should be handled privately.

## Coding conventions

Use TypeScript, descriptive camelCase names, PascalCase components, type-only imports where appropriate, and functional React components. Server modules use `.mts` functions and `.js` suffixes for relative TypeScript imports. Keep server-only configuration out of shared modules. Preserve loading, locked, empty, error, confirmation, and viewer states when changing UI. All controls need accessible names and visible focus feedback; respect reduced-motion preferences.

## Development

Install dependencies with `pnpm install`. Use `netlify dev --port 8889` for local development with Netlify features, not a standalone Vite server. Production deployment runs the configured build automatically. During the project creation session, no local build, server, type-check, lint, or test commands were run as requested; schema generation and the Identity activation script were allowed setup operations.
