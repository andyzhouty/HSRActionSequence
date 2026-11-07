import { useEffect, useMemo, useState } from "react";
import { createElationTeamPreset } from "../damage/elationPreset";
import {
	type ElationTeamResult,
	simulateElationTeam,
} from "../damage/elationTeam";
import {
	defaultElationTeamConfig,
	type ElationTeamConfig,
	normalizeElationTeamConfig,
} from "../damage/elationTypes";
import { lightconeName } from "../damage/metadata";
import { getCharacterCid } from "../data/characters";
import relicData from "../data/elationRelicSets.json";
import { analyzeSparxieRenewal } from "../mechanics/sparxieLottery";
import type { SavedData } from "../utils/action-sequence";
import { ElationSearchPanel } from "./ElationSearchPanel";

const number = (n: number) =>
	n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const teamPlans = [
	{
		name: "银狼 / 爻光 / 欢愉主 / 藿藿",
		third: "mc",
		star: "none",
		pearl: "none",
	},
	{
		name: "银狼 / 爻光 / 火花 / 藿藿",
		third: "sparxie",
		star: "none",
		pearl: "none",
	},
	{
		name: "银狼 / 爻光 / 虚照 / 藿藿",
		third: "mc",
		star: "third",
		pearl: "none",
	},
	{
		name: "银狼 / 爻光 / 真珠 / 藿藿",
		third: "mc",
		star: "none",
		pearl: "third",
	},
	{
		name: "银狼 / 爻光 / 真珠 / 虚照",
		third: "mc",
		star: "huo",
		pearl: "third",
	},
	{
		name: "银狼 / 真珠 / 火花 / 虚照",
		third: "sparxie",
		star: "huo",
		pearl: "yao",
	},
] as const;
export function ElationDamagePanel({
	value,
	onChange,
	onImport,
}: {
	value?: ElationTeamConfig;
	onChange: (v: ElationTeamConfig) => void;
	onImport: (v: Partial<SavedData>) => void;
}) {
	const config = value ?? defaultElationTeamConfig;
	const [message, setMessage] = useState("");
	const [pearlSlot, setPearlSlot] = useState<"none" | "yao" | "third" | "huo">(
		"none",
	);
	const [starSlot, setStarSlot] = useState<"none" | "yao" | "third" | "huo">(
		"none",
	);
	const [importThird, setImportThird] = useState<"mc" | "sparxie">("mc");
	const [customTeam, setCustomTeam] = useState(false);
	const [preserveEquipment, setPreserveEquipment] = useState(true);
	const planIndex = teamPlans.findIndex(
		(p) =>
			p.third === importThird && p.star === starSlot && p.pearl === pearlSlot,
	);
	const conflict = starSlot !== "none" && starSlot === pearlSlot;
	const importedTeam = config.profiles
		.map((p) => getCharacterCid(p.character.name))
		.sort()
		.join(",");
	useEffect(() => {
		if (!importedTeam) return;
		const plan = teamPlans.find((p) => {
			const ids = ["1506", "1502", p.third === "mc" ? "8010" : "1501", "1217"];
			if (p.star !== "none") ids[p.star === "third" ? 2 : 3] = "1511";
			if (p.pearl !== "none") ids[p.pearl === "yao" ? 1 : 2] = "1503";
			return ids.sort().join(",") === importedTeam;
		});
		if (plan) {
			setImportThird(plan.third);
			setStarSlot(plan.star);
			setPearlSlot(plan.pearl);
			setCustomTeam(false);
		}
	}, [importedTeam]);
	const lotteryAnalysis = useMemo(
		() => [1, 2, 3].map((n) => analyzeSparxieRenewal(n as 1 | 2 | 3)),
		[],
	);
	const [ensemble, setEnsemble] = useState<
		{ mean: number; min: number; max: number } | undefined
	>();
	const result = useMemo(() => {
		try {
			return simulateElationTeam(config);
		} catch (e) {
			return {
				rows: [],
				cycles: [],
				ahaBaseSpeed: 80,
				total: 0,
				byActor: {},
				events: 0,
				warnings: [e instanceof Error ? e.message : String(e)],
			} as ElationTeamResult;
		}
	}, [config]);
	const set = (patch: Partial<ElationTeamConfig>) => {
		setEnsemble(undefined);
		try {
			const next = normalizeElationTeamConfig({ ...config, ...patch });
			if (next) onChange(next);
		} catch (error) {
			setMessage(error instanceof Error ? error.message : String(error));
		}
	};
	const numeric = (
		key:
			| "enemySpeed"
			| "enemyLevel"
			| "limit"
			| "seed"
			| "pearlSkillEvery"
			| "enemyAttackDamage"
			| "enemyMaxHp"
			| "starSkillEvery"
			| "hiddenScoreCap"
			| "boxBeanCurveK"
			| "wolfUltMinScore"
			| "wolfUltRushWindow",
		label: string,
	) => (
		<label className="text-sm" key={key}>
			{label}
			<input
				aria-label={label}
				className="ml-2 w-24 rounded bg-gray-900 p-1"
				type="number"
				value={config[key]}
				onChange={(e) => set({ [key]: Number(e.target.value) })}
			/>
		</label>
	);
	const exportReport = () => {
		const blob = new Blob([JSON.stringify({ config, result }, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "elation-team-damage-report.json";
		a.click();
		URL.revokeObjectURL(url);
	};
	return (
		<section
			aria-label="银狼欢愉队伤害试验"
			className="mt-4 rounded-xl border border-gray-700 bg-gray-800 p-4 text-gray-200 [&_select]:text-gray-200"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="text-lg font-semibold">
					欢愉队伤害计算{" "}
					<span className="text-xs font-normal text-gray-400">数据 4.6.54</span>
				</h3>
			</div>
			<div className="my-4 rounded-lg bg-gray-900/60 p-4">
				<h4 className="mb-3 font-semibold">1. 选择队伍并导入配装</h4>
				<label className="block text-sm">
					队伍方案
					<select
						aria-label="队伍方案"
						className="mt-2 block w-full rounded border border-gray-600 bg-gray-800 p-2"
						value={customTeam || planIndex < 0 ? "custom" : String(planIndex)}
						onChange={(e) => {
							if (e.target.value === "custom") {
								setCustomTeam(true);
								return;
							}
							const p = teamPlans[Number(e.target.value)];
							setImportThird(p.third);
							setStarSlot(p.star);
							setPearlSlot(p.pearl);
							setCustomTeam(false);
						}}
					>
						{teamPlans.map((p, i) => (
							<option key={p.name} value={i}>
								{p.name}
							</option>
						))}
						<option value="custom">自定义队友组合</option>
					</select>
				</label>
				<details
					className="my-3 text-sm"
					open={customTeam}
					onToggle={(e) => setCustomTeam(e.currentTarget.open)}
				>
					<summary className="cursor-pointer text-gray-400">
						自定义队友组合
					</summary>
					<div className="mt-2 flex flex-wrap gap-3">
						<label className="text-sm">
							导入队伍第三位{" "}
							<select
								aria-label="导入队伍第三位"
								value={importThird}
								onChange={(e) =>
									setImportThird(e.target.value as "mc" | "sparxie")
								}
								className="bg-gray-900"
							>
								<option value="mc">欢愉主</option>
								<option value="sparxie">火花（保留文件星魂及光锥）</option>
							</select>
						</label>
						<label className="text-sm">
							导入虚照位置{" "}
							<select
								aria-label="导入虚照位置"
								className="bg-gray-900"
								value={starSlot}
								onChange={(e) => setStarSlot(e.target.value as typeof starSlot)}
							>
								<option value="none">不加入虚照</option>
								<option value="yao">替换爻光</option>
								<option value="third">替换第三位</option>
								<option value="huo">替换藿藿</option>
							</select>
						</label>
						<label className="text-sm">
							导入真珠位置{" "}
							<select
								aria-label="导入真珠位置"
								value={pearlSlot}
								onChange={(e) =>
									setPearlSlot(e.target.value as typeof pearlSlot)
								}
								className="bg-gray-900"
							>
								<option value="none">不加入真珠</option>
								<option value="yao">替换爻光</option>
								<option value="third">替换第三位</option>
								<option value="huo">替换藿藿</option>
							</select>
						</label>
					</div>
				</details>
				{conflict && (
					<p role="alert" className="my-2 text-sm text-amber-300">
						虚照和真珠选择了同一位置，请为其中一位选择其他位置。
					</p>
				)}
				<label className="my-3 block text-sm">
					配装来源
					<select
						aria-label="配装来源"
						value={preserveEquipment ? "file" : "trial"}
						onChange={(e) => setPreserveEquipment(e.target.value === "file")}
						className="ml-2 rounded bg-gray-800 p-2"
					>
						<option value="file">使用文件中的星魂、光锥与遗器</option>
						<option value="trial">
							使用旧版验证配置（替换部分星魂与光锥）
						</option>
					</select>
				</label>
				{!preserveEquipment && (
					<p className="mb-3 text-sm text-amber-300">
						银狼2魂专锥叠1、爻光1魂菇菇嘎嘎叠5、欢愉主6魂菇菇嘎嘎叠5、强化藿藿1魂同一种心情叠5；火花、虚照、真珠保留文件配置。
					</p>
				)}
				<label
					className={`inline-block rounded-lg px-4 py-2 text-sm font-semibold ${conflict ? "bg-gray-700 text-gray-400" : "cursor-pointer bg-blue-600 text-white hover:bg-blue-500"}`}
				>
					选择 FreeSR 文件并计算
					<input
						disabled={conflict}
						className="sr-only"
						aria-label="导入银狼欢愉队配装"
						type="file"
						accept=".json,application/json"
						onChange={async (e) => {
							const file = e.target.files?.[0];
							if (!file) return;
							try {
								const next = createElationTeamPreset(
									JSON.parse((await file.text()).replace(/^\uFEFF/, "")),
									file.name,
									importThird,
									starSlot,
									pearlSlot,
									preserveEquipment,
								);
								onImport({
									characters: next.profiles.map((p) => p.character),
									elationTeamTrial: next,
									phainonDamageTrial: undefined,
									limitPreset: "自定义",
									customLimit: "300",
									displayedLimit: "300",
									resources: [],
									skillOverrides: {},
									ultInterrupts: {},
									overrides: {},
								});
								setEnsemble(undefined);
								setMessage(
									`已导入 ${file.name}，${preserveEquipment ? "保留原配装" : "使用验证配置"}并完成计算。`,
								);
							} catch (error) {
								const reason =
									error instanceof Error ? error.message : String(error);
								setMessage(
									reason.includes("尚未实现光锥")
										? `${reason}。可切换上方配装来源为旧版验证配置，或选择已支持光锥的队伍。`
										: `导入失败：${reason}`,
								);
							}
							e.target.value = "";
						}}
					/>
				</label>
				<p className="mt-3 text-sm text-gray-400">
					选择
					freesr-data.json，导入后自动计算。导入会替换当前队伍及行动轴；原文件不会被修改。
				</p>
				{config.sourceFile && (
					<p className="mt-2 text-sm text-blue-200">
						当前配装：{config.sourceFile.split(/[\\/]/).pop()} ·{" "}
						{config.profiles.map((p) => p.character.name).join(" / ")}
					</p>
				)}
			</div>
			{message && (
				<p role="status" className="my-2 text-sm">
					{message}
				</p>
			)}
			<label className="text-sm">
				<input
					type="checkbox"
					checked={config.enabled}
					onChange={(e) => set({ enabled: e.target.checked })}
				/>
				启用银狼欢愉队伤害计算
			</label>
			{config.enabled && (
				<>
					<div className="my-4 rounded-lg bg-gray-900/60 p-4">
						<h4 className="mb-3 font-semibold">2. 设置战斗</h4>
						<div className="flex flex-wrap gap-4">
							{numeric("limit", "统计行动值")}
							{numeric("enemyLevel", "敌人等级")}
							{numeric("enemySpeed", "敌人速度")}
							<label className="text-sm">
								敌人数量
								<select
									aria-label="敌人数量"
									className="ml-2 rounded bg-gray-800 p-1"
									value={config.enemyCount}
									onChange={(e) => set({ enemyCount: Number(e.target.value) })}
								>
									{[1, 2, 3, 4, 5].map((n) => (
										<option key={n} value={n}>
											{n}
										</option>
									))}
								</select>
							</label>
						</div>
						<p className="mt-3 text-sm text-gray-400">
							设置修改后自动更新结果。默认统计300行动值、95级单体敌人，敌人速度132。
						</p>
					</div>
					<section
						aria-label="伤害结果"
						className="my-4 rounded-lg border border-blue-800 bg-blue-950/30 p-4"
					>
						<h4 className="font-semibold">3. 查看结果或优化行动轴</h4>
						<p className="mt-3 text-sm text-blue-200">
							当前单次模拟 · {config.limit}行动值 ·{" "}
							{config.critExpectation ? "暴击期望" : "全暴击"}
						</p>
						<output
							aria-label="银狼队总伤害"
							className="my-2 block text-2xl font-semibold tabular-nums text-white sm:text-3xl"
						>
							{number(result.total)}
						</output>
						{result.total >= 10000 && (
							<p className="mb-3 text-sm text-blue-200">
								约
								{number(
									result.total >= 1e8 ? result.total / 1e8 : result.total / 1e4,
								)}
								{result.total >= 1e8 ? "亿" : "万"}
							</p>
						)}
						<div className="flex flex-wrap gap-2">
							{Object.entries(result.byActor).map(([actor, d]) => (
								<span
									key={actor}
									className="rounded bg-gray-900/60 px-3 py-2 text-sm"
								>
									{actor} <strong>{number(d)}</strong>
								</span>
							))}
						</div>
						<p className="mt-3 text-sm text-gray-400">
							想比较更好的技能循环？使用下方自动搜轴，再应用候选。均伤与当前单次结果可能不同。
						</p>
					</section>
					<ElationSearchPanel config={config} onApply={set} />
					<details className="my-4 rounded-lg border border-gray-700 p-3">
						<summary className="cursor-pointer font-semibold">
							高级设置：技能循环、随机种子与计算口径
						</summary>
						<details className="my-2 text-sm">
							<summary>火花互动抽奖与长期收益</summary>
							<label>
								每轮目标大奖数{" "}
								<select
									aria-label="火花每轮目标大奖数"
									value={config.sparxieJackpotTarget}
									onChange={(e) =>
										set({
											sparxieJackpotTarget: Number(e.target.value) as 1 | 2 | 3,
										})
									}
									className="bg-gray-900"
								>
									{[1, 2, 3].map((n) => (
										<option key={n} value={n}>
											{n}个大奖停手
										</option>
									))}
								</select>
							</label>
							<p>
								每轮3大奖25小奖，无放回，最多20抽；7抽保底，进战保底计数4，计数跨轮继承。战技点或爆点耗尽也会提前停手。下列精确长期值不含战技点上限溢出、爆点抵扣及队友产点。
							</p>
							<table>
								<thead>
									<tr>
										<th>大奖目标</th>
										<th>每次大奖平均抽数</th>
										<th>每净战技点产笑</th>
									</tr>
								</thead>
								<tbody>
									{lotteryAnalysis.map((r) => (
										<tr key={r.target}>
											<td>{r.target}</td>
											<td>{r.drawsPerJackpot.toFixed(3)}</td>
											<td>{r.jokesPerNetSp.toFixed(3)}</td>
										</tr>
									))}
								</tbody>
							</table>
						</details>

						<div className="my-3 flex flex-wrap gap-3">
							{numeric("seed", "盲盒随机种子")}
							<label className="text-sm">
								阿哈基础速度规则
								<select
									aria-label="阿哈基础速度规则"
									className="ml-2 rounded bg-gray-900 p-1"
									value={config.ahaBaseSpeedRule}
									onChange={(e) =>
										set({
											ahaBaseSpeedRule: e.target.value as
												| "fixed80"
												| "starInParty",
										})
									}
								>
									<option value="fixed80">旧版：基础值固定80</option>
									<option value="starInParty">仅星神在队时允许替换</option>
								</select>
							</label>
							<span className="text-sm">
								本队阿哈基础速度：{result.ahaBaseSpeed}
							</span>

							{config.profiles.some(
								(p) => getCharacterCid(p.character.name) === "1511",
							) && (
								<>
									{numeric("starSkillEvery", "虚照E间隔")}
									{numeric("enemyMaxHp", "敌人生命上限（0为不计负债生命流失）")}
									<label>
										令使目标{" "}
										<select
											aria-label="虚照令使目标"
											className="bg-gray-900"
											value={config.starEnvoyId}
											onChange={(e) => set({ starEnvoyId: e.target.value })}
										>
											<option value="">默认银狼</option>
											{config.profiles
												.filter(
													(p) => getCharacterCid(p.character.name) !== "1511",
												)
												.map((p) => (
													<option key={p.character.id} value={p.character.id}>
														{p.character.name}
													</option>
												))}
										</select>
									</label>
								</>
							)}
							{config.profiles.some(
								(p) => getCharacterCid(p.character.name) === "1503",
							) && (
								<>
									{numeric("pearlSkillEvery", "真珠E间隔")}
									{numeric(
										"enemyAttackDamage",
										"群攻每人待抵挡伤害（0为不扣抵御）",
									)}
									<label>
										美学底本{" "}
										<select
											aria-label="真珠美学底本"
											value={config.pearlBlueprintId}
											onChange={(e) =>
												set({ pearlBlueprintId: e.target.value })
											}
											className="bg-gray-900"
										>
											<option value="">默认虚照，其次银狼</option>
											{config.profiles
												.filter(
													(p) => getCharacterCid(p.character.name) !== "1503",
												)
												.map((p) => (
													<option key={p.character.id} value={p.character.id}>
														{p.character.name}
													</option>
												))}
										</select>
									</label>
									<label>
										复制伤害计入来源{" "}
										<select
											aria-label="真珠复制计入来源"
											value={config.pearlCopyApplause}
											onChange={(e) =>
												set({
													pearlCopyApplause: e.target.value as
														| "pearl"
														| "blueprint",
												})
											}
											className="bg-gray-900"
										>
											<option value="pearl">真珠好活（默认解释）</option>
											<option value="blueprint">底本好活（待实测）</option>
										</select>
									</label>
								</>
							)}
							{numeric("hiddenScoreCap", "隐藏分上限")}
							{numeric("boxBeanCurveK", "笑点概率曲线k")}
							{numeric("wolfUltMinScore", "开大最低隐藏分")}
							{numeric("wolfUltRushWindow", "末段放宽窗口AV")}
							<label className="text-sm">
								队友Q时机
								<select
									aria-label="队友Q时机"
									value={config.wolfSupportTiming}
									className="ml-2 rounded bg-gray-900 p-1"
									onChange={(e) =>
										set({
											wolfSupportTiming: e.target.value as
												| "immediate"
												| "score240",
										})
									}
								>
									<option value="immediate">能量足够即施放</option>
									<option value="score240">留到末次A前追240</option>
								</select>
							</label>

							<label className="text-sm">
								藿藿循环
								<select
									aria-label="藿藿循环"
									className="ml-2 rounded bg-gray-900 p-1"
									value={config.huoSkillEvery}
									onChange={(e) =>
										set({ huoSkillEvery: Number(e.target.value) })
									}
								>
									{[1, 2, 3, 4].map((n) => (
										<option value={n} key={n}>
											E
											{Array(n - 1)
												.fill("A")
												.join("")}
										</option>
									))}
								</select>
							</label>
							<label className="text-sm">
								欢愉主循环
								<select
									aria-label="欢愉主循环"
									className="ml-2 rounded bg-gray-900 p-1"
									value={config.mcSkillEvery}
									onChange={(e) =>
										set({ mcSkillEvery: Number(e.target.value) })
									}
								>
									{[1, 2, 3].map((n) => (
										<option value={n} key={n}>
											E
											{Array(n - 1)
												.fill("A")
												.join("")}
										</option>
									))}
								</select>
							</label>
						</div>
						<details className="my-2 text-sm">
							<summary className="cursor-pointer">实验假设与随机分支</summary>
							<p>
								银狼Q先消耗60隐藏分，再获得入状态行迹与光锥收益。主角Q、爻光Q及主角欢愉技恢复原有产笑与回能。盲盒使用资源动态概率：战技点越少越易恢复战技点，隐藏分越少越易获得笑点。
							</p>
							<p>
								战技点箱概率=0.5×(1−SP/SP上限)；笑点箱概率=0.5×[1−ln(1+k×隐藏分/上限)/ln(1+k)]；真伤箱取剩余概率。默认k=8，即a=C/8。秘技固定怪味豆不随机。
							</p>
							<p>
								强化A暂停弹射的具体段数未在文本中给出，默认在第25/50/75段后开箱。
							</p>
							<div className="my-2 flex gap-2">
								{["第一次", "第二次", "第三次"].map((name, i) => (
									<label key={name}>
										暂停段数
										<input
											className="ml-1 w-16 bg-gray-900"
											type="number"
											value={config.basicPauseCuts[i]}
											onChange={(e) => {
												const cuts = [...config.basicPauseCuts] as [
													number,
													number,
													number,
												];
												cuts[i] = Number(e.target.value);
												set({ basicPauseCuts: cuts });
											}}
										/>
									</label>
								))}
							</div>
							<label>
								<input
									type="checkbox"
									checked={config.mushroomStacks}
									onChange={(e) => set({ mushroomStacks: e.target.checked })}
								/>
								两把菇菇嘎嘎的易伤分来源叠加
							</label>
							<br />
							<label>
								<input
									type="checkbox"
									checked={config.mcTraceStack}
									onChange={(e) => set({ mcTraceStack: e.target.checked })}
								/>
								欢愉主行迹每次欢愉技累加下一E好活
							</label>
							<br />
							<label>
								<input
									type="checkbox"
									checked={config.boxCountsAsAttack}
									onChange={(e) => set({ boxCountsAsAttack: e.target.checked })}
								/>
								强化A内置盲盒也触发大吉大利
							</label>
							<br />
							<label>
								<input
									type="checkbox"
									checked={config.ahaDebt}
									onChange={(e) => set({ ahaDebt: e.target.checked })}
								/>
								计入欢愉负债（阿哈正传，已造成伤害的25%）
							</label>
							<br />
							<label>
								<input
									type="checkbox"
									checked={config.critExpectation}
									onChange={(e) => set({ critExpectation: e.target.checked })}
								/>
								暴击取期望值（取消则为每次都暴击的上限）
							</label>
							<br />
							<label>
								低于50%生命的额外治疗人数
								<input
									aria-label="低血额外治疗人数"
									className="ml-2 w-16 bg-gray-900"
									type="number"
									min="0"
									max="4"
									value={config.lowHpHealTargets}
									onChange={(e) =>
										set({ lowHpHealTargets: Number(e.target.value) })
									}
								/>
							</label>
						</details>
					</details>
					{config.profiles.length > 0 && (
						<details className="my-2 text-sm">
							<summary className="cursor-pointer">导入的面板与遗器</summary>
							<table className="w-full text-left">
								<thead>
									<tr>
										{[
											"角色",
											"速度",
											"攻击力/生命",
											"暴击/暴伤",
											"回能效率",
											"套装",
										].map((t) => (
											<th key={t}>{t}</th>
										))}
									</tr>
								</thead>
								<tbody>
									{config.profiles.map((p) => (
										<tr key={p.character.id}>
											<td>
												{p.character.name} · {p.character.eidolon}魂 /{" "}
												{lightconeName(p.character.lc_id)} 叠
												{p.character.superimpose}
											</td>
											<td>{number(p.speed)}</td>
											<td>
												{number(p.attack)} / {number(p.hp)}
											</td>
											<td>
												{number(p.critRate * 100)}% /{" "}
												{number(p.critDamage * 100)}%
											</td>
											<td>{number((1 + (p.gear.energyRegen ?? 0)) * 100)}%</td>
											<td>
												{Object.entries(p.gear.sets)
													.map(
														([id, n]) =>
															`${(relicData.sets as Record<string, { name: string }>)[id]?.name ?? id}×${n}`,
													)
													.join(" / ")}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</details>
					)}
					{result.events > 0 && (
						<details className="my-3 text-sm text-gray-400">
							<summary className="cursor-pointer">计算说明与待实测项</summary>
							{result.warnings.map((w) => (
								<p key={w} className="my-2">
									{w}
								</p>
							))}
						</details>
					)}
					{result.events === 0 &&
						result.warnings.map((w) => (
							<p className="my-1 text-sm text-amber-300" key={w}>
								{w}
							</p>
						))}
					<details className="my-2 text-sm">
						<summary>逐轮隐藏分与额外普攻</summary>
						<table className="w-full text-left">
							<thead>
								<tr>
									{[
										"开Q AV",
										"退大AV",
										"Q前分数",
										"最高分数",
										"强化A",
										"实际额外A",
									].map((t) => (
										<th key={t}>{t}</th>
									))}
								</tr>
							</thead>
							<tbody>
								{result.cycles.map((c) => (
									<tr key={c.start}>
										<td>{c.start.toFixed(4)}</td>
										<td>{c.end?.toFixed(4) ?? "统计窗内未退大"}</td>
										<td>{number(c.entryHidden)}</td>
										<td>{number(c.peakHidden)}</td>
										<td>{c.basics}</td>
										<td>{c.usedExtras}</td>
									</tr>
								))}
							</tbody>
						</table>
					</details>
					<div className="my-2 flex gap-3">
						<button
							type="button"
							className="rounded border p-2 text-sm"
							onClick={() => {
								try {
									const totals = Array.from(
										{ length: 100 },
										(_, i) =>
											simulateElationTeam({ ...config, seed: config.seed + i })
												.total,
									);
									setEnsemble({
										mean: totals.reduce((a, b) => a + b, 0) / 100,
										min: Math.min(...totals),
										max: Math.max(...totals),
									});
								} catch (e) {
									setMessage(String(e));
								}
							}}
						>
							比较100个随机种子
						</button>
						<button
							type="button"
							className="rounded border p-2 text-sm"
							onClick={exportReport}
						>
							导出计算明细
						</button>
					</div>
					{ensemble && (
						<p className="text-sm">
							假设权重下100次采样：平均{number(ensemble.mean)}，最小
							{number(ensemble.min)}，最大{number(ensemble.max)}
							。真实游戏概率尚待实测。
						</p>
					)}
					<details className="my-3 rounded-lg border border-gray-700 p-3">
						<summary className="cursor-pointer font-semibold">
							查看逐行动明细（{result.rows.length}条）
						</summary>
						<div className="mt-3 max-h-[600px] overflow-auto">
							<table className="w-full whitespace-nowrap text-left text-sm">
								<thead className="sticky top-0 bg-gray-900">
									<tr>
										{[
											"AV",
											"角色 / 技能",
											"结算",
											"伤害 / 累计",
											"笑点 / 隐藏分 / SP",
											"常规能量",
											"明细",
										].map((t) => (
											<th className="p-2" key={t}>
												{t}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{result.rows.map((r) => (
										<tr className="border-t border-gray-700" key={r.key}>
											<td className="p-2">{r.av.toFixed(4)}</td>
											<td className="p-2">
												{r.actor} {r.skill}
											</td>
											<td className="p-2">{r.detail}</td>
											<td className="p-2">
												{number(r.expected)} / {number(r.cumulative)}
											</td>
											<td className="p-2">
												{number(r.jokes)} / {number(r.hidden)} / {r.sp}
											</td>
											<td className="p-2">
												{Object.entries(r.energy).map(([a, n]) => (
													<div key={a}>
														{a}：{number(n)}
													</div>
												))}
											</td>
											<td className="p-2">
												<details>
													<summary>乘区、回能与资源来源</summary>
													{r.pearlCharges !== undefined && (
														<p>
															真珠底本{r.pearlBlueprint ?? "无"}，待返90能量
															{r.pearlEnergyToken ?? "无"}，深度学习
															{r.pearlCharges}充能，好活
															{number(r.pearlApplause ?? 0)}，抵御
															{number(r.pearlResistance ?? 0)}
														</p>
													)}
													{r.borrowedFrom && (
														<p>借用{r.borrowedFrom}的伤害面板</p>
													)}
													{r.healingPerTarget !== undefined && (
														<p>
															每目标理论治疗{number(r.healingPerTarget)}
															（未扣除溢出治疗）
														</p>
													)}
													{r.starWill !== undefined && (
														<p>
															虚照愿力{r.starWill}/10；欢愉万相剩余
															{r.starUniverseTurns}回合；令使
															{r.starEnvoy ?? "未指定"}；隐藏分上限{r.hiddenCap}
															；负债{r.starDebt ?? "未设敌人HP"}
															；负债导致生命流失
															{r.starDebtHpLoss ?? 0}
														</p>
													)}
													{r.starTrueBase !== undefined && (
														<p>
															真伤基数{number(r.starTrueBase)} ×{" "}
															{number((r.starTrueRatio ?? 0) * 100)}%
														</p>
													)}
													{r.boxContext && (
														<p>
															开箱前：SP {r.boxContext.sp}/{r.boxContext.spCap}
															，隐藏分 {r.boxContext.hidden}/
															{r.boxContext.hiddenCap}；
															{r.boxForced
																? "秘技固定怪味豆"
																: r.boxProbabilities &&
																	`战技点箱${number(r.boxProbabilities[1] * 100)}% / 笑点箱${number(r.boxProbabilities[2] * 100)}% / 真伤箱${number(r.boxProbabilities[0] * 100)}%`}
														</p>
													)}
													{r.sparxiePity !== undefined && (
														<p>
															火花保底计数{r.sparxiePity}，爆点{r.sparxieBooms}
															；
															{r.sparxieLottery &&
																`本抽大奖概率${number(r.sparxieLottery.probability * 100)}%，${r.sparxieLottery.forced ? "保底" : "非保底"}`}
														</p>
													)}
													<p>
														倍率{number(r.multiplier * 100)}%，欢愉度
														{number(r.elation * 100)}%，计入笑点
														{number(r.jokesUsed)}
													</p>
													{r.factors && (
														<p>
															暴击{number(r.factors.critRate * 100)}%，暴伤
															{number(r.factors.critDamage * 100)}%，无视防御
															{number(r.factors.defenseIgnore * 100)}%，穿抗
															{number(r.factors.resistancePenetration * 100)}
															%，易伤{number(r.factors.vulnerability * 100)}%
														</p>
													)}
													{r.resourceEvents.map((event) => (
														<p key={`resource-${event.id}`}>
															{
																{
																	jokes: "共享笑点",
																	hidden: "隐藏分",
																	applause: "好活当赏",
																	countedJokes: "本次计入笑点（不产笑）",
																	sp: "战技点",
																	sparxieBoom: "火花爆点",
																	starWill: "虚照愿力",
																	pearlApplause: "真珠好活/抵御",
																}[event.kind]
															}{" "}
															· {event.source}：{number(event.amount)}，
															{number(event.before)}→{number(event.after)}
														</p>
													))}
													{r.energyEvents.map((event) => (
														<p key={event.id}>
															{event.actor} · {event.source}：
															{event.fixed ? "固定" : "基础×效率"}{" "}
															{number(event.amount)}，{number(event.before)}→
															{number(event.after)}
														</p>
													))}
												</details>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</details>
				</>
			)}
		</section>
	);
}
