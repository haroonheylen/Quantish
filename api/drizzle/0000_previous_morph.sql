CREATE TYPE "public"."unit" AS ENUM('m', 'm2', 'm3', 'kg', 'piece');--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"code" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "objects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"unit" "unit" NOT NULL,
	"quantity" numeric(14, 3) NOT NULL,
	"unit_price" numeric(12, 4) NOT NULL,
	"line_total" numeric(14, 2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,
	"properties" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objects_quantity_non_negative" CHECK ("objects"."quantity" >= 0),
	CONSTRAINT "objects_unit_price_non_negative" CHECK ("objects"."unit_price" >= 0),
	CONSTRAINT "objects_piece_is_one" CHECK ("objects"."unit" <> 'piece' OR "objects"."quantity" = 1)
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objects" ADD CONSTRAINT "objects_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "articles_parent_id_idx" ON "articles" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "objects_article_id_idx" ON "objects" USING btree ("article_id");