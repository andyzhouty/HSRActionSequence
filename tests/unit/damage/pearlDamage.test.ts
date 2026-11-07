import { expect, it } from "vitest";
import { simulateElationTeam } from "../../../src/damage/elationTeam";
import { defaultElationTeamConfig } from "../../../src/damage/elationTypes";
import type { EquipmentProfile } from "../../../src/damage/equipment";
import { calculateDamage } from "../../../src/damage/formula";
import {
	consumePearlResistance,
	pearlDefenseElation,
	pearlExtraReward,
} from "../../../src/damage/pearlDamage";
import { createTarget } from "../../../src/utils/action-sequence";

const profiles = (rank = 2, star = false): EquipmentProfile[] =>
	["银狼LV.999", "爻光", "真珠", star ? "虚照" : "火花"].map((name, i) => ({
		character: {
			...createTarget(String(i), i),
			name,
			speed: "150",
			eidolon: [2, 1, rank, star ? 2 : 2][i],
			lc_id: [23057, 21064, 21064, star ? 23065 : 23053][i],
			superimpose: i === 1 || i === 2 ? 5 : 1,
			techniqueOn: true,
		},
		level: 80,
		speed: 150,
		baseSpeed: 100,
		hp: 5000,
		baseDefense: 1000,
		defense: 3000,
		attack: 1000,
		baseAttack: 500,
		critRate: 0.5,
		critDamage: 1,
		physicalBonus: 0,
		windBonus: 0,
		elation: 0.2,
		effectRes: 0,
		damageBonuses: {},
		gear: {
			sets: {},
			enhanced: false,
			skillLevel: i === 2 && rank >= 5 ? 12 : 10,
			ultimateLevel: i === 2 && rank >= 3 ? 12 : 10,
			talentLevel: i === 2 && rank >= 5 ? 12 : 10,
			breakEffect: 0,
			energyRegen: 0.2,
			initialEnergy: i === 2 ? 180 : i === 3 && star ? 8 : 0,
			ultimateCost: [60, 180, 180, star ? 8 : 160][i],
		},
	}));
