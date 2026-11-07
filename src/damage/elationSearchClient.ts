import {
	type AxisEvaluation,
	type AxisSearchResult,
	type SearchProgress,
	type SearchQuality,
	type SearchStats,
	searchElationAxis,
} from "./elationSearch";
import type { EvaluationReply } from "./elationSearchEvaluation";
import type { ElationTeamConfig } from "./elationTypes";
export type SearchSession = {
	result: Promise<AxisSearchResult>;
	cancel: () => void;
};
export function startElationSearch(
	config: ElationTeamConfig,
	quality: SearchQuality,
	threads: number,
	onProgress: (p: SearchProgress) => void,
): SearchSession {
	const workers: Worker[] = [];
	const pending = new Map<
		number,
		{ resolve: (s: SearchStats) => void; reject: (e: Error) => void }
	>();
	let cancelled = false,
		nextId = 0;
	let failure: Error | undefined;
	const stop = () => {
		workers.forEach((w) => {
			w.terminate();
		});
		pending.forEach((p) => {
			p.reject(new Error("搜索已取消"));
		});
		pending.clear();
	};
	const cancel = () => {
		cancelled = true;
		stop();
	};
	const result = (async () => {
		if (typeof Worker === "undefined")
			throw new Error("当前浏览器不支持后台搜索，请使用新版浏览器");
		try {
			for (
				let i = 0;
				i < Math.max(1, Math.min(4, Math.floor(threads) || 1));
				i++
			) {
				const worker = new Worker(
					new URL("./elationSearch.worker.ts", import.meta.url),
					{ type: "module" },
				);
				worker.onmessage = (event: MessageEvent<EvaluationReply>) => {
					const p = pending.get(event.data.id);
					if (!p) return;
					pending.delete(event.data.id);
					if (event.data.error || !event.data.stats)
						p.reject(new Error(event.data.error || "后台计算未返回结果"));
					else p.resolve(event.data.stats);
				};
				worker.onerror = (event) => {
					event.preventDefault();
					failure = new Error("后台计算失败，请重试或减少并行线程");
					pending.forEach((p) => {
						p.reject(failure as Error);
					});
					pending.clear();
				};
				workers.push(worker);
			}
			const evaluate = async (jobs: AxisEvaluation[]) => {
				if (failure) throw failure;
				const outputs: SearchStats[] = new Array(jobs.length);
				let cursor = 0;
				await Promise.all(
					workers.map(async (worker) => {
						while (cursor < jobs.length) {
							if (failure) throw failure;
							if (cancelled) throw new Error("搜索已取消");
							const index = cursor++,
								id = nextId++;
							outputs[index] = await new Promise<SearchStats>(
								(resolve, reject) => {
									pending.set(id, { resolve, reject });
									worker.postMessage({ id, config, job: jobs[index] });
								},
							);
						}
					}),
				);
				return outputs;
			};
			return await searchElationAxis(
				config,
				quality,
				evaluate,
				onProgress,
				() => cancelled,
			);
		} finally {
			stop();
		}
	})();
	return { result, cancel };
}
