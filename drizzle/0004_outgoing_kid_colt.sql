ALTER TABLE `statements` MODIFY COLUMN `category_source` enum('rule','manual','ai');--> statement-breakpoint
ALTER TABLE `statements` ADD `ai_confidence` int;--> statement-breakpoint
ALTER TABLE `statements` ADD `ai_model` varchar(80);