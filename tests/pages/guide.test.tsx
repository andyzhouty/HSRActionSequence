import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { characterGuides } from "../../src/data/guide";
import Guide from "../../src/pages/Guide";

describe("使用指南", () => {
	it("展示技能码速查表", () => {
		render(<Guide onBack={vi.fn()} />);
		expect(screen.getByText("技能码速查表")).toBeInTheDocument();
		expect(screen.getByText("基础速度 99")).toBeInTheDocument();
		expect(screen.getByText("AQ / EQ")).toBeInTheDocument();
		expect(screen.getByText("1E–5E")).toBeInTheDocument();
		expect(screen.getByText("AA / AE / EA / EE")).toBeInTheDocument();
		expect(screen.getByText("ES")).toBeInTheDocument();
	});

	it("为所有已实现专属机制的角色提供 JSON 指南条目", () => {
		expect(Object.keys(characterGuides)).toEqual(
			expect.arrayContaining([
				"1001",
				"1002",
				"1005",
				"1014",
				"1015",
				"1101",
				"1105",
				"1202",
				"1203",
				"1215",
				"1217",
				"1224",
				"1225",
				"1301",
				"1306",
				"1309",
				"1310",
				"1313",
				"1314",
				"1321",
				"1401",
				"1402",
				"1407",
				"1408",
				"1409",
				"1412",
				"1413",
				"1414",
				"1415",
				"1501",
				"1502",
				"1504",
				"1505",
				"1506",
				"1507",
				"1509",
				"1510",
				"8008",
				"8010",
			]),
		);
	});

	it("可通过角色别名搜索并展示对应操作说明", async () => {
		render(<Guide onBack={vi.fn()} />);
		const search = screen.getByLabelText("搜索角色");
		await userEvent.clear(search);
		await userEvent.type(search, "红A");

		expect(screen.getByRole("button", { name: /Archer/ })).toBeInTheDocument();
		expect(screen.getByText("Archer 的核心是连续 E、额外回合和追击充能。"));
		expect(
			screen.getByText("E 等同 1E；可输入 2E 至 5E，主 E 后会生成额外箭。"),
		);
	});

	it("为不死途与卡芙卡展示追击充能说明", async () => {
		render(<Guide onBack={vi.fn()} />);
		await userEvent.type(screen.getByLabelText("搜索角色"), "卡芙卡");

		expect(
			screen.getByText(
				"初始 2 层、上限 2 层。其他角色发动攻击时，若充能大于 0，卡芙卡发动锁定 Z 并消耗 1 层；可在该攻击的右键菜单取消。",
			),
		).toBeInTheDocument();
	});
});
