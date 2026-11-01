-- Data migration (runs once). Idempotent by construction.
-- 1) The utilities category was seeded as 'Suministros'; rename it to 'Supplies' ONLY while the
--    name is still that old default, so a name the user edited is never overwritten.
UPDATE `categories` SET `name` = 'Supplies' WHERE `slug` = 'utilities' AND `name` = 'Suministros';--> statement-breakpoint
-- 2) Backfill default icons by slug for existing rows that have none yet.
UPDATE `categories` SET `icon` = CASE `slug`
		WHEN 'supermarket' THEN 'shopping-basket'
		WHEN 'eating-out' THEN 'utensils'
		WHEN 'rent-housing' THEN 'house'
		WHEN 'utilities' THEN 'zap'
		WHEN 'subscriptions' THEN 'repeat'
		WHEN 'entertainment' THEN 'clapperboard'
		WHEN 'shopping' THEN 'shopping-bag'
		WHEN 'travel' THEN 'plane'
		WHEN 'transport' THEN 'bus'
		WHEN 'car' THEN 'car'
		WHEN 'motorbike' THEN 'bike'
		WHEN 'health' THEN 'heart-pulse'
		WHEN 'pets' THEN 'paw-print'
		WHEN 'education' THEN 'graduation-cap'
		WHEN 'insurance' THEN 'shield-check'
		WHEN 'taxes-fees' THEN 'receipt'
		WHEN 'gifts-donations' THEN 'gift'
		WHEN 'cash-withdrawals' THEN 'banknote'
		WHEN 'personal-transfers' THEN 'send'
		WHEN 'salary-contributions' THEN 'wallet'
		WHEN 'other-income' THEN 'circle-plus'
		WHEN 'internal-transfer' THEN 'arrow-left-right'
	END
WHERE `icon` IS NULL AND `slug` IN ('supermarket', 'eating-out', 'rent-housing', 'utilities', 'subscriptions', 'entertainment', 'shopping', 'travel', 'transport', 'car', 'motorbike', 'health', 'pets', 'education', 'insurance', 'taxes-fees', 'gifts-donations', 'cash-withdrawals', 'personal-transfers', 'salary-contributions', 'other-income', 'internal-transfer');
