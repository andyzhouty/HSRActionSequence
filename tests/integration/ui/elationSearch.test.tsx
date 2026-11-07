import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ElationSearchPanel } from "../../../src/components/ElationSearchPanel";
import {
	type AxisSearchResult,
	axisPolicy,
} from "../../../src/damage/elationSearch";
import { defaultElationTeamConfig } from "../../../src/damage/elationTypes";
import type { EquipmentProfile } from "../../../src/damage/equipment";

const mocks = vi.hoisted(() => ({ start: vi.fn() }));
vi.mock("../../../src/damage/elationSearchClient", () => ({
	startElationSearch: mocks.start,
}));
afterEach(() => vi.clearAllMocks());
const config = {
	...defaultElationTeamConfig,
	enabled: true,
	profiles: [0, 1, 2, 3].map((i) => ({
		character: { id: String(i), name: String(i) },
	})) as EquipmentProfile[],
};
function deferred() {
	let resolve!: (result: AxisSearchResult) => void;
	const result = new Promise<AxisSearchResult>((r) => {
		resolve = r;
	});
	return { result, resolve, cancel: vi.fn() };
}
function result(): AxisSearchResult {
	const base = { mean: 100, min: 90, max: 110, p10: 90, p90: 110, samples: 32 };
	return {
		baseline: base,
		trainingSamples: 8,
		validationSamples: 32,
		trainingSeed: 1,
		validationSeed: 1000001,
		evaluated: 10,
		simulations: 100,
		candidates: [
			{
				policy: { ...axisPolicy(config), wolfUltMinScore: 560 },
				stats: { ...base, mean: 120 },
				baseline: false,
			},
			{ policy: axisPolicy(config), stats: base, baseline: true },
		],
	};
}
it("shows ranked held-out results and applies only the chosen strategy", async () => {
	const session = deferred();
	mocks.start.mockReturnValue(session);
	const apply = vi.fn();
	render(<ElationSearchPanel config={config} onApply={apply} />);
	fireEvent.click(screen.getByText("开始自动搜轴"));
	expect(screen.getByText("开始自动搜轴")).toBeDisabled();
	await act(async () => {
		session.resolve(result());
	});
	expect(screen.getByText("20.00%")).toBeInTheDocument();
	expect(screen.getByText(/开大分数=560/)).toBeInTheDocument();
	fireEvent.click(screen.getByText("应用第1名"));
	expect(apply).toHaveBeenCalledWith(
		expect.objectContaining({ wolfUltMinScore: 560 }),
	);
	expect(apply.mock.calls[0][0]).not.toHaveProperty("profiles");
});
it("cancels on settings changes and ignores late results", async () => {
	const session = deferred();
	mocks.start.mockReturnValue(session);
	const view = render(<ElationSearchPanel config={config} onApply={vi.fn()} />);
	fireEvent.click(screen.getByText("开始自动搜轴"));
	view.rerender(
		<ElationSearchPanel
			config={{ ...config, enemySpeed: 133 }}
			onApply={vi.fn()}
		/>,
	);
	expect(session.cancel).toHaveBeenCalled();
	await act(async () => {
		session.resolve(result());
	});
	expect(screen.queryByText("应用第1名")).not.toBeInTheDocument();
	expect(screen.getByText("开始自动搜轴")).toBeEnabled();
});
it("supports explicit cancellation and releases workers on unmount", async () => {
	const first = deferred();
	mocks.start.mockReturnValue(first);
	const view = render(<ElationSearchPanel config={config} onApply={vi.fn()} />);
	fireEvent.click(screen.getByText("开始自动搜轴"));
	fireEvent.click(screen.getByText("取消搜索"));
	expect(first.cancel).toHaveBeenCalled();
	expect(screen.getByRole("status")).toHaveTextContent("搜索已取消");
	const next = deferred();
	mocks.start.mockReturnValue(next);
	fireEvent.click(screen.getByText("开始自动搜轴"));
	view.unmount();
	expect(next.cancel).toHaveBeenCalled();
});
it("reports background errors and disables starting without imported profiles", async () => {
	mocks.start.mockReturnValue({
		result: Promise.reject(new Error("后台不可用")),
		cancel: vi.fn(),
	});
	const view = render(<ElationSearchPanel config={config} onApply={vi.fn()} />);
	fireEvent.click(screen.getByText("开始自动搜轴"));
	await waitFor(() =>
		expect(screen.getByRole("status")).toHaveTextContent("后台不可用"),
	);
	view.rerender(
		<ElationSearchPanel
			config={{ ...config, profiles: [] }}
			onApply={vi.fn()}
		/>,
	);
	expect(screen.getByText("开始自动搜轴")).toBeDisabled();
});
