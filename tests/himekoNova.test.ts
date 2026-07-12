import { describe, expect, it } from "vitest";
import { simulateActions } from "../src/simulate/actions";
import { character, input, skills } from "./helpers/simulateActionTestUtils";

describe("Himeko Nova Assist (姬子·启行 F)", () => {
	it("队友 FE 行动触发协战", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("himeko", "姬子·启行", 100),
					character("a", "丹恒", 100),
				],
				skillOverrides: skills({ "a-1": "FE" }),
				limit: 250,
			}),
		);
		const assistActions = actions.filter((a) => a.isAssistFollowUp);
		expect(assistActions.length).toBeGreaterThan(0);
		expect(assistActions[0].actionValue).toBeCloseTo(100, 2);
	});

	it("姬子·启行自身使用 FE 不触发协战", () => {
		const actions = simulateActions(
			input({
				characters: [character("himeko", "姬子·启行", 100)],
				skillOverrides: skills({ "himeko-1": "FE" }),
				limit: 250,
			}),
		);
		expect(actions.filter((a) => a.isAssistFollowUp)).toHaveLength(0);
	});

	it("E0：非白名单角色单 F 也跳过原回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("himeko", "姬子·启行", 100),
					character("other", "其他角色", 100),
				],
				skillOverrides: skills({ "other-1": "F" }),
				limit: 250,
			}),
		);
		expect(actions.filter((a) => a.isAssistFollowUp)).toHaveLength(0);
		const assistActions = actions.filter((a) => a.isAssistAction);
		expect(assistActions.length).toBeGreaterThan(0);
		expect(assistActions[0].characterId).toBe("himeko");
	});

	it("E0：白名单丹恒单 F 保留原回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("himeko", "姬子·启行", 100),
					character("dh", "丹恒", 100),
				],
				skillOverrides: skills({ "dh-1": "F" }),
				limit: 250,
			}),
		);
		expect(actions.filter((a) => a.isAssistFollowUp).length).toBeGreaterThan(0);
	});

	it("E0：白名单开拓者·记忆单 F 保留原回合", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("himeko", "姬子·启行", 100),
					character("rmc", "开拓者·记忆", 100),
				],
				skillOverrides: skills({ "rmc-1": "F" }),
				limit: 250,
			}),
		);
		expect(actions.filter((a) => a.isAssistFollowUp).length).toBeGreaterThan(0);
	});

	it("E2：任意角色 FF 连招正常", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("himeko", "姬子·启行", 100, { eidolon: 2 }),
					character("other", "其他角色", 100),
				],
				skillOverrides: skills({ "other-1": "FF" }),
				limit: 250,
			}),
		);
		expect(actions.filter((a) => a.isAssistAction)).toHaveLength(2);
		expect(actions.filter((a) => a.isAssistFollowUp)).toHaveLength(0);
	});

	it("E0：非白名单角色单 F 后原角色下一动正常继续", () => {
		const actions = simulateActions(
			input({
				characters: [
					character("himeko", "姬子·启行", 100),
					character("other", "其他角色", 100),
				],
				skillOverrides: skills({ "other-1": "F" }),
				limit: 500,
			}),
		);
		expect(actions.find((a) => a.key === "other-2")).toBeDefined();
	});
});
