import { useMemo, useState } from "react";
import { useActionSequence } from "../contexts/ActionSequenceContext";
import { calculateDamage } from "../damage/formula";
import { damageMetadataVersion } from "../damage/metadata";
import { calculatePhainonTrial, type TrialRow } from "../damage/phainonTrial";
import { createPhainonTrialPreset, createTrialEnemy } from "../damage/preset";
import {
	defaultPhainonTrialConfig,
	type PhainonTrialConfig,
} from "../damage/types";
import { getCharacterCid } from "../data/characters";
import type { SavedData } from "../utils/action-sequence";
import { getDisplayOrderedActions } from "../utils/actionDisplayOrder";

type NumericKey = {
	[K in keyof PhainonTrialConfig]: PhainonTrialConfig[K] extends number
		? K
		: never;
}[keyof PhainonTrialConfig];
const format = (value: number) =>
	value.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const percent = (value: number) => `${format(value * 100)}%`;

function DamageAreas({ row }: { row: TrialRow }) {
	const areas = calculateDamage(1, row.factors).areas;
	return (
		<details className="mt-1 text-xs text-gray-400">
			<summary className="cursor-pointer">乘区明细</summary>
			<p>各目标攻击倍率：{row.multipliers.map(percent).join(" / ")}</p>
			<p>
				增伤 ×{format(areas.damageBonus)} · 易伤 ×{format(areas.vulnerability)}{" "}
				· 防御 ×{areas.defense.toFixed(6)} · 抗性 ×{format(areas.resistance)}
			</p>
			<p>
				穿抗 {percent(row.factors.resistancePenetration)} · 减防{" "}
				{percent(row.factors.defenseReduction)} · 无视防御{" "}
				{percent(row.factors.defenseIgnore)} · 暴击率{" "}
				{percent(Math.min(1, row.factors.critRate))}
			</p>
			<p>
				虚弱 ×{format(areas.weaken)} · 减伤 ×{format(areas.reduction)} · 韧性 ×
				{format(areas.toughness)} · 独立 ×{format(areas.independent)}
			</p>
		</details>
	);
}

