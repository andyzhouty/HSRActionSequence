import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { defaultPhainonTrialConfig } from "../../../src/damage/types";
import ActionSequence from "../../../src/pages/ActionSequence";
import { createTarget } from "../../../src/utils/action-sequence";

it("imports saved damage settings, recalculates a skill, and includes the settings in JSON", async () => {
	render(<ActionSequence />);
	const area = await screen.findByPlaceholderText("JSON 导入 / 导出内容");
	const character = {
		...createTarget("p", 0),
		name: "白厄",
		speed: "100",
		techniqueOn: false,
	};
	fireEvent.change(area, {
		target: {
			value: JSON.stringify({
				characters: [character],
				skillOverrides: { "p-1": "E" },
				phainonDamageTrial: {
					...defaultPhainonTrialConfig,
					enabled: true,
					characterId: "p",
				},
			}),
		},
	});
	await userEvent.click(screen.getByRole("button", { name: "导入 JSON" }));
	const panel = screen.getByRole("region", { name: "白厄伤害试验" });
	const output = within(panel).getByLabelText("白厄累计期望伤害");
	const before = Number(output.textContent?.replaceAll(",", ""));
	expect(before).toBeGreaterThan(0);
	fireEvent.change(within(panel).getByLabelText("白厄出战前攻击力"), {
		target: { value: "6000" },
	});
	expect(Number(output.textContent?.replaceAll(",", ""))).toBeGreaterThan(
		before,
	);
	expect(
		JSON.parse((area as HTMLTextAreaElement).value).phainonDamageTrial.attack,
	).toBe(6000);
	expect(within(panel).getByLabelText("A等级")).toHaveValue(6);
});

it("offers the Cerydra support team in the damage import panel", async () => {
	render(<ActionSequence />);
	await userEvent.click(screen.getByRole("tab", { name: "白厄队 · 手动排轴" }));
	const panel = await screen.findByRole("region", { name: "白厄伤害试验" });
	const team = within(panel).getByRole("combobox", { name: "验证队伍" });
	await userEvent.selectOptions(team, "cerydra");
	expect(team).toHaveValue("cerydra");
	const enabled = within(panel).getByRole("checkbox", {
		name: "启用白厄伤害计算",
	});
	if (!(enabled as HTMLInputElement).checked) await userEvent.click(enabled);
	expect(within(panel).getByLabelText("刻律德菈攻击力")).toBeInTheDocument();
});
