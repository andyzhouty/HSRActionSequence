import { describe, expect, it } from "vitest";
import {
	type SimulateActionsInput,
	simulateActions,
} from "../../src/simulate/actions";
import type {
	CharacterConfig,
	SkillCode,
} from "../../src/utils/actionSequence";

function character(
	id: string,
	name: string,
	speed: number,
	overrides: Partial<CharacterConfig> = {},
): CharacterConfig {
	return {
		id,
		kind: "角色",
		name,
		speed: String(speed),
		baseSpeed: String(speed),
		hasVonwacq: false,
		hasWindSet: false,
		hasDance: false,
		eidolon: 0,
		superimpose: 1,
		lc_id: 0,
		...overrides,
	};
}

function skills(entries: Record<string, string>): Record<string, SkillCode> {
	return entries;
}

function input(
	overrides: Partial<SimulateActionsInput> = {},
): SimulateActionsInput {
	return {
		characters: [],
		limit: 500,
		overrides: {},
		skillOverrides: {},
		domainEndOverrides: {},
		legacyUltOverrides: {},
		speedAdjustments: {},
		skillTargets: {},
		defaultSkillTargets: {},
		odeSelections: {},
		memeSelections: {},
		ultInterrupts: {},
		fireflyBreakCounters: {},
		godmodeExtraActions: {},
		...overrides,
	};
}

function firstAhaSkills(actions: ReturnType<typeof simulateActions>) {
	const aha = actions.find((a) => a.isAhaInstant);
	if (!aha) return [];
	return actions.filter(
		(a) => a.isElationSkill && a.elationSkillParentKey === aha.key,
	);
}

// ─── 欢愉技（Elation Skill） ───

describe("Elation Skill (欢愉技)", () => {
	it("阿哈时刻发生时，全队欢愉角色按参演编号依次释放欢愉技", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("yaoguang", "爻光", 160), // 116
					character("sparxie", "火花", 150), // 144
				],
				limit: 200,
			}),
		);
		const aha = acts.find((a) => a.isAhaInstant);
		expect(aha).toBeDefined();
		expect(aha!.hasElationSkills).toBe(true);

		const skills = firstAhaSkills(acts);
		expect(skills.length).toBe(2);
		expect(skills[0].characterId).toBe("yaoguang");
		expect(skills[1].characterId).toBe("sparxie");
		for (const es of skills) {
			expect(es.actionValue).toBe(aha!.actionValue);
			expect(es.skill).toBe("ES");
			expect(es.lockedSkill).toBe(true);
		}
	});

	it("多欢愉角色按参演编号排序", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("silverwolf", "银狼LV.999", 999), // 999
					character("emc", "欢愉主", 120), // 120
					character("sparxie", "火花", 144), // 144
					character("evanescia", "绯英", 146), // 146
					character("yaoguang", "爻光", 116), // 116
				],
				limit: 200,
			}),
		);
		const skills = firstAhaSkills(acts);
		expect(skills.length).toBe(5);
		expect(skills[0].characterId).toBe("yaoguang"); // 116
		expect(skills[1].characterId).toBe("emc"); // 120
		expect(skills[2].characterId).toBe("sparxie"); // 144
		expect(skills[3].characterId).toBe("evanescia"); // 146
		expect(skills[4].characterId).toBe("silverwolf"); // 999
	});

	it("无欢愉角色时不产生欢愉技", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("a", "停云", 100),
					character("b", "布洛妮娅", 80),
				],
				limit: 200,
			}),
		);
		expect(acts.filter((a) => a.isElationSkill).length).toBe(0);
	});
});

// ─── 欢愉主 Q ───

