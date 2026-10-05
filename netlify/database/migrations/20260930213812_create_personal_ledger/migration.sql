CREATE TYPE "transaction_kind" AS ENUM('deposit', 'withdrawal', 'transfer');--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"account_number" text NOT NULL UNIQUE,
	"opening_cents" bigint DEFAULT 0 NOT NULL,
	"color" text DEFAULT 'green' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_id" text NOT NULL,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"description" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_invitations" (
	"email" text PRIMARY KEY,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"account_id" uuid NOT NULL,
	"destination_id" uuid,
	"type" "transaction_kind" NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "positive_amount" CHECK ("amount_cents" > 0),
	CONSTRAINT "valid_transfer" CHECK (("type" = 'transfer' AND "destination_id" IS NOT NULL AND "destination_id" <> "account_id") OR ("type" <> 'transfer' AND "destination_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "ledger_transactions" ("date");--> statement-breakpoint
CREATE INDEX "transactions_account_idx" ON "ledger_transactions" ("account_id");--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_account_id_ledger_accounts_id_fkey" FOREIGN KEY ("account_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_destination_id_ledger_accounts_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT;