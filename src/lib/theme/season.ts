/**
 * Seasonal themes, chosen from the visitor's local calendar day.
 * Keep in sync with the inline pre-paint script in src/app.html (season.spec.ts checks both).
 */
export type Season = 'xmas' | 'nye';

/** Christmas week: 20/12 to 26/12 inclusive. */
export const XMAS = { month: 12, from: 20, to: 26 } as const;

/** New Year: 31/12 and 01/01. */
export const NYE = [
	{ month: 12, day: 31 },
	{ month: 1, day: 1 }
] as const;

export function seasonFor(date: Date): Season | null {
	const month = date.getMonth() + 1;
	const day = date.getDate();
	if (month === XMAS.month && day >= XMAS.from && day <= XMAS.to) return 'xmas';
	if (NYE.some((d) => d.month === month && d.day === day)) return 'nye';
	return null;
}

/** One firework spark. Positions are in canvas pixels, `life` runs from 1 down to 0. */
export interface Spark {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	color: number;
}

/** A burst of `count` sparks radiating from (x, y); `rand` returns [0, 1). */
export function burst(
	x: number,
	y: number,
	color: number,
	rand: () => number,
	count = 46
): Spark[] {
	return Array.from({ length: count }, () => {
		const angle = rand() * Math.PI * 2;
		const speed = 0.6 + rand() * 2;
		return { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color };
	});
}

/** Advance every spark one frame (gravity, drag, fade) and drop the dead ones. */
export function stepSparks(sparks: Spark[]): Spark[] {
	const next: Spark[] = [];
	for (const s of sparks) {
		const life = s.life - 0.011;
		if (life <= 0) continue;
		next.push({
			...s,
			x: s.x + s.vx,
			y: s.y + s.vy,
			vx: s.vx * 0.985,
			vy: s.vy + 0.025,
			life
		});
	}
	return next;
}
