import { describe, expect, it } from "vitest";
import {
	buildExportNameMap,
	CHARACTER_EXPORT_HEADERS,
	getExportDisplayName,
	getLightConeDisplayName,
} from "../../../src/utils/excelExport";

// 导出逻辑嵌在依赖多个上下文的组件中。
// 这里复制算法，直接测试其中的纯过滤逻辑。

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
		expect(isInsideDomain(actions[1], ranges, kinds)).toBe(false); // 保留境界行动。
		expect(isInsideDomain(actions[2], ranges, kinds)).toBe(false); // 保留境界终结行动。
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
			}, // 境界内部。
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
			}, // 境界之前。
			{
				key: "s-2",
				characterId: "sparkle",
				actionNo: 2,
				actionValue: 250,
				skill: "E",
			}, // 境界之后。
		];
		const ranges = buildDomainRanges(actions);
		expect(isInsideDomain(actions[3], ranges, kinds)).toBe(false); // 之前。
		expect(isInsideDomain(actions[4], ranges, kinds)).toBe(false); // 之后。
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
			}, // 白厄在自身境界内的行动。
		];
		const ranges = buildDomainRanges(actions);
		expect(isInsideDomain(actions[3], ranges, kinds)).toBe(false);
	});

	it("handles multiple domain ranges", () => {
		// 两个白厄各自拥有一个境界。
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
			}, // 位于 p1 境界内、p2 境界外。
		];
		const ranges = buildDomainRanges(actions);
		expect(ranges.length).toBe(2);
		expect(isInsideDomain(actions[6], ranges, kinds)).toBe(true);
	});
});

describe("Excel export: display names", () => {
	it("角色配置只保留网页需要的七列", () => {
		expect(CHARACTER_EXPORT_HEADERS).toEqual([
			"角色",
			"速度",
			"基础速度",
			"光锥",
			"翁瓦克",
			"风套",
			"信使套",
		]);
	});

	it("uses names for characters, memosprites, and generated actions", () => {
		const names = buildExportNameMap(
			[{ id: "aglaea", name: "阿格莱雅" }],
			[{ id: "aglaea-garmentmaker", name: "衣匠" }],
			[{ characterId: "@aha", displayName: "阿哈时刻" }],
		);

		expect(getExportDisplayName(names, "aglaea", "未知角色")).toBe("阿格莱雅");
		expect(getExportDisplayName(names, "aglaea-garmentmaker", "未知目标")).toBe(
			"衣匠",
		);
		expect(getExportDisplayName(names, "@aha", "未知角色")).toBe("阿哈时刻");
		expect(getExportDisplayName(names, "unknown-id", "未知目标")).toBe(
			"未知目标",
		);
	});

	it("formats lightcone names without exposing IDs", () => {
		expect(getLightConeDisplayName(0)).toBe("无光锥");
		expect(getLightConeDisplayName(21018)).toBe("舞！舞！舞！");
		expect(getLightConeDisplayName(99999)).toBe("未知光锥");
	});
});
