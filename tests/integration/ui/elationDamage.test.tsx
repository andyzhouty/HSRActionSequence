import { existsSync, readFileSync } from "node:fs";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it } from "vitest";
import { ElationDamagePanel } from "../../../src/components/ElationDamagePanel";
import { createElationTeamPreset } from "../../../src/damage/elationPreset";
import { defaultElationTeamConfig } from "../../../src/damage/elationTypes";
import ActionSequence from "../../../src/pages/ActionSequence";
import { createTarget } from "../../../src/utils/action-sequence";

it("persists elation settings and exposes a distinct seeded team damage trial", async () => {
	render(<ActionSequence />);
	const area = await screen.findByPlaceholderText("JSON 导入 / 导出内容");
	fireEvent.change(area, {
		target: {
			value: JSON.stringify({
				characters: [
					{ ...createTarget("w", 0), name: "银狼LV.999", speed: "150" },
				],
				elationTeamTrial: { ...defaultElationTeamConfig, enabled: true },
			}),
		},
	});
	await userEvent.click(screen.getByRole("button", { name: "导入 JSON" }));
	const panel = screen.getByRole("region", { name: "银狼欢愉队伤害试验" });
	expect(within(panel).getByLabelText("敌人速度")).toHaveValue(132);
	await userEvent.selectOptions(
		within(panel).getByLabelText("火花每轮目标大奖数"),
		"2",
	);
	expect(
		JSON.parse((area as HTMLTextAreaElement).value).elationTeamTrial
			.sparxieJackpotTarget,
	).toBe(2);
	await userEvent.selectOptions(
		within(panel).getByLabelText("导入队伍第三位"),
		"sparxie",
	);
	expect(within(panel).getByLabelText("导入队伍第三位")).toHaveValue("sparxie");
	await userEvent.selectOptions(
		within(panel).getByLabelText("导入虚照位置"),
		"third",
	);
	expect(within(panel).getByLabelText("导入虚照位置")).toHaveValue("third");
	await userEvent.selectOptions(
		within(panel).getByLabelText("导入真珠位置"),
		"huo",
	);
	expect(within(panel).getByLabelText("导入真珠位置")).toHaveValue("huo");

	expect(within(panel).getByLabelText("隐藏分上限")).toHaveValue(300);
	expect(within(panel).getByLabelText("笑点概率曲线k")).toHaveValue(8);
	fireEvent.change(within(panel).getByLabelText("笑点概率曲线k"), {
		target: { value: "7" },
	});
	fireEvent.change(within(panel).getByLabelText("隐藏分上限"), {
		target: { value: "600" },
	});
	const probabilities = JSON.parse(
		(area as HTMLTextAreaElement).value,
	).elationTeamTrial;
	expect(probabilities.boxBeanCurveK).toBe(7);
	expect(probabilities.hiddenScoreCap).toBe(600);
	expect(probabilities.boxProbabilityModel).toBe("resourceDependentV1");

	expect(within(panel).queryByLabelText("大剑权重")).not.toBeInTheDocument();

	fireEvent.change(within(panel).getByLabelText("盲盒随机种子"), {
		target: { value: "42" },
	});
	expect(
		JSON.parse((area as HTMLTextAreaElement).value).elationTeamTrial.seed,
	).toBe(42);
	expect(within(panel).getByLabelText("银狼队总伤害")).toHaveTextContent("0");
	expect(within(panel).getByText("请先导入四人配装")).toBeInTheDocument();
	fireEvent.change(within(panel).getByLabelText("开大最低隐藏分"), {
		target: { value: "90" },
	});
	await userEvent.selectOptions(
		within(panel).getByLabelText("队友Q时机"),
		"score240",
	);
	const saved = JSON.parse(
		(area as HTMLTextAreaElement).value,
	).elationTeamTrial;
	expect(saved.wolfUltMinScore).toBe(90);
	expect(saved.wolfSupportTiming).toBe("score240");
	await userEvent.selectOptions(
		within(panel).getByLabelText("阿哈基础速度规则"),
		"starInParty",
	);
	expect(
		JSON.parse((area as HTMLTextAreaElement).value).elationTeamTrial
			.ahaBaseSpeedRule,
	).toBe("starInParty");
	expect(within(panel).getByText("本队阿哈基础速度：80")).toBeInTheDocument();
});

const source = process.env.HSR_FREESR_TEST_FILE;
it.skipIf(!source || !existsSync(source))(
	"renders the actual user's full damage breakdown",
	() => {
		if (!source) throw new Error("Missing file");
		const config = createElationTeamPreset(
			JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, "")),
			source,
		);
		render(
			<ElationDamagePanel
				value={config}
				onChange={() => {}}
				onImport={() => {}}
			/>,
		);
		expect(
			Number(
				screen.getByLabelText("银狼队总伤害").textContent?.replaceAll(",", ""),
			),
		).toBeGreaterThan(1_000_000);
		expect(screen.getAllByText("强化欢愉技").length).toBeGreaterThan(0);
		expect(screen.getAllByText("E2额外回合").length).toBeGreaterThan(0);
	},
);

it.skipIf(!source || !existsSync(source))(
	"renders the actual Star Aha build with special will and an envoy selector",
	() => {
		if (!source) throw new Error("Missing file");
		const config = createElationTeamPreset(
			JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, "")),
			source,
			"mc",
			"third",
		);
		render(
			<ElationDamagePanel
				value={config}
				onChange={() => {}}
				onImport={() => {}}
			/>,
		);
		expect(screen.getByLabelText("虚照E间隔")).toHaveValue(1);
		expect(screen.getByLabelText("虚照令使目标")).toBeInTheDocument();
		expect(screen.getAllByText(/虚照愿力/).length).toBeGreaterThan(0);
		expect(
			Number(
				screen.getByLabelText("银狼队总伤害").textContent?.replaceAll(",", ""),
			),
		).toBeGreaterThan(0);
	},
	15000,
);

it.skipIf(!source || !existsSync(source))(
	"renders actual Pearl defense damage and blueprint controls",
	() => {
		if (!source) throw new Error("Missing file");
		const config = createElationTeamPreset(
			JSON.parse(readFileSync(source, "utf8").replace(/^\uFEFF/, "")),
			source,
			"mc",
			"huo",
			"third",
		);
		render(
			<ElationDamagePanel
				value={config}
				onChange={() => {}}
				onImport={() => {}}
			/>,
		);
		expect(screen.getByLabelText("真珠美学底本")).toBeInTheDocument();
		expect(screen.getByLabelText("真珠复制计入来源")).toHaveValue("pearl");
		expect(screen.getAllByText(/真珠底本/).length).toBeGreaterThan(0);
	},
	15000,
);
