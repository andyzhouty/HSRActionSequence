import { describe, expect, it } from "vitest";

// The export logic is embedded in a component with lots of context deps.
// We test the pure filtering logic directly by replicating the algorithms.

interface MinimalAction {
	key: string;
	characterId: string;
	actionNo: number;
	actionValue: number;
	skill: string;
	displayName?: string;
	isDomainAction?: boolean;
	isDomainFinalAction?: boolean;
	isAhaInstant?: boolean;
}

interface DomainRange {
	casterId: string;
	startAV: number;
	endAV: number;
}

function buildDomainRanges(actions: MinimalAction[]): DomainRange[] {
	const ranges: DomainRange[] = [];
	for (const a of actions) {
		if (a.isDomainAction && !a.isDomainFinalAction) {
			const existing = ranges.find(
				(r) => r.casterId === a.characterId && r.endAV === 0,
			);
			if (!existing) {
				ranges.push({
					casterId: a.characterId,
					startAV: a.actionValue,
					endAV: 0,
				});
			}
		}
		if (a.isDomainFinalAction) {
			const range = ranges.find(
				(r) => r.casterId === a.characterId && r.endAV === 0,
			);
			if (range) range.endAV = a.actionValue;
		}
	}
	return ranges;
}

function isInsideDomain(
	action: MinimalAction,
	domainRanges: DomainRange[],
	characterKinds: Record<string, string>,
): boolean {
	if (action.isDomainAction) return false;
	if (action.isAhaInstant) return false;
	const charKind = characterKinds[action.characterId] ?? "角色";
	if (charKind !== "角色" && charKind !== "忆灵") return false;
	return domainRanges.some(
		(r) =>
			r.casterId !== action.characterId &&
			action.actionValue >= r.startAV &&
			action.actionValue <= r.endAV,
	);
}

