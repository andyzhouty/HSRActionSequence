import { describe, expect, it } from "vitest";
import { CerydraMerit } from "../../../src/damage/cerydra";
import { calculatePhainonTrial } from "../../../src/damage/phainonTrial";
import { defaultPhainonTrialConfig } from "../../../src/damage/types";
import type { GeneratedAction } from "../../../src/utils/action-sequence";
import { character } from "../../helpers/simulateActionTestUtils";

const action = (
	key: string,
	id: string,
	skill: string,
	domain = false,
): GeneratedAction => ({
	key,
	characterId: id,
	skill,
	actionValue: 10,
	actionNo: domain ? 1 : 0,
	speed: 100,
	isDomainAction: domain,
});
describe("Cerydra Military Merit", () => {
	it("caps charges at eight, keeps overflow after ambush, and resets on recipient changes", () => {
		const state = new CerydraMerit(1);
		for (let i = 0; i < 10; i++) state.castSkill("white");
		expect(state.charges).toBe(8);
		expect(state.bonuses("white", true)).toMatchObject({
			critDamage: 0.72,
			defenseIgnore: 0.36,
			resistancePenetration: 0.1,
		});
		expect(state.bonuses("white", false).defenseIgnore).toBe(0.16);
		expect(state.beginAttack("white", "E")).toBe(true);
		state.finishAttack("white", "E");
		expect(state.charges).toBe(2);
		state.castSkill("other");
		expect(state.charges).toBe(1);
	});
	it("only ambushes an offensive skill, limits additional damage to twenty hits and resets on ultimate", () => {
		const state = new CerydraMerit(0);
		state.castUltimate("white", 2);
		state.targetUltimate("white");
		state.targetUltimate("white");
		expect(state.charges).toBe(3);
		for (let i = 0; i < 20; i++) expect(state.takeExtraHit("white")).toBe(true);
		expect(state.takeExtraHit("white")).toBe(false);
		expect(state.takeExtraHit("other")).toBe(false);
		state.castUltimate("other", 2);
		expect(state.target).toBe("white");
		expect(state.takeExtraHit("white")).toBe(true);
	});
	it("copies a four-ruin E inside Phainon's domain without double costs or a second E2 action", () => {
		const white = character("white", "白厄", 100, {
			eidolon: 2,
			techniqueOn: true,
		});
		const cerydra = character("cerydra", "刻律德菈", 100, { eidolon: 1 });
		const result = calculatePhainonTrial({
			characters: [white, cerydra],
			defaultSkillTargets: { cerydra: "white" },
			config: {
				...defaultPhainonTrialConfig,
				characterId: "white",
				enemyCount: 1,
			},
			actions: [
				...Array.from({ length: 6 }, (_, i) => action(`c${i}`, "cerydra", "E")),
				action("q", "white", "Q"),
				action("hit", "white", "EA", true),
			],
		});
		const hits = result.rows.filter(
			(row) => row.actor === "白厄" && row.skill === "E",
		);
		expect(hits).toHaveLength(2);
		expect(hits[0].description).toContain("奇袭");
		expect(hits[0].multipliers).toEqual(hits[1].multipliers);
		expect(hits[0].expected).toBeCloseTo(hits[1].expected);
		expect(
			result.rows.filter((row) => row.description === "2魂额外回合·强化普攻"),
		).toHaveLength(1);
		const last = result.rows.at(-1);
		if (!last) throw new Error("Missing last row");
		expect(last.ruin).toBe(4);
		// Six E charges + the once-per-battle Q charge - six consumed + the E2 basic.
		expect(last.cerydra?.charges).toBe(2);
		expect(hits[1].cerydra?.charges).toBe(1);
		expect(
			result.rows
				.filter((row) => row.skill === "附加伤害")
				.every((row) => row.factors.critRate >= 1),
		).toBe(true);
		expect(result.rows.filter((row) => row.skill === "附加伤害")).toHaveLength(
			3,
		);
		expect(hits[0].factors.defenseIgnore).toBeCloseTo(0.36);
		expect(
			result.rows.find((row) => row.description === "2魂额外回合·强化普攻")
				?.factors.defenseIgnore,
		).toBeCloseTo(0.16);
	});
});
