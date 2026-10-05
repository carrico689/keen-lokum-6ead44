# REGIONS

A private, personal workspace for keeping accounts and transactions thoughtfully organized. The interface features **REGIONS** in green, a clear overview, searchable entries, account balances, and separate team and view-only access.

## Features

- Create accounts with names, account numbers, opening balances, and identifying colors.
- Record deposits, withdrawals, and transfers with dates, descriptions, amounts, and notes.
- Edit or remove entries with automatic balance recalculation and an activity history.
- Transfer amounts between accounts without changing the combined balance.
- Search entries; filter by account, type, or time period; sort and paginate transactions.
- Export the current transaction view as CSV.
- Hide account numbers by default and reveal them when needed.
- Use a responsive workspace with secure sign-in and private password setup.

The workspace starts empty. Only the entries you record are shown, and account data is never exposed to unauthenticated visitors.

## Technologies

TanStack Start and Router, React 19, TypeScript, Vite, Tailwind CSS with custom styles, and Lucide icons power the interface. Netlify Functions provide the authenticated API. Netlify Identity manages email/password authentication, invitations, and password recovery. Netlify Database provides managed PostgreSQL persistence through the native Drizzle adapter.

## Access setup

After the site is published, open the sign-in dialog and choose **Set up your access**. Enter your approved email address to receive a private invitation. Follow the emailed link and choose a password of at least 12 characters. Your email is your username; there are no preassigned or publicly shared passwords.

The supplied roster has two team accounts with editing access and two view-only accounts. The address supplied without a role defaults to view-only. Team accounts can add, edit, and delete entries. View-only accounts can view, search, filter, and export the shared entries but cannot change them. Role enforcement happens on the server.

To invite a new viewer, sign in as a team editor and open **Access**. Enter the visitor's email and an optional display name, then select **Send view-only invitation**. The visitor follows the email link, chooses their own password, and signs in. New viewers are saved durably in Netlify Database and appear in the member list, where editors can resend invitations. Existing confirmed Identity users can sign in using their existing password after access is granted.

Only editors can grant viewer access. The server always assigns invited visitors view-only permissions, regardless of browser-selected tabs or user metadata. Viewers cannot change entries or invite others, but can see all financial details and download exports, including account numbers. Invite only trusted recipients. Invitation failures do not remove saved access; retry after the five-minute cooldown. Anonymous visitors still see only the locked workspace; public signup is not introduced.

If an account already exists, sign in or use **Forgot password**. Invitation requests are limited to one per approved address every five minutes. Check spam folders when waiting for an email. Invitations require the published site's Netlify Identity runtime. The Netlify Identity feature marker is included for activation during deployment.

## Run locally

Prerequisites: Node.js 22 or newer, pnpm, and the Netlify CLI authenticated to the linked project.

```bash
pnpm install
netlify dev --port 8889
```

Open the local URL printed by Netlify CLI. Use Netlify's development environment so Identity, Functions, and Database are available. Account activation is best completed using the published site's invitation links. No database connection string or Identity operator token needs to be added to browser code.

## Data and deployment

All structured data is stored in Netlify Database. The schema lives in `db/schema.ts`, and the generated migrations in `netlify/database/migrations/` are applied by the platform. The database is provisioned as part of the first deployment and connection. Identity is activated through the project's feature marker. Deployment uses the existing Netlify configuration.

For future schema changes, retain the beta versions of Drizzle required for the native Netlify adapter, check migration status, update the schema, and generate a named migration:

```bash
netlify db status
pnpm exec drizzle-kit generate --name describe_schema_change
```

Amounts use exact integer cents. Total account balances include opening balances and all recorded entries. Period filters affect flow summaries and transaction lists; the balance chart shows the full recorded history. Transactions and change-history events are saved atomically. If two team members edit the same entry, stale changes are rejected so one person's work does not silently overwrite the other's.

Exports include full account numbers; keep downloaded files private. Account deletion is blocked while any transaction references the account. Sign out on shared devices and use a password manager instead of sharing passwords publicly.

Local build, start, and validation commands were intentionally not run during project creation. The deployment pipeline performs installation and build validation automatically.
