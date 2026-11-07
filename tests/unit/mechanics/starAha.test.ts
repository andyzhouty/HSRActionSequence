import { describe, expect, it } from "vitest";
import { getCharacterCid } from "../../../src/data/characters";
import {
	beginStarAhaTurn,
	handleStarAhaRecordedAction,
	initializeStarAha,
} from "../../../src/mechanics/starAha";
import { simulateActions } from "../../../src/simulate/actions";
import { buildInitialStates } from "../../../src/simulate/init";
import type { GeneratedAction } from "../../../src/utils/action-sequence";
import { normalizeResourcesForCharacters } from "../../../src/utils/action-sequence";
import {
	character,
	input,
	skills,
} from "../../helpers/simulateActionTestUtils";

const star = (eidolon = 0, techniqueOn = false) =>
	character("star", "星神★阿哈", 100, { eidolon, techniqueOn });
const action = (
	key: string,
	characterId: string,
	skill = "A",
): GeneratedAction => ({
	key,
	characterId,
	skill,
	actionNo: 0,
	actionValue: 0,
	speed: 100,
});
function harness(resources: Record<string, Record<string, string>> = {}) {
	const states = buildInitialStates([
		star(),
		character("ally", "停云", 100),
		character("other", "藿藿", 100),
	]);
	const owner = initializeStarAha(states);
	if (!owner) throw new Error("Missing star Aha");
	const actions: GeneratedAction[] = [];
	const run = (
		event: GeneratedAction,
		targets: Record<string, string> = {},
	) => {
		handleStarAhaRecordedAction({
			owner,
			action: event,
			states,
			actions,
			input: input({ resourceValues: resources, skillTargets: targets }),
			emitExtraAha: () => {},
		});
		return event;
	};
	return { states, owner, actions, run };
}
describe("星神阿哈排轴", () => {
	it("Pearl extra turns grant the action wish without ticking universe duration", () => {
		const h = harness();
		h.owner.starAhaUniverseTurns = 3;
		h.run({
			...action("pearl-extra-star", "star", "A"),
			isPearlExtraAction: true,
		});
		expect(h.owner.starAhaUniverseTurns).toBe(3);
		expect(h.owner.starAhaWill).toBe(1);
	});

	it("is distinct from the Aha moment and has permanent entry advance even without technique", () => {
		expect(getCharacterCid("星神⭐阿哈")).toBe("1511");
		const actions = simulateActions(
			input({
				characters: [star()],
				limit: 90,
				skillOverrides: skills({ "star-1": "A" }),
			}),
		);
		expect(actions.find((a) => a.key === "star-1")?.actionValue).toBeCloseTo(
			70,
		);
		expect(actions.some((a) => a.isExtraAha)).toBe(false);
		expect(normalizeResourcesForCharacters([], [star()])).toEqual([
			"愿力",
			"笑点",
			"治疗/护盾",
		]);
	});
	it("technique grants a fixed twenty-joke extra moment at zero AV, with star ES last and no natural timer reset", () => {
		const actions = simulateActions(
			input({
				characters: [
					star(1, true),
					character("wolf", "银狼LV.999", 110),
					character("yao", "爻光", 120),
				],
				limit: 110,
				skillOverrides: skills({ "star-1": "A" }),
				resourceValues: { "@av0-1": { 笑点: "33" } },
			}),
		);
		const extra = actions.find((a) => a.isExtraAha);
		expect(extra).toMatchObject({
			actionValue: 0,
			ahaFixedJokes: 20,
			ahaDoesNotConsumeJokes: true,
			ahaJokesUsed: 20,
		});
		if (!extra) throw new Error("Missing technique moment");
		const es = actions.filter((a) => a.elationSkillParentKey === extra.key);
		expect(es.at(-1)?.characterId).toBe("star");
		expect(es.at(-1)?.starAhaWill).toBe(6);
		expect(es.at(-1)?.starAhaJokes).toBe(33);
		expect(
			actions.find((a) => a.isAhaInstant && !a.isExtraAha)?.actionValue,
		).toBeCloseTo(10000 / 120);
	});
	it("E replaces a valid other-character envoy and emits exactly one locked follow-up with no extra Will", () => {
		const h = harness();
		h.run(action("e", "star", "E"), { e: "ally" });
		expect(h.owner.starAhaEnvoy).toBe("ally");
		expect(h.owner.starAhaWill).toBe(1);
		expect(h.actions).toHaveLength(1);
		expect(h.actions[0]).toMatchObject({
			key: "e-fua",
			skill: "Z",
			isFuaAction: true,
			lockedSkill: true,
			starAhaSkillPointRefund: 1,
		});
		h.run(h.actions[0]);
		expect(h.owner.starAhaWill).toBe(1);
		beginStarAhaTurn(h.states, "ally", "ally-1");
		beginStarAhaTurn(h.states, "ally", "ally-1");
		expect(h.owner.starAhaWill).toBe(2);
		h.run(action("e2", "star", "E"), { e2: "other" });
		beginStarAhaTurn(h.states, "ally", "ally-2");
		expect(h.owner.starAhaWill).toBe(3);
		beginStarAhaTurn(h.states, "other", "other-1");
		expect(h.owner.starAhaWill).toBe(4);
	});
	it("healing/shield Will is once per ultimate and ten Will preserves two overflow", () => {
		const h = harness({
			h1: { "治疗/护盾": "1" },
			h2: { "治疗/护盾": "1" },
			fill: { 愿力: "10" },
			h3: { "治疗/护盾": "1" },
		});
		h.run(action("h1", "ally"));
		h.run(action("h2", "ally"));
		expect(h.owner.starAhaWill).toBe(1);
		h.run(action("fill", "ally"));
		const q = h.run(action("q", "star", "Q"));
		expect(q.starAhaUltimateUnavailable).toBe(false);
		expect(h.owner.starAhaWill).toBe(2);
		h.run(action("h3", "ally"));
		expect(h.owner.starAhaWill).toBe(3);
		beginStarAhaTurn(h.states, "star", "s1");
		expect(h.owner.starAhaUniverseTurns).toBe(2);
		beginStarAhaTurn(h.states, "star", "s2");
		beginStarAhaTurn(h.states, "star", "s3");
		expect(h.owner.starAhaUniverseTurns).toBe(0);
	});
	it("forty jokes trigger once per moment, normal moments consume jokes and Universe refunds ten percent", () => {
		const h = harness({
			a: { 笑点: "50" },
			b: { 笑点: "50" },
			c: { 笑点: "40" },
		});
		h.run(action("a", "ally"));
		h.run(action("b", "ally"));
		expect(h.owner.starAhaWill).toBe(1);
		h.owner.starAhaUniverseTurns = 3;
		const moment = { ...action("aha", "@aha", ""), isAhaInstant: true };
		h.run(moment);
		expect(moment.ahaJokesUsed).toBe(50);
		expect(h.owner.starAhaJokes).toBe(0);
		h.run({
			...action("es", "star", "ES"),
			isElationSkill: true,
			elationSkillParentKey: "aha",
		});
		expect(h.owner.starAhaJokes).toBe(5);
		h.run(action("c", "ally"));
		expect(h.owner.starAhaWill).toBe(3);
	});
	it("Q advances the natural Aha clock by twenty percent, E6's first Q pulls it immediately", () => {
		const run = (eidolon: number) =>
			simulateActions(
				input({
					characters: [star(eidolon)],
					limit: 110,
					ultInterrupts: { "@av0-1": [{ casterId: "star", timing: "after" }] },
					resourceValues: { "@av0-1": { 愿力: "10" } },
				}),
			);
		expect(run(0).find((a) => a.isAhaInstant)?.actionValue).toBeCloseTo(80);
		const e6 = run(6);
		expect(e6.find((a) => a.isAhaInstant)?.actionValue).toBe(0);
		expect(e6.find((a) => a.isAhaInstant)?.ahaJokesUsed).toBe(100);
	});
	it("the envoy's turn-start Will is available to a Q inserted before its action", () => {
		const actions = simulateActions(
			input({
				characters: [star(), character("ally", "停云", 80)],
				limit: 140,
				defaultSkillTargets: { star: "ally" },
				skillOverrides: skills({ "star-1": "E", "ally-1": "A" }),
				resourceValues: { "star-1": { 愿力: "6" } },
				ultInterrupts: { "ally-1": [{ casterId: "star", timing: "before" }] },
			}),
		);
		const q = actions.find((a) => a.key === "ally-1-interrupt-0");
		expect(q).toMatchObject({
			skill: "Q",
			starAhaUltimateUnavailable: false,
			starAhaWill: 0,
		});
	});
	it("E6 full advance is once per battle; later Qs still advance only twenty percent", () => {
		const actions = simulateActions(
			input({
				characters: [star(6)],
				limit: 100,
				skillOverrides: skills({ "star-1": "A" }),
				resourceValues: { "@av0-1": { 愿力: "10" }, "star-1": { 愿力: "10" } },
				ultInterrupts: {
					"@av0-1": [{ casterId: "star", timing: "after" }],
					"star-1": [{ casterId: "star", timing: "after" }],
				},
			}),
		);
		expect(
			actions.filter((a) => a.isAhaInstant).map((a) => a.actionValue),
		).toEqual([0, 80]);
	});
	it("an envoy's Silver Wolf extra turn grants Will while follow-up attacks do not", () => {
		const h = harness();
		h.owner.starAhaEnvoy = "ally";
		h.run(action("source-godmode-A", "ally"));
		expect(h.owner.starAhaWill).toBe(1);
		h.run({ ...action("hit-fua", "ally", "Z"), isFuaAction: true });
		expect(h.owner.starAhaWill).toBe(1);
	});
});
