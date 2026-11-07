import { type ReactNode, useEffect, useState } from "react";
export function DamageWorkspace({
	elation,
	phainon,
	phainonActive,
}: {
	elation: ReactNode;
	phainon: ReactNode;
	phainonActive: boolean;
}) {
	const [tab, setTab] = useState("elation");
	useEffect(() => {
		if (phainonActive) setTab("phainon");
	}, [phainonActive]);
	return (
		<section
			id="damage-calculator"
			className="mt-6 scroll-mt-4"
			aria-label="伤害计算"
		>
			<div className="rounded-t-xl border border-gray-700 bg-gray-900 p-4">
				<h2 className="text-xl font-semibold text-white">伤害计算</h2>
				<p className="my-2 text-sm text-gray-400">
					选择队伍类型，再导入配装。欢愉队自动生成行动轴；白厄队计算上方手动轴的伤害。
				</p>
				<div role="tablist" aria-label="伤害计算类型" className="flex gap-2">
					{[
						{ id: "elation", label: "欢愉队 · 自动模拟" },
						{ id: "phainon", label: "白厄队 · 手动排轴" },
					].map((item) => (
						<button
							key={item.id}
							type="button"
							role="tab"
							tabIndex={tab === item.id ? 0 : -1}
							aria-selected={tab === item.id}
							aria-controls={`damage-${item.id}`}
							id={`damage-tab-${item.id}`}
							onClick={() => setTab(item.id)}
							onKeyDown={(e) => {
								if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
									return;
								e.preventDefault();
								const next =
									e.key === "Home"
										? "elation"
										: e.key === "End"
											? "phainon"
											: tab === "elation"
												? "phainon"
												: "elation";
								setTab(next);
								document.getElementById(`damage-tab-${next}`)?.focus();
							}}
							className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === item.id ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-300 hover:bg-gray-700"}`}
						>
							{item.label}
						</button>
					))}
				</div>
			</div>
			<div
				id="damage-elation"
				role="tabpanel"
				aria-labelledby="damage-tab-elation"
				hidden={tab !== "elation"}
			>
				{elation}
			</div>
			<div
				id="damage-phainon"
				role="tabpanel"
				aria-labelledby="damage-tab-phainon"
				hidden={tab !== "phainon"}
			>
				{phainon}
			</div>
		</section>
	);
}
