import { describe, expect, it } from "vitest";
import { simulateElationTeam } from "../../../src/damage/elationTeam";
import {
	defaultElationTeamConfig,
	normalizeElationTeamConfig,
	resolveElationAhaBaseSpeed,
} from "../../../src/damage/elationTypes";
import type { EquipmentProfile } from "../../../src/damage/equipment";
import { silverWolfBoxProbabilities } from "../../../src/damage/silverWolfBox";
import { createTarget } from "../../../src/utils/action-sequence";

const profiles = () =>
	["银狼LV.999", "爻光", "欢愉主", "藿藿"].map(
		(name, i): EquipmentProfile => ({
			character: {
				...createTarget(String(i), i),
				name,
				speed: "100",
				eidolon: [2, 1, 6, 1][i],
				lc_id: [23057, 21064, 21064, 21007][i],
				superimpose: i === 0 ? 1 : 5,
				techniqueOn: false,
			},
			level: 80,
			hp: 5000,
			elation: 0,
			effectRes: 0,
			damageBonuses: {},
			baseAttack: 1000,
			attack: 2000,
			speed: 100,
			critRate: 0.5,
			critDamage: 1,
			physicalBonus: 0,
			windBonus: 0,
			gear: {
				sets: {},
				enhanced: i === 3,
				skillLevel: 10,
				ultimateLevel: 10,
				talentLevel: 10,
				breakEffect: 0,
				energyRegen: 0.2,
				initialEnergy: 0,
				ultimateCost: [60, 180, 160, 140][i],
			},
		}),
	);