describe("Elation Trailblazer Q (欢愉主 Q)", () => {
	it("Q 对非欢愉目标拉条 50%，不超过 Q 的 AV", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("emc", "欢愉主", 100),
					character("target", "布洛妮娅", 80),
				],
				skillOverrides: skills({ "emc-1": "AQ" }),
				skillTargets: { "emc-1": "target" },
				limit: 300,
			}),
		);
		const qAV = acts.find((a) => a.key === "emc-1")!.actionValue;
		const target = acts.find(
			(a) => a.characterId === "target" && a.key === "target-1",
		);
		expect(target).toBeDefined();
		// target 原定 125, 拉条 50% → max(100, 125-62.5) = 100
		expect(target!.actionValue).toBeCloseTo(qAV, 4);
	});

	it("Q 拉条不会越过当前 AV（target 原 AV < Q AV）", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("emc", "欢愉主", 200), // AV=50
					character("target", "布洛妮娅", 100), // AV=100
				],
				skillOverrides: skills({ "emc-1": "AQ" }),
				skillTargets: { "emc-1": "target" },
				limit: 300,
			}),
		);
		const qAV = acts.find((a) => a.characterId === "emc")!.actionValue;
		const target = acts.find(
			(a) => a.characterId === "target" && a.key === "target-1",
		);
		expect(target).toBeDefined();
		expect(target!.actionValue).toBeGreaterThanOrEqual(qAV);
	});

	it("Q 对欢愉目标 → 立即释放欢愉技", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("emc", "欢愉主", 200),
					character("sparxie", "火花", 150),
				],
				skillOverrides: skills({ "emc-1": "AQ" }),
				skillTargets: { "emc-1": "sparxie" },
				limit: 300,
			}),
		);
		const qAV = acts.find((a) => a.key === "emc-1")!.actionValue;
		const sparxieES = acts.find(
			(a) =>
				a.isElationSkill &&
				a.characterId === "sparxie" &&
				a.elationSkillParentKey !== "@aha-1",
		);
		expect(sparxieES).toBeDefined();
		expect(sparxieES!.actionValue).toBeCloseTo(qAV, 4);
		expect(sparxieES!.skill).toBe("ES");
		expect(sparxieES!.key).toContain("elation");
	});

	it("欢愉技技能代码固定为 ES 且锁定", () => {
		const acts = simulateActions(
			input({
				characters: [character("sparxie", "火花", 160)],
				limit: 200,
			}),
		);
		for (const es of acts.filter((a) => a.isElationSkill)) {
			expect(es.skill).toBe("ES");
			expect(es.lockedSkill).toBe(true);
		}
	});
});

// ─── 欢愉技与龙灵 ───

describe("Elation Skill + Souldragon", () => {
	it("火花同袍时，阿哈时刻欢愉技推进龙灵", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("dhpt", "丹恒·腾荒", 100),
					character("sparxie", "火花", 900),
				],
				bondmateTarget: "sparxie",
				attackDisabled: {
					"sparxie-1": true,
					"sparxie-2": true,
					"sparxie-3": true,
					"sparxie-4": true,
				},
				limit: 150,
			}),
		);
		const sd = acts.filter((a) => a.isSouldragonAction);
		expect(sd.length).toBeGreaterThan(0);
		// 阿哈在龙灵首动(60.6)前触发，应推进龙灵
		expect(sd[0].actionValue).toBeLessThan(10000 / 165);
	});

	it("SP银狼非无敌时，A 仍固定推进龙灵", () => {
		const acts = simulateActions(
			input({
				characters: [
					character("dhpt", "丹恒·腾荒", 100),
					character("silverwolf", "银狼LV.999", 900),
				],
				bondmateTarget: "silverwolf",
				attackDisabled: {
					"silverwolf-1": true,
					"silverwolf-2": true,
					"silverwolf-3": true,
					"silverwolf-4": true,
				},
				limit: 150,
			}),
		);
		const sd = acts.filter((a) => a.isSouldragonAction);
		expect(sd.length).toBeGreaterThan(0);
		// 无敌玩家外的 A 固定视为攻击，旧关闭项不能阻止其推进龙灵。
		expect(sd[0].actionValue).toBeCloseTo(10000 / 300, 4);
	});
});
