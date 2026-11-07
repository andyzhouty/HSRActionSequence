import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { DamageWorkspace } from "../../../src/components/DamageWorkspace";
import { ElationDamagePanel } from "../../../src/components/ElationDamagePanel";
import { createElationTeamPreset } from "../../../src/damage/elationPreset";
import { defaultElationTeamConfig } from "../../../src/damage/elationTypes";

vi.mock("../../../src/damage/elationPreset", async (original) => {
	const actual =
		await original<typeof import("../../../src/damage/elationPreset")>();
	return {
		...actual,
		createElationTeamPreset: vi.fn(actual.createElationTeamPreset),
	};
});

it("offers complete team presets with original equipment selected by default", async () => {
	render(<ElationDamagePanel onChange={vi.fn()} onImport={vi.fn()} />);
	expect(screen.getByLabelText("配装来源")).toHaveValue("file");
	await userEvent.selectOptions(screen.getByLabelText("队伍方案"), "4");
	expect(screen.getByLabelText("导入虚照位置")).toHaveValue("huo");
	expect(screen.getByLabelText("导入真珠位置")).toHaveValue("third");
	expect(screen.getByLabelText("导入银狼欢愉队配装")).toBeEnabled();
	await userEvent.click(
		screen.getByText("自定义队友组合", { selector: "summary" }),
	);
	await userEvent.selectOptions(screen.getByLabelText("导入真珠位置"), "huo");
	expect(screen.getByRole("alert")).toHaveTextContent("同一位置");
	expect(screen.getByLabelText("导入银狼欢愉队配装")).toBeDisabled();
});
it("prioritizes battle settings, results and search while folding calculation details", () => {
	render(
		<ElationDamagePanel
			value={{ ...defaultElationTeamConfig, enabled: true }}
			onChange={vi.fn()}
			onImport={vi.fn()}
		/>,
	);
	expect(screen.getByRole("heading", { name: "2. 设置战斗" })).toBeVisible();
	expect(screen.getByLabelText("银狼队总伤害")).toBeVisible();
	expect(screen.getByRole("region", { name: "后台自动搜轴" })).toBeVisible();
	expect(screen.getByLabelText("盲盒随机种子")).not.toBeVisible();
	expect(screen.getByLabelText("笑点概率曲线k")).not.toBeVisible();
	expect(screen.getByRole("button", { name: "导出计算明细" })).toBeVisible();
	fireEvent.click(screen.getByText("高级设置：技能循环、随机种子与计算口径"));
	expect(screen.getByLabelText("盲盒随机种子")).toBeVisible();
});
it("switches calculation types by keyboard without unmounting existing work", async () => {
	render(
		<DamageWorkspace
			phainonActive={false}
			elation={<input aria-label="保留中的搜索设置" defaultValue="saved" />}
			phainon={<p>白厄计算</p>}
		/>,
	);
	const first = screen.getByRole("tab", { name: "欢愉队 · 自动模拟" });
	first.focus();
	await userEvent.keyboard("{ArrowRight}");
	expect(screen.getByRole("tab", { name: "白厄队 · 手动排轴" })).toHaveFocus();
	expect(screen.getByLabelText("保留中的搜索设置")).not.toBeVisible();
	await userEvent.keyboard("{Home}");
	expect(first).toHaveAttribute("aria-selected", "true");
	expect(screen.getByLabelText("保留中的搜索设置")).toHaveValue("saved");
	expect(
		within(screen.getByRole("tabpanel")).getByLabelText("保留中的搜索设置"),
	).toBeVisible();
});

it("imports with original equipment by default and provides a remedy for unsupported cones", async () => {
	const onImport = vi.fn();
	render(<ElationDamagePanel onChange={vi.fn()} onImport={onImport} />);
	await userEvent.selectOptions(screen.getByLabelText("队伍方案"), "4");
	const file = new File(["{}"], "freesr-data.json", {
		type: "application/json",
	});
	Object.defineProperty(file, "text", { value: async () => "{}" });
	vi.mocked(createElationTeamPreset).mockReturnValueOnce({
		...defaultElationTeamConfig,
		enabled: true,
	});
	await userEvent.upload(screen.getByLabelText("导入银狼欢愉队配装"), file);
	expect(createElationTeamPreset).toHaveBeenLastCalledWith(
		{},
		"freesr-data.json",
		"mc",
		"huo",
		"third",
		true,
	);
	expect(onImport).toHaveBeenCalledOnce();
	vi.mocked(createElationTeamPreset).mockImplementationOnce(() => {
		throw new Error("尚未实现光锥 24006，不能自动还原该配装");
	});
	await userEvent.upload(screen.getByLabelText("导入银狼欢愉队配装"), file);
	expect(screen.getByText(/可切换上方配装来源为旧版验证配置/)).toBeVisible();
	expect(onImport).toHaveBeenCalledOnce();
});
