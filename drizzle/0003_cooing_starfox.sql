CREATE TABLE `recurring_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`concept` varchar(255) NOT NULL,
	`amount_cents` bigint NOT NULL,
	`direction` enum('in','out') NOT NULL DEFAULT 'out',
	`category_id` int,
	`frequency` enum('weekly','biweekly','monthly') NOT NULL,
	`anchor` int NOT NULL,
	`start_date` date NOT NULL,
	`end_date` date,
	`is_active` boolean NOT NULL DEFAULT true,
	`affects_balance` boolean NOT NULL DEFAULT false,
	`note` text,
	`last_generated` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `recurring_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `statements` ADD `note` text;--> statement-breakpoint
ALTER TABLE `statements` ADD `affects_balance` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `statements` ADD `recurring_id` int;--> statement-breakpoint
ALTER TABLE `recurring_entries` ADD CONSTRAINT `recurring_entries_category_id_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `recurring_entries_active_idx` ON `recurring_entries` (`is_active`);--> statement-breakpoint
ALTER TABLE `statements` ADD CONSTRAINT `statements_recurring_id_recurring_entries_id_fk` FOREIGN KEY (`recurring_id`) REFERENCES `recurring_entries`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `statements_recurring_idx` ON `statements` (`recurring_id`);