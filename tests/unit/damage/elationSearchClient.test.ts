import { afterEach, expect, it, vi } from "vitest";
import { startElationSearch } from "../../../src/damage/elationSearchClient";
import type { EvaluationRequest } from "../../../src/damage/elationSearchEvaluation";
import { defaultElationTeamConfig } from "../../../src/damage/elationTypes";
import type { EquipmentProfile } from "../../../src/damage/equipment";

class FakeWorker {
	static all: FakeWorker[] = [];
	onmessage?: (event: unknown) => void;
	onerror?: (event: unknown) => void;
	terminated = false;
	postMessage(data: EvaluationRequest) {
		queueMicrotask(() => {
			if (this.terminated) return;
			const mean = 10000 - Math.abs(data.job.policy.wolfUltMinScore - 560);
			this.onmessage?.({
				data: {
					id: data.id,
					stats: {
						mean,
						min: mean,
						max: mean,
						p10: mean,
						p90: mean,
						samples: data.job.samples,
					},
				},
			});
		});
	}
	constructor() {
		FakeWorker.all.push(this);
	}
	terminate() {
		this.terminated = true;
	}
}
const config = {
	...defaultElationTeamConfig,
	enabled: true,
	profiles: ["银狼LV.999", "爻光", "星神★阿哈", "真珠"].map((name, i) => ({
		character: { id: String(i), name },
	})) as EquipmentProfile[],
};
afterEach(() => {
	vi.unstubAllGlobals();
	FakeWorker.all = [];
});
it("has deterministic results with one or four workers and terminates every worker", async () => {
	vi.stubGlobal("Worker", FakeWorker);
	const one = await startElationSearch(config, "quick", 1, () => {}).result;
	const four = await startElationSearch(config, "quick", 4, () => {}).result;
	expect(one).toEqual(four);
	expect(FakeWorker.all).toHaveLength(5);
	expect(FakeWorker.all.every((w) => w.terminated)).toBe(true);
});
it("rejects cancellation and background errors without leaving pending work", async () => {
	vi.stubGlobal("Worker", FakeWorker);
	const cancelled = startElationSearch(config, "quick", 2, () => {});
	cancelled.cancel();
	await expect(cancelled.result).rejects.toThrow("取消");
	expect(FakeWorker.all.every((w) => w.terminated)).toBe(true);
	FakeWorker.all = [];
	const failed = startElationSearch(config, "quick", 2, () => {});
	FakeWorker.all[0].onerror?.({ preventDefault() {} });
	await expect(failed.result).rejects.toThrow("后台计算失败");
	expect(FakeWorker.all.every((w) => w.terminated)).toBe(true);
});
it("explains unsupported environments instead of blocking the UI thread", async () => {
	vi.stubGlobal("Worker", undefined);
	await expect(
		startElationSearch(config, "quick", 1, () => {}).result,
	).rejects.toThrow("浏览器不支持");
});
