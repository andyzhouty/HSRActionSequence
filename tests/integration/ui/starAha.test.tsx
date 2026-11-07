import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import ActionSequence from "../../../src/pages/ActionSequence";
import { createTarget } from "../../../src/utils/action-sequence";

it("imports star Aha, keeps scheduling resources, and displays the locked skill follow-up", async () => {
	render(<ActionSequence />);
	const area = await screen.findByPlaceholderText("JSON 导入 / 导出内容");
	const star = {
		...createTarget("star", 0),
		name: "星神⭐阿哈",
		speed: "100",
		techniqueOn: false,
	};
	const ally = {
		...createTarget("ally", 1),
		name: "藿藿",
		speed: "90",
		techniqueOn: false,
	};
	fireEvent.change(area, {
		target: {
			value: JSON.stringify({
				characters: [star, ally],
				skillOverrides: { "star-1": "E" },
				defaultSkillTargets: { star: "ally" },
				customLimit: "90",
				displayedLimit: "90",
				limitPreset: "自定义",
			}),
		},
	});
	await userEvent.click(screen.getByRole("button", { name: "导入 JSON" }));

	expect(screen.getAllByText("愿力").length).toBeGreaterThan(0);
	expect(screen.getAllByText("治疗/护盾").length).toBeGreaterThan(0);
	expect(screen.getAllByText("Z").length).toBeGreaterThan(0);
});