describe("Excel export: domain filtering", () => {
	const kinds: Record<string, string> = {
		phainon: "角色",
		sparkle: "角色",
		enemy: "敌人",
		aha: "阿哈",
	};

	it("keeps domain actions", () => {
		const actions: MinimalAction[] = [
			{
				key: "p-1",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "Q",
				isDomainAction: false,
			},
			{
				key: "p-domain-0",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "",
				isDomainAction: true,
			},
			{
				key: "p-domain-1",
				characterId: "phainon",
				actionNo: 2,
				actionValue: 120,
				skill: "",
				isDomainAction: true,
				isDomainFinalAction: true,
			},
		];
		const ranges = buildDomainRanges(actions);
		expect(isInsideDomain(actions[1], ranges, kinds)).toBe(false); // domain action kept
		expect(isInsideDomain(actions[2], ranges, kinds)).toBe(false); // domain final kept
	});

	it("hides ally actions inside domain range", () => {
		const actions: MinimalAction[] = [
			{
				key: "p-1",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "Q",
			},
			{
				key: "p-domain-0",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "",
				isDomainAction: true,
			},
			{
				key: "p-domain-1",
				characterId: "phainon",
				actionNo: 2,
				actionValue: 200,
				skill: "Q",
				isDomainAction: true,
				isDomainFinalAction: true,
			},
			{
				key: "s-1",
				characterId: "sparkle",
				actionNo: 1,
				actionValue: 150,
				skill: "E",
			}, // inside domain
		];
		const ranges = buildDomainRanges(actions);
		expect(isInsideDomain(actions[3], ranges, kinds)).toBe(true);
	});

	it("keeps enemy actions inside domain", () => {
		const actions: MinimalAction[] = [
			{
				key: "p-1",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "Q",
			},
			{
				key: "p-domain-0",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "",
				isDomainAction: true,
			},
			{
				key: "p-domain-1",
				characterId: "phainon",
				actionNo: 2,
				actionValue: 200,
				skill: "Q",
				isDomainAction: true,
				isDomainFinalAction: true,
			},
			{
				key: "e-1",
				characterId: "enemy",
				actionNo: 1,
				actionValue: 150,
				skill: "",
			},
		];
		const ranges = buildDomainRanges(actions);
		expect(isInsideDomain(actions[3], ranges, kinds)).toBe(false);
	});

	it("keeps Aha actions inside domain", () => {
		const actions: MinimalAction[] = [
			{
				key: "p-1",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "Q",
			},
			{
				key: "p-domain-0",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "",
				isDomainAction: true,
			},
			{
				key: "p-domain-1",
				characterId: "phainon",
				actionNo: 2,
				actionValue: 200,
				skill: "Q",
				isDomainAction: true,
				isDomainFinalAction: true,
			},
			{
				key: "aha-1",
				characterId: "aha",
				actionNo: 1,
				actionValue: 150,
				skill: "",
				isAhaInstant: true,
			},
		];
		const ranges = buildDomainRanges(actions);
		expect(isInsideDomain(actions[3], ranges, kinds)).toBe(false);
	});

	it("keeps ally actions outside domain range", () => {
		const actions: MinimalAction[] = [
			{
				key: "p-1",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "Q",
			},
			{
				key: "p-domain-0",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "",
				isDomainAction: true,
			},
			{
				key: "p-domain-1",
				characterId: "phainon",
				actionNo: 2,
				actionValue: 200,
				skill: "Q",
				isDomainAction: true,
				isDomainFinalAction: true,
			},
			{
				key: "s-1",
				characterId: "sparkle",
				actionNo: 1,
				actionValue: 50,
				skill: "E",
			}, // before domain
			{
				key: "s-2",
				characterId: "sparkle",
				actionNo: 2,
				actionValue: 250,
				skill: "E",
			}, // after domain
		];
		const ranges = buildDomainRanges(actions);
		expect(isInsideDomain(actions[3], ranges, kinds)).toBe(false); // before
		expect(isInsideDomain(actions[4], ranges, kinds)).toBe(false); // after
	});

	it("keeps domain caster's own actions", () => {
		const actions: MinimalAction[] = [
			{
				key: "p-1",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "Q",
			},
			{
				key: "p-domain-0",
				characterId: "phainon",
				actionNo: 1,
				actionValue: 100,
				skill: "",
				isDomainAction: true,
			},
			{
				key: "p-domain-1",
				characterId: "phainon",
				actionNo: 2,
				actionValue: 200,
				skill: "Q",
				isDomainAction: true,
				isDomainFinalAction: true,
			},
			{
				key: "p-2",
				characterId: "phainon",
				actionNo: 2,
				actionValue: 150,
				skill: "E",
			}, // Phainon's own action inside his domain
		];
		const ranges = buildDomainRanges(actions);
		expect(isInsideDomain(actions[3], ranges, kinds)).toBe(false);
	});

	it("handles multiple domain ranges", () => {
		// Two Phainons each with domains
		const actions: MinimalAction[] = [
			{
				key: "p1-1",
				characterId: "p1",
				actionNo: 1,
				actionValue: 100,
				skill: "Q",
			},
			{
				key: "p1-domain-0",
				characterId: "p1",
				actionNo: 1,
				actionValue: 100,
				skill: "",
				isDomainAction: true,
			},
			{
				key: "p1-domain-1",
				characterId: "p1",
				actionNo: 2,
				actionValue: 200,
				skill: "Q",
				isDomainAction: true,
				isDomainFinalAction: true,
			},
			{
				key: "p2-1",
				characterId: "p2",
				actionNo: 1,
				actionValue: 300,
				skill: "Q",
			},
			{
				key: "p2-domain-0",
				characterId: "p2",
				actionNo: 1,
				actionValue: 300,
				skill: "",
				isDomainAction: true,
			},
			{
				key: "p2-domain-1",
				characterId: "p2",
				actionNo: 2,
				actionValue: 400,
				skill: "Q",
				isDomainAction: true,
				isDomainFinalAction: true,
			},
			{
				key: "s-1",
				characterId: "sparkle",
				actionNo: 1,
				actionValue: 150,
				skill: "E",
			}, // inside p1 domain, outside p2
		];
		const ranges = buildDomainRanges(actions);
		expect(ranges.length).toBe(2);
		expect(isInsideDomain(actions[6], ranges, kinds)).toBe(true);
	});
});

describe("Excel export: action label formatting", () => {
	const prefixFor = (charId: string) => `${charId}-`;

	function actionLabel(key: string, charId: string): string {
		const tail = key.slice(prefixFor(charId).length);
		const domainMatch = tail.match(/^domain-(\d+)/);
		if (domainMatch) return `境界${Number(domainMatch[1]) + 1}`;
		const interruptMatch = tail.match(/^interrupt-(\d+)/);
		if (interruptMatch) return `插队#${Number(interruptMatch[1]) + 1}`;
		const no = Number.parseInt(tail, 10);
		return Number.isFinite(no) && no > 0 ? `第${no}动` : tail;
	}

	it("formats normal action", () => {
		expect(actionLabel("c1-1", "c1")).toBe("第1动");
		expect(actionLabel("c1-3", "c1")).toBe("第3动");
	});

	it("formats domain action", () => {
		expect(actionLabel("c1-domain-0", "c1")).toBe("境界1");
		expect(actionLabel("c1-domain-5", "c1")).toBe("境界6");
	});

	it("formats interrupt action", () => {
		expect(actionLabel("c1-interrupt-0", "c1")).toBe("插队#1");
	});

	it("falls back to tail for unrecognized", () => {
		expect(actionLabel("c1-q", "c1")).toBe("q");
	});
});
