import { describe, expect, it } from "vitest";
import { simulateActions } from "../src/utils/simulateActions";
import { character, input, skills } from "./helpers/simulateActionTestUtils";

describe("Memory Trailblazer (开拓者·记忆)", () => {
	it("Q 也会召唤迷迷", () => {
		const actions = simulateActions(
			input({
				characters: [character("rmc", "开拓者·记忆", 100)],
				skillOverrides: skills({
					"rmc-1": "AQ",
				}),
				limit: 220,
			}),
		);

		const memeAction = actions.find((a) => a.characterId === "rmc-meme");
		expect(actions.find((a) => a.key === "rmc-1-q")).toBeDefined();
		expect(memeAction).toBeDefined();
		expect(memeAction!.actionValue).toBeGreaterThan(100);
	});

	it("迷迷将目标拉到当前 AV", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("rmc", "开拓者·记忆", 200),
					character("seele", "希儿", 100),
				],
				skillOverrides: skills({ "rmc-1": "E" }),
				memeSelections: { "rmc-1-meme": "seele" },
				limit: 150,
			}),
		);
		const seeleAction = actions.find((a) => a.characterId === "seele");
		const rmc1 = actions.find((a) => a.key === "rmc-1");
		expect(seeleAction).toBeDefined();
		expect(rmc1).toBeDefined();
		expect(seeleAction?.actionValue).toBeCloseTo(rmc1?.actionValue, 1);
	});

	it("迷迷死亡只能通过右键标记触发，并使记忆主 25% 自拉条", () => {
		const baseInput = input({
			characters: [
				character("rmc", "开拓者·记忆", 100),
				character("ally", "行动角色", 90),
			],
			skillOverrides: skills({ "rmc-1": "E" }),
			limit: 220,
		});
		const baseline = simulateActions(baseInput);
		const actions = simulateActions(
			input({
				...baseInput,
				memeKillToggles: { "ally-1": true },
			}),
		);

		const baselineRmcSecond = baseline.find((a) => a.key === "rmc-2");
		const rmcSecond = actions.find((a) => a.key === "rmc-2");
		expect(baselineRmcSecond).toBeDefined();
		expect(rmcSecond).toBeDefined();
		expect(
			(baselineRmcSecond?.actionValue ?? 0) - (rmcSecond?.actionValue ?? 0),
		).toBeCloseTo(25, 3);
	});

	it("迷迷可以死在自己回合，并在行动后使记忆主 25% 自拉条", () => {
		const baseInput = input({
			characters: [
				character("rmc", "开拓者·记忆", 200),
				character("ally", "行动角色", 90),
			],
			skillOverrides: skills({ "rmc-1": "E" }),
			limit: 220,
		});
		const baseline = simulateActions(baseInput);
		const actions = simulateActions(
			input({
				...baseInput,
				memeKillToggles: { "rmc-meme-1": true },
			}),
		);

		const memeAction = actions.find((a) => a.key === "rmc-meme-1");
		const baselineRmcSecond = baseline.find((a) => a.key === "rmc-3");
		const rmcSecond = actions.find((a) => a.key === "rmc-3");
		expect(memeAction).toBeDefined();
		expect(baselineRmcSecond).toBeDefined();
		expect(rmcSecond).toBeDefined();
		expect(
			(baselineRmcSecond?.actionValue ?? 0) - (rmcSecond?.actionValue ?? 0),
		).toBeCloseTo(12.5, 3);
		expect(rmcSecond!.actionValue).toBeGreaterThan(memeAction!.actionValue);
	});

	it("星期日不能单独拉条迷迷，但拉记忆主时会顺带拉迷迷", () => {
		const baseInput = input({
			characters: [
				character("rmc", "开拓者·记忆", 120),
				character("sunday", "星期日", 160),
			],
			skillOverrides: skills({
				"rmc-1": "E",
				"sunday-1": "E",
			}),
			limit: 220,
		});
		const directTarget = simulateActions(
			input({
				...baseInput,
				skillTargets: {
					"sunday-1": "rmc-meme",
				},
			}),
		);
		const ownerTarget = simulateActions(
			input({
				...baseInput,
				skillTargets: {
					"sunday-1": "rmc",
				},
			}),
		);

		const directMeme = directTarget.find(
			(a) => a.characterId === "rmc-meme" && a.actionNo === 2,
		);
		const ownerMeme = ownerTarget.find(
			(a) => a.characterId === "rmc-meme" && a.actionNo === 2,
		);
		expect(directMeme).toBeDefined();
		expect(ownerMeme).toBeDefined();
		expect(ownerMeme!.actionValue).toBeLessThan(directMeme!.actionValue);
	});
});
