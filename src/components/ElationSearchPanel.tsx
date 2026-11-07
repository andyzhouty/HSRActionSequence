import { useEffect, useRef, useState } from "react";
import {
	type AxisPolicy,
	type AxisSearchResult,
	axisKeys,
	type SearchProgress,
	type SearchQuality,
} from "../damage/elationSearch";
import {
	type SearchSession,
	startElationSearch,
} from "../damage/elationSearchClient";
import type { ElationTeamConfig } from "../damage/elationTypes";

const amount = (n: number) =>
	n.toLocaleString("zh-CN", { maximumFractionDigits: 0 });
const labels: Record<(typeof axisKeys)[number], string> = {
	wolfUltMinScore: "开大分数",
	wolfUltRushWindow: "末段放宽AV",
	wolfSupportTiming: "队友Q",
	starSkillEvery: "虚照E间隔",
	pearlSkillEvery: "真珠E间隔",
	starEnvoyId: "使者",
	pearlBlueprintId: "底本",
	huoSkillEvery: "藿藿E间隔",
	mcSkillEvery: "主角E间隔",
	sparxieJackpotTarget: "火花目标大奖",
};
export function ElationSearchPanel({
	config,
	onApply,
}: {
	config: ElationTeamConfig;
	onApply: (policy: AxisPolicy) => void;
}) {
	const [quality, setQuality] = useState<SearchQuality>("quick");
	const [threads, setThreads] = useState(() =>
		Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)),
	);
	const [running, setRunning] = useState(false);
	const [message, setMessage] = useState("");
	const [progress, setProgress] = useState<SearchProgress>();
	const [result, setResult] = useState<AxisSearchResult>();
	const session = useRef<SearchSession | null>(null);
	const generation = useRef(0);
	const signature = JSON.stringify(config);
	// A result always belongs to exactly the settings shown when search started.
	useEffect(() => {
		void signature;
		generation.current++;
		session.current?.cancel();
		session.current = null;
		setRunning(false);
		setResult(undefined);
		setProgress(undefined);
		setMessage("");
		return () => {
			generation.current++;
			session.current?.cancel();
			session.current = null;
		};
	}, [signature]);
	const start = async () => {
		session.current?.cancel();
		const run = ++generation.current;
		setRunning(true);
		setResult(undefined);
		setProgress(undefined);
		setMessage("");
		const active = startElationSearch(
			structuredClone(config),
			quality,
			threads,
			(p) => {
				if (run === generation.current) setProgress(p);
			},
		);
		session.current = active;
		try {
			const found = await active.result;
			if (run === generation.current) setResult(found);
		} catch (error) {
			if (run === generation.current)
				setMessage(error instanceof Error ? error.message : String(error));
		} finally {
			if (run === generation.current) {
				setRunning(false);
				session.current = null;
			}
		}
	};
	const cancel = () => {
		generation.current++;
		session.current?.cancel();
		session.current = null;
		setRunning(false);
		setMessage("搜索已取消");
	};
	const display = (key: (typeof axisKeys)[number], value: string | number) => {
		if (key === "starEnvoyId" || key === "pearlBlueprintId")
			return (
				config.profiles.find((p) => p.character.id === value)?.character.name ??
				"默认"
			);
		if (key === "wolfSupportTiming")
			return value === "immediate" ? "立即" : "240分";
		return String(value);
	};
	return (
		<section
			aria-label="后台自动搜轴"
			className="my-3 rounded border border-gray-600 p-3"
		>
			<h4 className="font-semibold">后台自动搜轴</h4>
			<p className="my-2 text-sm text-gray-400">
				保持当前配装，自动比较开大时机和技能循环。点击开始即可，搜索期间仍可操作页面；关闭或刷新页面会停止。
			</p>
			<div className="flex flex-wrap items-center gap-3 text-sm">
				<label>
					搜索精度{" "}
					<select
						aria-label="搜索精度"
						disabled={running}
						value={quality}
						onChange={(e) => setQuality(e.target.value as SearchQuality)}
						className="bg-gray-900"
					>
						<option value="quick">快速 · 先找一条较优轴</option>
						<option value="thorough">深入 · 更多比较、更长耗时</option>
					</select>
				</label>
				<details>
					<summary className="cursor-pointer text-gray-400">计算资源</summary>
					<label>
						并行线程{" "}
						<select
							aria-label="并行线程"
							disabled={running}
							value={threads}
							onChange={(e) => setThreads(Number(e.target.value))}
							className="bg-gray-900"
						>
							{[1, 2, 3, 4].map((n) => (
								<option key={n} value={n}>
									{n}
								</option>
							))}
						</select>
					</label>
				</details>
				<button
					type="button"
					className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
					disabled={running || !config.enabled || config.profiles.length !== 4}
					onClick={start}
				>
					开始自动搜轴
				</button>
				{running && (
					<button
						type="button"
						className="rounded border px-3 py-1"
						onClick={cancel}
					>
						取消搜索
					</button>
				)}
			</div>
			<p role="status" className="my-2 text-sm">
				{message ||
					(progress
						? `${progress.phase} · 已评估${progress.evaluated}个候选 · ${progress.simulations}次模拟`
						: "搜索在浏览器后台计算，修改配置会清除旧结果并停止搜索。")}
			</p>
			{result && (
				<>
					<p className="my-2 text-sm">
						结果按多次模拟的平均伤害排序。应用后会更新技能循环；下方行动明细展示一次模拟，数值可能与均伤不同。
					</p>
					<details className="my-2 text-sm text-gray-400">
						<summary className="cursor-pointer">搜索方法与采样说明</summary>
						<p>
							当前策略复核均伤：{amount(result.baseline.mean)}；粗筛种子起点
							{result.trainingSeed}，复核种子起点{result.validationSeed}
							。下表每项使用同一组{result.validationSamples}
							个复核种子；P10/P90为这组采样的分位数。应用后下方明细仍按当前单个种子展示。
							不保证全局最优。
						</p>
					</details>
					<div className="overflow-auto">
						<table className="my-2 w-full whitespace-nowrap text-left text-sm">
							<thead>
								<tr>
									{[
										"排名",
										"平均总伤",
										"相对当前",
										"P10 / P90",
										"策略",
										"操作",
									].map((t) => (
										<th key={t} className="p-2">
											{t}
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{result.candidates.map((candidate, index) => (
									<tr
										key={JSON.stringify(candidate.policy)}
										className="border-t border-gray-700"
									>
										<td className="p-2">
											{index + 1}
											{candidate.baseline ? "（当前）" : ""}
										</td>
										<td className="p-2">{amount(candidate.stats.mean)}</td>
										<td className="p-2">
											{result.baseline.mean > 0
												? `${((candidate.stats.mean / result.baseline.mean - 1) * 100).toFixed(2)}%`
												: "—"}
										</td>
										<td className="p-2">
											{amount(candidate.stats.p10)} /{" "}
											{amount(candidate.stats.p90)}
										</td>
										<td className="max-w-md whitespace-normal p-2">
											{axisKeys
												.filter((k) => candidate.policy[k] !== config[k])
												.map(
													(k) =>
														`${labels[k]}=${display(k, candidate.policy[k])}`,
												)
												.join("；") || "保持当前策略"}
										</td>
										<td className="p-2">
											<button
												type="button"
												disabled={candidate.baseline}
												className="rounded border px-2 py-1 disabled:opacity-50"
												onClick={() => onApply(candidate.policy)}
											>
												应用第{index + 1}名
											</button>
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
