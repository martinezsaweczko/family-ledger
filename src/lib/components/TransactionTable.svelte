<script lang="ts">
	import { tick } from 'svelte';
	import { formatMoney } from '#lib/format/money.ts';
	import { formatDate } from '#lib/format/date.ts';
	import AiBadge from './AiBadge.svelte';
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
		categorySource?: 'rule' | 'manual' | 'ai' | null;
		aiConfidence?: number | null;
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
	let wrapper = $state<HTMLElement>();

	/**
	 * A row was fixed in place: the list reloads (same URL, so page, sort and filters stay) and the
	 * row may have left the list. Keep the keyboard where it was: the same row's control if it is
	 * still there, else the control of the row that moved into its place, else the table itself.
	 */
	async function afterRowChange(id: number, index: number) {
		openId = null;
		await tick();
		const controls = [...(wrapper?.querySelectorAll<HTMLElement>('[data-row-control]') ?? [])];
		const target =
			controls.find((c) => c.dataset.rowControl === String(id)) ??
			controls[Math.min(index, controls.length - 1)] ??
			wrapper;
		target?.focus();
	}

	const dateNext = $derived(sort === 'date_desc' ? 'date_asc' : 'date_desc');
	const amountNext = $derived(sort === 'amount_desc' ? 'amount_asc' : 'amount_desc');
	const ariaSort = (key: 'date' | 'amount') =>
		sort.startsWith(key) ? (sort.endsWith('desc') ? 'descending' : 'ascending') : 'none';
	const sortLink =
		"relative inline-flex min-h-8 items-center hover:text-ink after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600";
	const arrow = (key: 'date' | 'amount') =>
		sort.startsWith(key) ? (sort.endsWith('desc') ? '↓' : '↑') : '';
</script>

<div
	bind:this={wrapper}
	tabindex="-1"
	role="region"
	aria-label="Transactions list"
	class="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
>
	<table class="w-full text-left text-sm" data-testid="transactions-table">
		<thead class="border-b border-line text-xs text-ink-soft">
			<tr>
				<th scope="col" class="py-2.5 pr-3 font-medium" aria-sort={ariaSort('date')}>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- caller passes resolved hrefs -->
					<a href={sortHref(dateNext)} class={sortLink} class:text-ink={arrow('date')}
						>Date{#if arrow('date')}<span aria-hidden="true" class="ml-1">{arrow('date')}</span
							>{/if}</a
					>
				</th>
				<th scope="col" class="py-2.5 pr-3 font-medium">Description</th>
				<th scope="col" class="hidden py-2.5 pr-3 font-medium md:table-cell">Category</th>
				<th scope="col" class="py-2.5 text-right font-medium" aria-sort={ariaSort('amount')}>
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- caller passes resolved hrefs -->
					<a href={sortHref(amountNext)} class={sortLink} class:text-ink={arrow('amount')}
						>Amount{#if arrow('amount')}<span aria-hidden="true" class="ml-1"
								>{arrow('amount')}</span
							>{/if}</a
					>
				</th>
				<th scope="col" class="hidden py-2.5 pl-3 text-right font-medium sm:table-cell">Balance</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-line">
			{#each rows as r, i (r.id)}
				<tr class="transition-colors hover:bg-paper">
					<td class="num py-3 pr-3 align-top text-ink-soft sm:whitespace-nowrap">
						{formatDate(r.bookingDate)}
					</td>
					<td class="max-w-0 min-w-28 py-3 pr-3 align-top">
						<p class="truncate font-medium text-ink" title={r.concept}>{r.concept}</p>
						<p class="mt-1 md:hidden">
							<CategoryChip
								name={r.categoryName ?? 'Uncategorised'}
								color={r.categoryColor}
								slug={r.categorySlug}
								icon={r.categoryIcon}
								{search}
							/>
						</p>
						{#if r.personName || r.isManual || r.categorySource === 'manual' || r.categorySource === 'ai'}
							<p class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
								{#if r.isManual}<span class="pill" data-testid="badge-manual">manual</span>
								{:else if r.categorySource === 'manual'}<span
										class="pill pill-ok"
										data-testid="badge-edited"
										title="You chose this category; imports and rules will not change it"
										>edited</span
									>{/if}
								{#if r.categorySource === 'ai' && !r.isManual}<AiBadge
										statementId={r.id}
										confidence={r.aiConfidence ?? null}
										editable={!!categories}
										onsaved={() => afterRowChange(r.id, i)}
										suggestedPattern={r.suggestedPattern ?? ''}
									/>{/if}
								{#if r.personName}<span>{r.personName}</span>{/if}
							</p>
						{/if}
						{#if categories}
							<button
								type="button"
								data-row-control={r.id}
								class="relative mt-1 inline-flex min-h-8 cursor-pointer items-center rounded text-xs text-primary-700 underline decoration-line underline-offset-4 after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] hover:decoration-primary-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600"
								aria-expanded={openId === r.id}
								aria-controls="edit-{r.id}"
								aria-label="Change category for {r.concept}"
								onclick={() => (openId = openId === r.id ? null : r.id)}
							>
								Change category
							</button>
						{/if}
					</td>
					<td class="hidden py-3 pr-3 align-top md:table-cell">
						<CategoryChip
							name={r.categoryName ?? 'Uncategorised'}
							color={r.categoryColor}
							slug={r.categorySlug}
							icon={r.categoryIcon}
							{search}
						/>
					</td>
					<td
						class="num py-3 text-right align-top font-semibold whitespace-nowrap {r.amountCents > 0
							? 'text-primary-700'
							: 'text-ink'}"
					>
						{r.amountCents > 0 ? '+' : ''}{formatMoney(r.amountCents)}
					</td>
					<td
						class="num hidden py-3 pl-3 text-right align-top whitespace-nowrap text-ink-soft sm:table-cell"
					>
						{r.balanceCents === null ? '–' : formatMoney(r.balanceCents)}
					</td>
				</tr>
				{#if categories && openId === r.id}
					<tr class="border-t-0 hover:bg-transparent">
						<td colspan="5" class="pb-4">
							<RowCategoryEditor
								id="edit-{r.id}"
								statementId={r.id}
								concept={r.concept}
								categoryId={r.categoryId ?? null}
								{categories}
								suggestedPattern={r.suggestedPattern ?? r.concept}
								canClear={r.categorySource === 'manual' && !r.isManual}
								onclose={() => afterRowChange(r.id, i)}
							/>
						</td>
					</tr>
				{/if}
			{:else}
				<tr><td colspan="5" class="py-12 text-center text-ink-soft">No transactions match.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
