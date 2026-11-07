import { useMemo, useState } from "react";
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
import { getCharacterCid } from "../data/characters";
import { analyzeSparxieRenewal } from "../mechanics/sparxieLottery";
import type { SavedData } from "../utils/action-sequence";

const number = (n: number) =>
	n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
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
			className="mt-4 rounded-xl border border-gray-700 bg-gray-800 p-4 text-gray-200"
		>
			<div className="flex flex-wrap items-center justify-between gap-3">
				<h3 className="text-lg font-semibold">银狼欢愉队伤害试验 · 4.6.54</h3>
				<label className="text-sm">
					导入队伍第三位{" "}
					<select
						aria-label="导入队伍第三位"
						value={importThird}
						onChange={(e) => setImportThird(e.target.value as "mc" | "sparxie")}
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
						onChange={(e) => setPearlSlot(e.target.value as typeof pearlSlot)}
						className="bg-gray-900"
					>
						<option value="none">不加入真珠</option>
						<option value="yao">替换爻光</option>
						<option value="third">替换第三位</option>
						<option value="huo">替换藿藿</option>
					</select>
				</label>
				<label className="cursor-pointer rounded border border-gray-500 p-2 text-sm">
					导入指定队伍配装
					<input
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
								setMessage("已读取遗器，并按指定星魂和光锥生成验证轴");
							} catch (error) {
								setMessage(
									error instanceof Error ? error.message : String(error),
								);
							}
							e.target.value = "";
						}}
					/>
				</label>
			</div>
			<p className="my-2 text-sm text-gray-400">
				导入默认队伍为银狼、爻光、欢愉主、强化藿藿；第三位可换火花并保留文件星魂与光锥。下表按实际配置、能量和战技点生成验证轴，速度与随机结果会影响动作顺序。
			</p>
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
						{numeric("enemySpeed", "敌人速度")}
						{numeric("enemyLevel", "敌人等级")}
						{numeric("limit", "统计行动值")}
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
										onChange={(e) => set({ pearlBlueprintId: e.target.value })}
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
								onChange={(e) => set({ huoSkillEvery: Number(e.target.value) })}
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
								onChange={(e) => set({ mcSkillEvery: Number(e.target.value) })}
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
											<td>{p.character.name}</td>
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
													.map(([id, n]) => `${id}×${n}`)
													.join(" / ")}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</details>
					)}
					{result.warnings.map((w) => (
						<p className="my-1 text-sm text-amber-300" key={w}>
							{w}
						</p>
					))}
					<p className="my-3 text-lg">
						本次随机轴总伤害（暴击期望）：
						<output aria-label="银狼队总伤害">{number(result.total)}</output>
					</p>
					<p className="text-sm">
						{Object.entries(result.byActor)
							.map(([actor, d]) => `${actor}：${number(d)}`)
							.join("；")}
					</p>
					<p className="my-2 text-sm text-gray-400">
						攒分只调整开大和队友Q时机，不暂停或延迟角色行动。末段窗口填0表示不放宽开大门槛。
					</p>
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
					<div className="max-h-[600px] overflow-auto">
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
														；负债{r.starDebt ?? "未设敌人HP"}；负债导致生命流失
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
														火花保底计数{r.sparxiePity}，爆点{r.sparxieBooms}；
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
				</>
			)}
		</section>
	);
}
