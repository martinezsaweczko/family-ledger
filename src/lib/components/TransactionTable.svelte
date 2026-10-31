<script lang="ts">
	import { formatMoney } from '#lib/format/money.ts';
	import { formatDate } from '#lib/format/date.ts';
	import CategoryChip from './CategoryChip.svelte';
	import RowCategoryEditor, { type EditorCategory } from './RowCategoryEditor.svelte';

	export interface Row {
		id: number;
		bookingDate: string;
		concept: string;
		amountCents: number;
		balanceCents: number | null;
		categoryName: string | null;
		categoryColor: string | null;
		categoryIcon: string | null;
		categoryId?: number | null;
		categorySource?: 'rule' | 'manual' | null;
		isManual?: boolean;
		suggestedPattern?: string;
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
		/** When set, every row gets a "Change category" control (posts to the page's overrideActions). */
		categories?: EditorCategory[];
	}
	let { rows, sort, sortHref, search = '', categories }: Props = $props();

	let openId = $state<number | null>(null);

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
					<td class="num py-2.5 pr-3 align-top text-ink-soft sm:whitespace-nowrap">
						{formatDate(r.bookingDate)}
					</td>
					<td class="max-w-0 min-w-28 py-2.5 pr-3 align-top">
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
						{#if r.personName || r.isManual || (r.categorySource === 'manual' && !r.isManual)}
							<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
								{#if r.isManual}<span class="pill" data-testid="badge-manual">manual</span>
								{:else if r.categorySource === 'manual'}<span
										class="pill pill-ok"
										data-testid="badge-edited"
										title="You chose this category; imports and rules will not change it"
										>edited</span
									>{/if}
								{#if r.personName}<span>{r.personName}</span>{/if}
							</p>
						{/if}
						{#if categories}
							<button
								type="button"
								class="mt-1 inline-flex min-h-8 cursor-pointer items-center rounded text-xs text-primary-700 underline decoration-line underline-offset-4 hover:decoration-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
								aria-expanded={openId === r.id}
								aria-controls="edit-{r.id}"
								aria-label="Change category for {r.concept}"
								onclick={() => (openId = openId === r.id ? null : r.id)}
							>
								Change category
							</button>
						{/if}
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
				{#if categories && openId === r.id}
					<tr class="border-t-0">
						<td colspan="5" class="pb-3">
							<RowCategoryEditor
								id="edit-{r.id}"
								statementId={r.id}
								concept={r.concept}
								categoryId={r.categoryId ?? null}
								{categories}
								suggestedPattern={r.suggestedPattern ?? r.concept}
								canClear={r.categorySource === 'manual' && !r.isManual}
								onclose={() => (openId = null)}
							/>
						</td>
					</tr>
				{/if}
			{:else}
				<tr><td colspan="5" class="py-8 text-center text-ink-soft">No transactions match.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
