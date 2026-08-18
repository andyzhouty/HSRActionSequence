import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { hasSpRobin } from "../../mechanics/spRobin";

/** 知更鸟·晴歌狂热状态开关：敌我双方任意目标任意回合的右键菜单均显示。 */
export function SpRobinFeverSection() {
	const ctx = useActionSequence();
	const key = [...ctx.selectedActionKeys][0];
	if (!key) return null;
	const spRobin = ctx.characters.find((character) => hasSpRobin(character));
	if (!spRobin) return null;
	if (!ctx.actions.some((action) => action.key === key)) return null;
	// 沿行动表继承状态：狂热倒计时结束或右键关闭后为关闭，右键开启后为开启。
	let fever = false;
	for (const action of ctx.actions) {
		if (action.isSpRobinFeverCountdownAction) {
			fever = false;
			continue;
		}
		const configured = ctx.spRobinFeverToggles[action.key];
		if (configured !== undefined) fever = configured;
		if (action.key === key) break;
	}
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">Fever：</span>
			<button
				type="button"
				onClick={() =>
					ctx.setSpRobinFeverToggles((previous) => ({
						...previous,
						[key]: !fever,
					}))
				}
				className={`rounded-md px-3 py-1 text-xs font-medium ${
					fever
						? "bg-pink-700 text-pink-100"
						: "bg-gray-700 text-gray-400 hover:bg-gray-600"
				}`}
			>
				{fever ? "Fever中" : "进入Fever"}
			</button>
		</div>
	);
}
