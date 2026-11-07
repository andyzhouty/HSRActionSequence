import { describe, expect, it } from "vitest";
import { simulateElationTeam } from "../../../src/damage/elationTeam";
import { defaultElationTeamConfig } from "../../../src/damage/elationTypes";
import type { EquipmentProfile } from "../../../src/damage/equipment";
import { applyAhaDebt } from "../../../src/damage/starAhaDamage";
import { createTarget } from "../../../src/utils/action-sequence";

const profiles = (starRank = 0, withMc = false): EquipmentProfile[] =>
	["银狼LV.999", withMc ? "欢愉主" : "爻光", "虚照", "藿藿"].map((name, i) => ({
		character: {
			...createTarget(String(i), i),
			name,
			speed: "180",
			eidolon: [2, withMc ? 6 : 1, starRank, 1][i],
			lc_id: [23057, 21064, 23065, 21007][i],
			superimpose: i === 1 || i === 3 ? 5 : 1,
			techniqueOn: true,
		},
		level: 80,
		baseSpeed: i === 2 ? 106 : 100,
		speed: 180,
		hp: 5000,
		attack: 2500,
		baseAttack: 1000,
		critRate: 0.5,
		critDamage: 1,
		elation: 0.2,
		effectRes: 0,
		damageBonuses: {},
		physicalBonus: 0,
		windBonus: 0,
		gear: {
			sets: {},
			enhanced: i === 3,
			skillLevel: i === 2 && starRank >= 5 ? 12 : 10,
			ultimateLevel: i === 2 && starRank >= 3 ? 12 : 10,
			talentLevel: i === 2 && starRank >= 5 ? 12 : 10,
			breakEffect: 0,
			energyRegen: 0.2,
			initialEnergy: i === 2 ? 8 : 0,
			ultimateCost: [60, withMc ? 160 : 180, 8, 140][i],
		},
	}));

describe("star Aha / Xuzhao damage", () => {
	it("treats debt as occupied maximum HP rather than extra damage", () => {
		const after = applyAhaDebt(
			{ maxHp: 1000, currentHp: 1000, debt: 0 },
			100,
			0.25,
			0.1,
		);
		expect(after.state).toEqual({ maxHp: 1000, currentHp: 900, debt: 25 });
		expect(after.hpLoss).toBe(0);
		const initial = applyAhaDebt(
			{ maxHp: 1000, currentHp: 1000, debt: 0 },
			0,
			0.25,
			0.1,
			0.2,
		);
		expect(initial.state.currentHp).toBe(800);
		expect(initial.hpLoss).toBe(200);
		const later = applyAhaDebt(initial.state, 100, 0.25, 0.1, 0.2);
		expect(later.state.debt).toBe(200);
		expect(later.hpLoss).toBe(0);
	});
	it.each([
		0, 2, 4, 6,
	])("runs E%i wishes, ascension and exact once-only true damage", (rank) => {
		const config = {
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(rank),
			limit: 300,
			ahaBaseSpeedRule: "starInParty" as const,
			enemyMaxHp: 100000000,
		};
		const r = simulateElationTeam(config);
		expect(r.ahaBaseSpeed).toBe(106);
		expect(
			r.rows.every(
				(row) =>
					row.starWill !== undefined &&
					row.starWill >= 0 &&
					row.starWill <= 10 &&
					Number.isInteger(row.hidden),
			),
		).toBe(true);
		expect(
			r.rows.every((row) => !Object.keys(row.energy).includes("虚照")),
		).toBe(true);
		expect(
			r.rows.flatMap((row) => row.energyEvents).some((e) => e.actor === "虚照"),
		).toBe(false);
		const truths = r.rows.filter((row) => row.starTrueBase !== undefined);
		expect(truths.length).toBeGreaterThan(0);
		for (const row of truths) {
			expect(row.expected).toBeCloseTo(
				(row.starTrueBase ?? 0) * (row.starTrueRatio ?? 0),
				6,
			);
			expect(row.starTrueRatio).toBeCloseTo(rank >= 4 ? 0.25 : 0.2);
		}
		expect(
			r.rows.some(
				(row) =>
					row.starUniverseTurns && row.hiddenCap === (rank >= 2 ? 999 : 360),
			),
		).toBe(true);
		expect(
			r.rows.some((row) =>
				row.resourceEvents.some((e) => e.source === "虚照升格·爽点回收"),
			),
		).toBe(true);
		expect(
			r.rows.some((row) =>
				row.resourceEvents.some((e) => e.source === "令使回合开始"),
			),
		).toBe(true);
		expect(
			r.rows.some((row) =>
				row.resourceEvents.some((e) => e.source === "虚照专锥·对队友施放E"),
			),
		).toBe(true);
		for (const row of r.rows.filter((row) => row.skill === "ES真伤")) {
			const index = r.rows.indexOf(row);
			let start = index;
			while (start >= 0 && r.rows[start].skill !== "阿哈时刻") start--;
			expect(start).toBeGreaterThanOrEqual(0);
			const total = r.rows
				.slice(start, index)
				.filter((row) => row.kind !== "true")
				.reduce((n, row) => n + row.expected, 0);
			expect(row.starTrueBase).toBeCloseTo(total, 6);
		}
		if (rank === 6) expect(r.rows.at(-1)?.starDebtHpLoss).toBe(20000000);
		const events = r.rows.flatMap((row) => row.resourceEvents);
		let consumed = 0;
		for (const event of events) {
			if (event.source === "常规阿哈结束消耗共享笑点") consumed = -event.amount;
			if (event.source === "虚照升格·爽点回收")
				expect(event.requested).toBeCloseTo(consumed * 0.1);
		}
		expect(
			events
				.filter((e) => e.kind === "starWill")
				.reduce((n, e) => n + e.amount, 0),
		).toBe(r.rows.at(-1)?.starWill);
		expect(simulateElationTeam(config).total).toBe(r.total);
	});
	it("splits the true-damage total across multiple targets without multiplying it twice", () => {
		const r = simulateElationTeam({
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(),
			limit: 150,
			enemyCount: 3,
		});
		const truths = r.rows.filter((row) => row.starTrueBase !== undefined);
		expect(truths.length).toBeGreaterThan(0);
		truths.forEach((row) => {
			expect(row.expected).toBeCloseTo((row.starTrueBase ?? 0) * 0.2);
		});
	});

	it("uses the boosted MC skill, not the whole moment, as MC-triggered true-damage base", () => {
		const r = simulateElationTeam({
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(2, true),
			limit: 300,
		});
		const rows = r.rows.filter((row) => row.detail.includes("主角升格ES"));
		expect(rows.length).toBeGreaterThan(0);
		for (const row of rows) {
			expect(row.expected).toBeCloseTo((row.starTrueBase ?? 0) * 0.2);
			const index = r.rows.indexOf(row);
			const mc = r.rows
				.slice(0, index)
				.findLast((row) => row.detail === "欢愉主欢愉技");
			expect(row.starTrueBase).toBeCloseTo(mc?.expected ?? 0);
		}
	});
});