it("converts defense and computes E2 and ascended temporary rewards", () => {
	expect(pearlDefenseElation(2399)).toBe(0);
	expect(pearlDefenseElation(2400)).toBe(0.32);
	expect(pearlDefenseElation(2500)).toBeCloseTo(0.35);
	expect(pearlDefenseElation(6000)).toBeCloseTo(1.4);
	expect(pearlDefenseElation(9000)).toBeCloseTo(1.4);
	expect(pearlExtraReward(0, 10, 0)).toEqual({
		jokes: 60,
		applause: 30,
		keepApplause: 0,
		keepJokes: 0,
	});
	expect(pearlExtraReward(2, 10, 2)).toEqual({
		jokes: 120,
		applause: 60,
		keepApplause: 0.2,
		keepJokes: 0.2,
	});
	expect(consumePearlResistance(50, 4000)).toEqual({
		points: 38,
		absorbed: 2400,
		remainingDamage: 1600,
	});
	expect(consumePearlResistance(1, 1000)).toEqual({
		points: 0,
		absorbed: 200,
		remainingDamage: 800,
	});
});
it("floors every joke change before hidden-score conversion and does not carry refund fractions", () => {
	const r = simulateElationTeam({
		...defaultElationTeamConfig,
		enabled: true,
		profiles: profiles(6, true),
		limit: 500,
	});
	const events = r.rows.flatMap((row) => row.resourceEvents);
	const laughs = events.filter((e) => e.kind === "jokes");
	expect(
		laughs.some(
			(e) => e.source === "虚照升格·爽点回收" && !Number.isInteger(e.requested),
		),
	).toBe(true);
	expect(r.rows.every((row) => Number.isInteger(row.jokes))).toBe(true);
	for (const e of laughs) {
		expect([e.before, e.after, e.amount].every(Number.isInteger)).toBe(true);
		expect(e.after).toBe(Math.floor(Math.max(0, e.before + e.requested)));
		if (e.source === "虚照升格·爽点回收") {
			const hidden = events.find(
				(h) =>
					h.kind === "hidden" &&
					h.id > e.id &&
					h.source === `${e.source}→银狼天赋等量隐藏分`,
			);
			expect(hidden?.requested).toBe(e.amount);
		}
	}
});
it.each([
	false,
	true,
])("cleans Pearl temporary resources before Q checks, ascended=%s", (star) => {
	const r = simulateElationTeam({
		...defaultElationTeamConfig,
		enabled: true,
		profiles: profiles(2, star),
		limit: 300,
	});
	const cleanup = r.rows.filter((row) => row.skill === "额外回合结束");
	expect(cleanup.length).toBeGreaterThan(0);
	for (const row of cleanup) {
		expect(row.pearlTemporaryJokes).toBe(120);
		expect(row.pearlTemporaryApplause).toBe(60);
		const event = row.resourceEvents.find(
			(e) => e.source === "真珠额外回合结束·移除临时笑点",
		);
		expect(event?.amount).toBeCloseTo(row.starUniverseTurns ? -96 : -120);
	}
	expect(r.rows.every((row) => !row.pearlExtraTurn || row.skill !== "Q")).toBe(
		true,
	);
	expect(
		r.rows.every(
			(row) =>
				(row.pearlApplause ?? 0) <=
				((row.starUniverseTurns ?? 0) > 0 ? 75 : 50),
		),
	).toBe(true);
	expect(
		r.rows.some((row) =>
			row.energyEvents.some(
				(e) =>
					e.source === "真珠行迹·底本下一次Q固定回能" &&
					e.fixed &&
					e.amount === 90,
			),
		),
	).toBe(true);
	expect(
		r.rows
			.filter((row) => row.actor === "真珠" && row.skill === "ES")
			.every((row) => row.expected === 0),
	).toBe(true);
	const events = r.rows.flatMap((row) => row.resourceEvents);
	for (const kind of ["hidden", "jokes"] as const)
		expect(
			events.filter((e) => e.kind === kind).reduce((n, e) => n + e.amount, 0),
		).toBeCloseTo(r.rows.at(-1)?.[kind] ?? 0);
	expect(r.total).toBe(
		simulateElationTeam({
			...defaultElationTeamConfig,
			enabled: true,
			profiles: profiles(2, star),
			limit: 300,
		}).total,
	);
});
it("scales normal damage with defense, credits copied damage to Pearl and borrows the template panel", () => {
	const r = simulateElationTeam({
		...defaultElationTeamConfig,
		enabled: true,
		profiles: profiles(6, true),
		limit: 500,
		enemyAttackDamage: 1000,
	});
	const normal = r.rows.find(
		(row) => row.actor === "真珠" && row.kind === "normal",
	);
	if (!normal?.factors) throw new Error("Missing defense attack");
	expect(normal.expected).toBeCloseTo(
		calculateDamage(3000 * normal.multiplier, normal.factors).expected,
	);
	const copied = r.rows.find((row) => row.borrowedFrom);
	expect(copied?.actor).toBe("真珠");
	expect(copied?.borrowedFrom).toBe("虚照");
	expect(
		r.rows.some((row) =>
			row.resourceEvents.some(
				(e) => e.source === "真珠抵御群攻消耗" && e.amount < 0,
			),
		),
	).toBe(true);
	expect(r.rows.some((row) => row.detail === "真珠欢愉技·下一次攻击追加")).toBe(
		true,
	);
	expect(
		r.rows.some((row) =>
			row.resourceEvents.some((e) => e.source === "虚照·真珠全队治疗"),
		),
	).toBe(true);
});

it("does not grant a non-Elation blueprint the Elation-only copy or 90-energy token", () => {
	const p = profiles(0, false);
	p[3].character.name = "藿藿";
	p[3].character.lc_id = 21007;
	p[3].gear.ultimateCost = 140;
	p[3].gear.enhanced = true;
	p[3].character.eidolon = 1;
	const r = simulateElationTeam({
		...defaultElationTeamConfig,
		enabled: true,
		profiles: p,
		limit: 300,
		pearlBlueprintId: p[3].character.id,
	});
	expect(r.rows.some((row) => row.pearlExtraTurn)).toBe(false);
	expect(r.rows.some((row) => row.borrowedFrom)).toBe(false);
	expect(
		r.rows.some(
			(row) =>
				row.actor === "真珠" && row.detail === "真珠强化普攻·防御力全体伤害",
		),
	).toBe(true);
	expect(
		r.rows
			.flatMap((row) => row.energyEvents)
			.some((e) => e.source === "真珠行迹·底本下一次Q固定回能"),
	).toBe(false);
});

it("preserves wind-set Q self advance without altering other actors", () => {
	const p = profiles(2, true);
	p[2].character.hasWindSet = true;
	const r = simulateElationTeam({
		...defaultElationTeamConfig,
		enabled: true,
		profiles: p,
		limit: 100,
	});
	const first = r.rows.find(
		(row) => row.actor === "真珠" && row.detail === "真珠战技·非攻击",
	);
	expect(first?.av).toBeCloseTo(50);
});
