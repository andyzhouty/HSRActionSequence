import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ActionPanel from "../../../src/components/ActionPanel";
import CharacterPanel from "../../../src/components/CharacterPanel";
import { CharacterNameInput } from "../../../src/components/Controls";
import { defaultCharacters } from "../../../src/utils/action-sequence";
import { renderWithContext } from "../../helpers/actionSequenceComponentTestUtils";

describe("角色名称输入", () => {
	it("输入时显示带头像的角色候选", async () => {
		const onChange = vi.fn();
		render(
			<CharacterNameInput
				value=""
				placeholder="输入角色"
				onChange={onChange}
			/>,
		);

		const input = screen.getByPlaceholderText("输入角色");
		await userEvent.type(input, "开拓者·毁灭");

		expect(
			screen.getByRole("listbox", { name: "角色候选" }),
		).toBeInTheDocument();
		const femaleAvatar = screen.getByAltText("开拓者·毁灭");
		expect(femaleAvatar).toHaveAttribute(
			"src",
			expect.stringContaining("favicon/8002.webp"),
		);
		const femaleOption = femaleAvatar.closest("button");
		if (!femaleOption) throw new Error("未找到女性开拓者候选按钮");

		await userEvent.click(femaleOption);
		expect(onChange).toHaveBeenCalledWith("开拓者·毁灭");
	});

	it("开拓者角色卡可切换为男性 CID", () => {
		const character = {
			...defaultCharacters[0],
			name: "开拓者·毁灭",
		};
		const updateCharacter = vi.fn();
		renderWithContext(<CharacterPanel />, {
			characters: [character],
			updateCharacter,
		});

		fireEvent.click(screen.getByRole("button", { name: "男" }));
		const updater = updateCharacter.mock.calls[0]?.[1];
		expect(updater(character).name).toBe("开拓者·毁灭（男）");
	});

	it("行动轴中的角色行动显示对应头像", () => {
		const character = {
			...defaultCharacters[0],
			id: "trailblazer",
			name: "开拓者·毁灭（男）",
		};
		renderWithContext(<ActionPanel />, {
			characters: [character],
			characterNames: { trailblazer: character.name },
			characterKinds: { trailblazer: character.kind },
			charactersById: { trailblazer: character },
			actions: [
				{
					key: "trailblazer-1",
					characterId: "trailblazer",
					actionNo: 1,
					actionValue: 50,
					skill: "E",
					speed: 100,
				},
			],
		});

		expect(screen.getByAltText("开拓者·毁灭（男）")).toHaveAttribute(
			"src",
			expect.stringContaining("favicon/8001.webp"),
		);
	});
});