export function PhainonDamagePanel({
	value,
	onChange,
	onImport,
}: {
	value?: PhainonTrialConfig;
	onChange: (next: PhainonTrialConfig) => void;
	onImport: (data: Partial<SavedData>) => void;
}) {
	const ctx = useActionSequence();
	const phainons = ctx.characters.filter(
		(character) =>
			character.kind === "角色" && getCharacterCid(character.name) === "1408",
	);
	const firstPhainonId = phainons[0]?.id ?? "";
	const config = useMemo(
		() => ({
			...defaultPhainonTrialConfig,
			...value,
			characterId: value?.characterId || firstPhainonId,
		}),
		[value, firstPhainonId],
	);
	const [message, setMessage] = useState("");
	const [support, setSupport] = useState<"sparkle" | "cerydra">("sparkle");
	const result = useMemo(() => {
		if (!config.enabled) return { rows: [], warnings: [] };
		try {
			return calculatePhainonTrial({
				config,
				characters: ctx.characters,
				actions: getDisplayOrderedActions(ctx.actions, ctx.sameAVOrder).filter(
					(action) => action.actionValue <= ctx.actionLimit,
				),
				skillTargets: ctx.skillTargets,
				defaultSkillTargets: ctx.defaultSkillTargets,
				attackDisabled: ctx.attackDisabled,
				meritTarget: ctx.meritTarget,
			});
		} catch (error) {
			return {
				rows: [],
				warnings: [error instanceof Error ? error.message : "伤害计算失败"],
			};
		}
	}, [
		config,
		ctx.characters,
		ctx.actions,
		ctx.sameAVOrder,
		ctx.actionLimit,
		ctx.skillTargets,
		ctx.defaultSkillTargets,
		ctx.attackDisabled,
		ctx.meritTarget,
	]);
	const field = (key: NumericKey, label: string, ratio = false) => (
		<label key={key} className="block text-sm text-gray-300">
			<span className="mb-1 block">
				{label}
				{ratio ? "（%）" : ""}
			</span>
			<input
				type="number"
				step="any"
				value={Number((config[key] * (ratio ? 100 : 1)).toFixed(8))}
				onChange={(event) =>
					onChange({
						...config,
						[key]: Number(event.target.value) / (ratio ? 100 : 1),
					})
				}
				className="w-full rounded-lg border border-gray-600 bg-gray-700 p-2 text-white"
			/>
		</label>
	);
	return (
		<section
			className="mt-4 rounded-xl border border-gray-700 bg-gray-800 p-4 text-gray-200"
			aria-label="白厄伤害试验"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="text-lg font-semibold text-white">
					白厄伤害试验 · {damageMetadataVersion}
				</h3>
				<label className="text-sm">
					验证队伍
					<select
						aria-label="验证队伍"
						value={support}
						onChange={(event) =>
							setSupport(event.target.value as "sparkle" | "cerydra")
						}
						className="ml-2 rounded bg-gray-900 p-2"
					>
						<option value="sparkle">白厄 / 布洛妮娅 / 花火 / 知更鸟</option>
						<option value="cerydra">白厄 / 布洛妮娅 / 刻律德菈 / 知更鸟</option>
					</select>
				</label>
				<label className="cursor-pointer rounded-lg border border-gray-500 px-3 py-2 text-sm hover:border-blue-400">
					导入四人配装并生成验证轴
					<input
						className="sr-only"
						type="file"
						accept=".json,application/json"
						aria-label="导入白厄验证配装"
						onChange={async (event) => {
							const file = event.target.files?.[0];
							if (!file) return;
							try {
								onImport(
									createPhainonTrialPreset(
										JSON.parse((await file.text()).replace(/^\uFEFF/, "")),
										file.name,
										support,
									),
								);
								setMessage(
									`已读取 ${file.name} 中的四人配装，并生成可编辑的示例行动轴`,
								);
							} catch (error) {
								setMessage(
									`配装导入失败：${error instanceof Error ? error.message : String(error)}`,
								);
							}
							event.target.value = "";
						}}
					/>
				</label>
			</div>
			<p className="my-2 text-sm text-gray-400">
				按上方行动轴回放白厄伤害；EA/EW 拆为 E
				与2魂额外回合。普攻默认6级。四人导入会替换当前队伍及排轴，面板与设置随
				JSON 保存。
			</p>
			{message && (
				<p role="status" className="my-2 text-sm text-blue-300">
					{message}
				</p>
			)}
			<label className="flex items-center gap-2 text-sm">
				<input
					type="checkbox"
					checked={config.enabled}
					onChange={(event) => {
						if (
							event.target.checked &&
							!ctx.characters.some((character) => character.kind === "敌人")
						)
							ctx.setCharacters((previous) => [
								...previous,
								createTrialEnemy(),
							]);
						onChange({ ...config, enabled: event.target.checked });
					}}
				/>
				启用白厄伤害计算
			</label>
			<p className="mt-2 text-sm text-gray-400">
				默认敌人95级、200速（每50行动值一动）；行动按群攻处理，仅非变身白厄获得1点火种。W强制行动同样结算，随后重排50行动值间隔。
			</p>
			{config.enabled && (
				<>
					{config.sourceFile && (
						<p className="mt-2 text-sm text-gray-400">
							配装来源：{config.sourceFile}
							。读取四人的已装备遗器，不使用文件中的其他备选配装。
						</p>
					)}
					<div className="my-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
						<label className="block text-sm">
							白厄
							<select
								aria-label="伤害计算角色"
								value={config.characterId}
								onChange={(event) =>
									onChange({ ...config, characterId: event.target.value })
								}
								className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 p-2"
							>
								{phainons.map((character) => (
									<option key={character.id} value={character.id}>
										{character.name} · {character.id}
									</option>
								))}
							</select>
						</label>
						{field("baseAttack", "白厄基础攻击力")}
						{field("attack", "白厄出战前攻击力")}
						{field("critRate", "出战前暴击率", true)}
						{field("critDamage", "出战前暴伤", true)}
						{field("damageBonus", "常驻物理增伤", true)}
						{field("bronyaCritDamage", "布洛妮娅暴伤", true)}
						{field("sparkleCritDamage", "花火暴伤", true)}
						{field("robinAttack", "知更鸟出战前攻击")}
						{field("robinBaseAttack", "知更鸟基础攻击")}
						{field("cerydraAttack", "刻律德菈攻击力")}
						{field("cerydraBaseAttack", "刻律德菈基础攻击")}
						{field("cerydraCritRate", "刻律德菈暴击率", true)}
						{field("cerydraCritDamage", "刻律德菈面板暴伤", true)}
						{field("enemyLevel", "敌方等级")}
						{field("enemyCount", "存活敌人数")}
					</div>
					<details className="my-3 rounded-lg border border-gray-600 p-3">
						<summary className="cursor-pointer text-sm">
							技能等级、目标和其他乘区
						</summary>
						<div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
							{field("basicLevel", "A等级")}
							{field("skillLevel", "E/W等级")}
							{field("ultimateLevel", "Q等级")}
							{field("talentLevel", "天赋等级")}
							{field("attackerLevel", "白厄等级")}
							{field("targetIndex", "主目标位置（从0起）")}
							{field("resistance", "敌方物理抗性", true)}
							{field("resistancePenetration", "其他抗性穿透", true)}
							{field("defenseReduction", "减防", true)}
							{field("defenseIgnore", "其他无视防御", true)}
							{field("vulnerability", "其他易伤", true)}
							{field("weaken", "虚弱", true)}
							{field("damageReduction", "目标减伤", true)}
							{field("independentMultiplier", "其他独立乘区")}
							{field("initialSkillPoints", "初始战技点（秘技前）")}
							{field("initialSparkleStacks", "初始花火天赋层数")}
						</div>
						<label className="mt-3 flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={config.toughnessBroken}
								onChange={(event) =>
									onChange({ ...config, toughnessBroken: event.target.checked })
								}
							/>
							全程按弱点击破状态计算（否则乘0.9）
						</label>
						<label className="mt-2 flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={config.healingTrace}
								onChange={(event) =>
									onChange({ ...config, healingTrace: event.target.checked })
								}
							/>
							开局已有白厄治疗/护盾行迹增伤（持续4个正常回合）
						</label>
					</details>
					<p className="my-2 text-sm text-gray-400">
						试验范围：白厄0–2魂、布洛妮娅0–4魂、花火0魂（含强化组）、知更鸟0–1魂；辅助等级由配装读取，未导入时按10级。仅统计白厄伤害，暂不含协奏附加伤害、队友伤害、击破伤害、敌方阶段与祝福。能量按配装、技能与受击逐项回放；击杀不自动模拟。
					</p>
					<details className="mb-3 text-sm text-gray-400">
						<summary className="cursor-pointer">计算口径与待验证项</summary>
						<p className="mt-2">
							弹射按存活敌人等概率分布；W
							默认每名敌人行动一次、合并后反击。领域额外回合不扣普通增益回合，协奏结束沿用现有排轴；知更鸟Q按施放时攻击力快照。花火天赋刷新共享持续时间。战技点回溯不模拟布洛妮娅1魂随机返还。若文件有战斗祝福，请手动补入相应乘区；此处结果用于逐项验证，不代表该Boss实战总伤。
						</p>
					</details>
					{result.warnings.map((warning) => (
						<p
							key={warning}
							role="alert"
							className="my-1 text-sm text-amber-300"
						>
							{warning}
						</p>
					))}
					<p className="my-3 text-lg font-semibold">
						白厄累计期望伤害：
						<output aria-label="白厄累计期望伤害">
							{format(result.rows[result.rows.length - 1]?.cumulative ?? 0)}
						</output>
					</p>
					<div className="max-h-[640px] overflow-auto rounded-lg border border-gray-700">
						<table className="w-full whitespace-nowrap text-left text-sm">
							<thead className="sticky top-0 bg-gray-900">
								<tr>
									{[
										"行动值",
										"角色 / 技能",
										"结算",
										"攻击力",
										"增伤 / 暴伤",
										"各目标期望伤害",
										"期望 / 全暴击",
										"累计",
										"火种 / 溢出 / 毁伤 / SP",
										"军功 / 爵位",
										"辅助能量",
										"增益与校验",
									].map((label) => (
										<th key={label} className="px-3 py-2">
											{label}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{result.rows.map((row) => (
									<tr key={row.key} className="border-t border-gray-700">
										<td className="px-3 py-2">{format(row.actionValue)}</td>
										<td className="px-3 py-2">
											{row.actor} {row.skill}
										</td>
										<td className="px-3 py-2">{row.description}</td>
										<td className="px-3 py-2">{format(row.attack)}</td>
										<td className="px-3 py-2">
											{percent(row.damageBonus)} / {percent(row.critDamage)}
										</td>
										<td className="px-3 py-2">
											{row.perTarget.map(format).join(" / ")}
										</td>
										<td className="px-3 py-2">
											{format(row.expected)} / {format(row.crit)}
										</td>
										<td className="px-3 py-2">{format(row.cumulative)}</td>
										<td className="px-3 py-2">
											{row.seeds} / {row.seedOverflow} / {row.ruin} /{" "}
											{row.skillPoints}
										</td>
										<td className="px-3 py-2">
											{row.cerydra
												? `${row.cerydra.charges} / ${row.cerydra.crowned ? "爵位" : "军功"}`
												: "—"}
										</td>
										<td className="px-3 py-2">
											{Object.entries(row.energy).map(([id, state]) => (
												<div key={id}>
													{
														ctx.characters.find(
															(character) => character.id === id,
														)?.name
													}
													：{format(state.current)}/{state.maximum}（
													{percent(state.regeneration)}）
												</div>
											))}
											<details className="text-xs text-gray-400">
												<summary className="cursor-pointer">
													本次回能明细
												</summary>
												{row.energyEvents.map((event) => (
													<p
														key={`${event.targetId}-${event.source}-${event.amount}`}
													>
														{
															ctx.characters.find(
																(character) => character.id === event.targetId,
															)?.name
														}{" "}
														· {event.source}：
														{event.fixed ? "固定" : "基础回能×效率"}{" "}
														{format(event.amount)}
													</p>
												))}
											</details>
										</td>
										<td className="max-w-md whitespace-normal px-3 py-2">
											<span className="text-gray-400">
												{row.buffs.join("、")}
											</span>
											<DamageAreas row={row} />
											{row.warnings.map((warning) => (
												<p key={warning} className="text-amber-300">
													{warning}
												</p>
											))}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</>
			)}
		</section>
	);
}
