<script lang="ts">
	import { formatMoney } from '#lib/format/money.ts';
	import { formatDay } from '#lib/dashboard/insights.ts';
	import CategoryChip from './CategoryChip.svelte';

	export interface Row {
		id: number;
		bookingDate: string;
		concept: string;
		amountCents: number;
		balanceCents: number | null;
		categoryName: string | null;
		categoryColor: string | null;
		categoryIcon: string | null;
		categorySlug: string | null;
		personName: string | null;
	}
	interface Props {
		rows: Row[];
		sort: string;
		/** Href for a given sort key (resolved by the caller). */
		sortHref: (sort: string) => string;
		/** Query string appended to category links. */
		search?: string;
	}
	let { rows, sort, sortHref, search = '' }: Props = $props();

	const dateNext = $derived(sort === 'date_desc' ? 'date_asc' : 'date_desc');
	const amountNext = $derived(sort === 'amount_desc' ? 'amount_asc' : 'amount_desc');
	const ariaSort = (key: 'date' | 'amount') =>
		sort.startsWith(key) ? (sort.endsWith('desc') ? 'descending' : 'ascending') : 'none';
</script>

<div class="overflow-x-auto">
	<table class="w-full text-left text-sm" data-testid="transactions-table">
		<thead class="border-b border-line text-xs text-ink-soft">
			<tr>
				<th scope="col" class="py-2 pr-3 font-medium" aria-sort={ariaSort('date')}>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- caller passes resolved hrefs -->
					<a href={sortHref(dateNext)} class="hover:text-ink">Date</a>
				</th>
				<th scope="col" class="py-2 pr-3 font-medium">Description</th>
				<th scope="col" class="hidden py-2 pr-3 font-medium md:table-cell">Category</th>
				<th scope="col" class="py-2 text-right font-medium" aria-sort={ariaSort('amount')}>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- caller passes resolved hrefs -->
					<a href={sortHref(amountNext)} class="hover:text-ink">Amount</a>
				</th>
				<th scope="col" class="hidden py-2 pl-3 text-right font-medium sm:table-cell">Balance</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-line">
			{#each rows as r (r.id)}
				<tr>
					<td class="num py-2.5 pr-3 align-top whitespace-nowrap text-ink-soft">
						{formatDay(r.bookingDate)}
					</td>
					<td class="max-w-0 min-w-40 py-2.5 pr-3 align-top">
						<p class="truncate" title={r.concept}>{r.concept}</p>
						<p class="mt-1 md:hidden">
							<CategoryChip
								name={r.categoryName ?? 'Uncategorised'}
								color={r.categoryColor}
								slug={r.categorySlug}
								icon={r.categoryIcon}
								{search}
							/>
						</p>
						{#if r.personName}<p class="text-xs text-ink-soft">{r.personName}</p>{/if}
					</td>
					<td class="hidden py-2.5 pr-3 align-top md:table-cell">
						<CategoryChip
							name={r.categoryName ?? 'Uncategorised'}
							color={r.categoryColor}
							slug={r.categorySlug}
							icon={r.categoryIcon}
							{search}
						/>
					</td>
					<td
						class="num py-2.5 text-right align-top font-medium whitespace-nowrap {r.amountCents > 0
							? 'text-primary-700'
							: 'text-ink'}"
					>
						{r.amountCents > 0 ? '+' : ''}{formatMoney(r.amountCents)}
					</td>
					<td
						class="num hidden py-2.5 pl-3 text-right align-top whitespace-nowrap text-ink-soft sm:table-cell"
					>
						{r.balanceCents === null ? '–' : formatMoney(r.balanceCents)}
					</td>
				</tr>
			{:else}
				<tr><td colspan="5" class="py-8 text-center text-ink-soft">No transactions match.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
