CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`iban` varchar(34) NOT NULL,
	`name` varchar(120) NOT NULL,
	`currency` char(3) NOT NULL DEFAULT 'EUR',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `accounts_iban_uq` UNIQUE(`iban`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(60) NOT NULL,
	`name` varchar(80) NOT NULL,
	`color` varchar(9) NOT NULL,
	`kind` enum('expense','income','transfer','ignore') NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_slug_uq` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `category_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`pattern` varchar(255) NOT NULL,
	`match_type` enum('contains','regex') NOT NULL DEFAULT 'contains',
	`category_id` int NOT NULL,
	`person_id` int,
	`priority` int NOT NULL DEFAULT 100,
	`direction` enum('any','in','out') NOT NULL DEFAULT 'any',
	`is_active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `category_rules_id` PRIMARY KEY(`id`),
	CONSTRAINT `category_rules_pattern_uq` UNIQUE(`pattern`,`match_type`)
);
--> statement-breakpoint
CREATE TABLE `import_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`importer_id` varchar(60) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`file_sha256` char(64) NOT NULL,
	`account_id` int NOT NULL,
	`rows_total` int NOT NULL DEFAULT 0,
	`rows_inserted` int NOT NULL DEFAULT 0,
	`rows_updated` int NOT NULL DEFAULT 0,
	`rows_unchanged` int NOT NULL DEFAULT 0,
	`imported_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `import_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(80) NOT NULL,
	CONSTRAINT `people_id` PRIMARY KEY(`id`),
	CONSTRAINT `people_name_uq` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `statements` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`account_id` int NOT NULL,
	`importer_id` varchar(60) NOT NULL,
	`dedup_hash` char(64) NOT NULL,
	`booking_date` date NOT NULL,
	`value_date` date NOT NULL,
	`concept` text NOT NULL,
	`amount_cents` bigint NOT NULL,
	`balance_cents` bigint,
	`raw_json` json NOT NULL,
	`batch_id` int NOT NULL,
	`category_id` int,
	`category_source` enum('rule','manual'),
	`person_id` int,
	`first_seen_at` timestamp NOT NULL DEFAULT (now()),
	`last_seen_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `statements_id` PRIMARY KEY(`id`),
	CONSTRAINT `statements_dedup_uq` UNIQUE(`dedup_hash`)
);
--> statement-breakpoint
ALTER TABLE `category_rules` ADD CONSTRAINT `category_rules_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `category_rules` ADD CONSTRAINT `category_rules_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `import_batches` ADD CONSTRAINT `import_batches_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `statements` ADD CONSTRAINT `statements_account_id_accounts_id_fk` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `statements` ADD CONSTRAINT `statements_batch_id_import_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `import_batches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `statements` ADD CONSTRAINT `statements_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `statements` ADD CONSTRAINT `statements_person_id_people_id_fk` FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `category_rules_category_idx` ON `category_rules` (`category_id`);--> statement-breakpoint
CREATE INDEX `import_batches_account_idx` ON `import_batches` (`account_id`);--> statement-breakpoint
CREATE INDEX `statements_booking_date_idx` ON `statements` (`booking_date`);--> statement-breakpoint
CREATE INDEX `statements_category_idx` ON `statements` (`category_id`);--> statement-breakpoint
CREATE INDEX `statements_account_idx` ON `statements` (`account_id`);--> statement-breakpoint
CREATE INDEX `statements_batch_idx` ON `statements` (`batch_id`);