describe("Elation team event accounting", () => {
	it.each([
		[2, 160, 40, 5],
		[1, 180, 63, 8],
	])("isolates actor %i Q resource contract", (index, energy, expected, jokes) => {
		const p = profiles();
		p[index].gear.initialEnergy = energy;
		const config = {
			...defaultElationTeamConfig,
			enabled: true,
			profiles: p,
			limit: 1,
			wolfUltMinScore: 300,
			wolfUltRushWindow: 0,
		};
		const result = simulateElationTeam(config);
		expect(result.rows.at(-1)?.hidden).toBe(expected);
		expect(result.rows.at(-1)?.jokes).toBe(jokes);
		expect(
			result.rows
				.flatMap((r) => r.energyEvents)
				.filter((e) => e.fixed && e.amount === 10),
		).toHaveLength(index === 1 ? 1 : 0);
		const events = result.rows.flatMap((r) => r.resourceEvents);
		expect(
			events
				.filter((e) => e.kind === "hidden")
				.reduce((n, e) => n + e.amount, 0),
		).toBe(expected);
	});
	it("spends Q cost before mode growth and migrates obsolete saved resource rules", () => {
		for (const rule of ["user35_55", "metadata4_6_54", undefined])
			expect(
				normalizeElationTeamConfig({
					...defaultElationTeamConfig,
					resourceAccountingRule: rule,
				})?.resourceAccountingRule,
			).toBe("qCost60");
		const result = simulateElationTeam({
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(),
			limit: 1000,
		});
		for (const q of result.rows.filter(
			(r) => r.actor === "银狼LV.999" && r.skill === "Q",
		)) {
			const cost = q.resourceEvents.find(
				(e) => e.source === "银狼Q消耗60隐藏分",
			);
			expect(cost?.amount).toBe(-60);
			expect(q.hidden).toBe(
				q.resourceEvents
					.filter((e) => e.kind === "hidden")
					.reduce((n, e) => n + e.amount, cost?.before ?? 0),
			);
			expect(result.cycles[q.cycle - 1].entryHidden).toBe(cost?.before);
			expect(q.cycleScore).toBe(q.hidden);
		}
		expect(
			result.rows.some((r) =>
				r.resourceEvents.some((e) => e.source === "银狼Q消耗60隐藏分"),
			),
		).toBe(true);
	});

	it("S1 seer cone gives fixed opening energy, conditional regeneration and team crit", () => {
		const p = profiles();
		p[1].character.lc_id = 23054;
		p[1].character.superimpose = 1;
		const config = {
			...defaultElationTeamConfig,
			enabled: true,
			profiles: p,
			limit: 110,
			wolfUltMinScore: 300,
			wolfUltRushWindow: 0,
		};
		const r = simulateElationTeam(config);
		const opening = r.rows.find((r) => r.skill === "开场");
		expect(opening?.energy.爻光).toBe(15);
		const enemy = r.rows.find((r) => r.skill === "敌方群攻");
		expect(
			enemy?.energyEvents.find(
				(e) => e.actor === "爻光" && e.source === "敌方群攻受击回能",
			)?.amount,
		).toBeCloseTo(13.2);
		const mc = r.rows.find((r) => r.actor === "欢愉主" && r.kind === "normal");
		expect(mc?.factors?.critRate).toBeCloseTo(0.75);
		const old = simulateElationTeam({
			...config,
			profiles: profiles(),
		}).rows.find((r) => r.actor === "欢愉主" && r.kind === "normal");
		expect(
			(mc?.factors?.critDamage ?? 0) - (old?.factors?.critDamage ?? 0),
		).toBeCloseTo(0.3);
	});

	it("simulates Sparxie with inherited pity, SP/boom costs, signature and E2 extra turns", () => {
		const p = profiles();
		p[2].character.name = "火花";
		p[2].character.eidolon = 2;
		p[2].character.lc_id = 23053;
		p[2].character.superimpose = 1;
		p[2].gear.ultimateCost = 160;
		p[2].speed = 500;
		const config = {
			...defaultElationTeamConfig,
			enabled: true,
			profiles: p,
			limit: 300,
			sparxieJackpotTarget: 3 as const,
		};
		const r = simulateElationTeam(config);
		const draws = r.rows.filter((row) => row.sparxieLottery);
		expect(draws.length).toBeGreaterThan(10);
		let lastPity = 4,
			previous: (typeof draws)[number]["sparxieLottery"];
		for (const row of draws) {
			const d = row.sparxieLottery;
			if (!d) throw new Error("Missing lottery draw");
			const before =
				d.state.draws === 1
					? { pity: lastPity, jackpotsLeft: 3, smallPrizesLeft: 25 }
					: previous?.state;
			if (!before) throw new Error("Missing previous draw");
			expect(d.probability).toBeCloseTo(
				before.pity === 6 && before.jackpotsLeft > 0
					? 1
					: before.jackpotsLeft /
							(before.jackpotsLeft + before.smallPrizesLeft),
			);
			expect(d.state.draws).toBeLessThanOrEqual(20);
			expect(d.state.jackpotsLeft).toBe(3 - d.state.jackpots);
			expect(d.state.smallPrizesLeft).toBe(
				25 - d.state.draws + d.state.jackpots,
			);
			lastPity = d.state.pity;
			previous = d;
		}
		expect(draws[0].buffs.some((b) => b.startsWith("火花E2"))).toBe(false);
		expect(
			draws.some((row) =>
				row.resourceEvents.some(
					(e) => e.kind === "sparxieBoom" && e.amount === -1,
				),
			),
		).toBe(true);
		expect(
			r.rows.every(
				(row) => row.sp >= 0 && row.sp <= 8 && (row.sparxieBooms ?? 0) >= 0,
			),
		).toBe(true);
		expect(
			r.rows.some(
				(row) => row.actor === "火花" && row.detail === "E2额外回合结算完成",
			),
		).toBe(true);
		expect(
			r.rows.some(
				(row) => row.actor === "火花" && row.detail === "火花欢愉技·弹射",
			),
		).toBe(true);
		expect(
			r.rows.some((row) => row.actor === "火花" && row.skill === "Q"),
		).toBe(true);
		const energy = r.rows
			.flatMap((row) => row.energyEvents)
			.filter((e) => e.actor === "火花");
		expect(energy.some((e) => e.base === 40 && !e.fixed)).toBe(true);
		expect(energy.some((e) => e.base === 30 && e.source === "技能回能")).toBe(
			false,
		);
		expect(r.total).toBe(simulateElationTeam(config).total);
	});

	it("reconciles resource deltas, keeps ordinary MC talent, and samples probabilities from the pre-reward state", () => {
		const result = simulateElationTeam({
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(),
			limit: 1000,
		});
		const events = result.rows.flatMap((r) => r.resourceEvents);
		for (const kind of ["hidden", "jokes"] as const)
			expect(
				events.filter((e) => e.kind === kind).reduce((n, e) => n + e.amount, 0),
			).toBe(result.rows.at(-1)?.[kind]);
		expect(
			events.some((e) => e.source.includes("普通攻击产笑") && e.amount === 3),
		).toBe(true);
		const boxes = result.rows.filter((r) => r.boxBranch && !r.boxForced);
		expect(boxes.length).toBeGreaterThan(0);
		for (const row of boxes) {
			if (!row.boxContext) throw new Error("Missing pre-box state");
			const p = silverWolfBoxProbabilities(row.boxContext);
			expect(row.boxProbabilities).toEqual([p.sword, p.sp, p.beans]);
		}
		const forced = result.rows.filter((r) => r.boxForced);
		expect(
			forced.every(
				(r) => r.boxBranch === "beans" && r.boxProbabilities === undefined,
			),
		).toBe(true);
	});

	it("migrates old weights and enforces the configured hidden-score cap", () => {
		const normalized = normalizeElationTeamConfig({
			...defaultElationTeamConfig,
			boxWeights: [9, 0, 0],
			boxProbabilityModel: "equal",
		});
		expect(normalized?.boxProbabilityModel).toBe("resourceDependentV1");
		expect(normalized).not.toHaveProperty("boxWeights");
		const result = simulateElationTeam({
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(),
			limit: 1000,
			hiddenScoreCap: 120,
			wolfUltMinScore: 120,
		});
		expect(result.rows.every((r) => r.hidden <= 120)).toBe(true);
		expect(result.rows.some((r) => r.hidden === 120)).toBe(true);
		expect(
			result.rows
				.filter((r) => r.boxContext)
				.every((r) => r.boxContext?.hiddenCap === 120),
		).toBe(true);
	});

	it("does not award free actions before their timers or give ordinary energy to Silver Wolf", () => {
		const config = {
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(),
			limit: 80,
		};
		const result = simulateElationTeam(config);
		expect(result.total).toBe(0);
		const enemy = result.rows.find((r) => r.skill === "敌方群攻");
		expect(enemy?.av).toBeCloseTo(10000 / 132);
		expect(enemy?.energy.藿藿).toBeCloseTo(48);
		expect(enemy?.energy.欢愉主).toBeCloseTo(12);
		expect(Object.keys(enemy?.energy ?? {})).not.toContain("银狼LV.999");
		expect(
			enemy?.energyEvents
				.filter((e) => e.source === "敌方群攻受击回能")
				.map((e) => e.amount),
		).toEqual([12, 12, 12]);
	});
	it("keeps fixed energy unscaled, caps SP/hidden score, copies true damage once and is seed reproducible", () => {
		const p = profiles();
		const config = {
			...defaultElationTeamConfig,
			enabled: true,
			profiles: p,
			limit: 300,
		};
		const result = simulateElationTeam(config);
		expect(result.total).toBe(simulateElationTeam(config).total);
		expect(
			result.rows.every(
				(r) => r.sp >= 0 && r.sp <= 5 && r.hidden >= 0 && r.hidden <= 300,
			),
		).toBe(true);
		const fixed = result.rows
			.flatMap((r) => r.energyEvents)
			.filter((e) => e.source.includes("固定回能"));
		expect(fixed.length).toBeGreaterThan(0);
		expect(fixed.every((e) => e.fixed && e.amount === 10)).toBe(true);
		const swords = result.rows.filter((r) => r.kind === "true");
		expect(swords.length).toBeGreaterThan(0);
		swords.forEach((row) => {
			const index = result.rows.indexOf(row);
			expect(row.expected).toBeCloseTo(result.rows[index - 1].expected * 0.2);
		});
		expect(
			result.rows
				.filter((r) => r.kind === "elation")
				.every((r) => r.factors?.damageBonus === 0),
		).toBe(true);
		expect(result.rows.map((r) => r.av)).toEqual(
			result.rows.map((r) => r.av).sort((a, b) => a - b),
		);
	});
	it("a strict banking threshold is respected and makes the second E2 extra available before exit", () => {
		const config = {
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(),
			limit: 1000,
			wolfUltMinScore: 200,
		};
		const result = simulateElationTeam(config);
		expect(result.cycles.length).toBeGreaterThan(0);
		expect(result.cycles.every((c) => c.entryHidden >= 200)).toBe(true);
		const closed = result.cycles.filter((c) => c.end !== undefined);
		expect(closed.length).toBeGreaterThan(0);
		const exits = result.rows.filter((r) => r.skill === "退场");
		for (const row of exits) {
			const before = result.cycles[row.cycle - 1].exitHidden;
			if (before === undefined) throw new Error("Missing exit score");
			expect(row.hidden).toBe(Math.floor(before * 0.2));
		}
		expect(result.rows.every((r) => Number.isInteger(r.hidden))).toBe(true);

		expect(
			closed.every((c) => c.hit240 && c.usedExtras >= 2 && c.basics >= 5),
		).toBe(true);
		expect(result.rows.every((r) => r.av <= 1000)).toBe(true);
	});
	it("allows a final-window release without lowering the threshold earlier in the fight", () => {
		const config = {
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(),
			limit: 300,
			wolfUltMinScore: 300,
			wolfUltRushWindow: 50,
		};
		const result = simulateElationTeam(config);
		expect(result.cycles.length).toBeGreaterThan(0);
		expect(
			result.cycles.every((c) => c.start >= 250 || c.entryHidden >= 300),
		).toBe(true);
	});
	it("the party-only base-speed rule never uses an owned-but-absent star", () => {
		const config = {
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(),
		};
		expect(
			resolveElationAhaBaseSpeed({
				...config,
				ahaBaseSpeedRule: "starInParty",
			}),
		).toBe(80);
		expect(
			simulateElationTeam({ ...config, ahaBaseSpeedRule: "starInParty" }),
		).toEqual(simulateElationTeam(config));
		const withStar = {
			...config,
			profiles: config.profiles.map((p, i) =>
				i === 0
					? { ...p, character: { ...p.character, name: "星神⭐阿哈" } }
					: p,
			),
		};
		expect(
			resolveElationAhaBaseSpeed({
				...withStar,
				ahaBaseSpeedRule: "starInParty",
			}),
		).toBe(94);
		expect(
			resolveElationAhaBaseSpeed({ ...withStar, ahaBaseSpeedRule: "fixed80" }),
		).toBe(80);
	});
});
