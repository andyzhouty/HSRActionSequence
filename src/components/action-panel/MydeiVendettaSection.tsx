import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { hasMydei } from "../../mechanics/mydei";

/** 万敌血仇与弑神登神：记录在被选行动点，并按行动表顺序继承状态。 */
export function MydeiVendettaSection() {
	const ctx = useActionSequence();
	const mydei = ctx.characters.find((character) => hasMydei(character.name));
	const key = [...ctx.selectedActionKeys][0];
	if (!mydei || !key || !ctx.actions.some((action) => action.key === key)) {
		return null;
	}
	let active = mydei.eidolon >= 6;
	for (const action of ctx.actions) {
		const configured = ctx.mydeiVendettaToggles[action.key];
		if (configured !== undefined) active = configured;
		if (action.key === key) break;
	}
	const godslayerEnabled = ctx.mydeiGodslayerToggles[key] === true;
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">血仇：</span>
			<button
				type="button"
				onClick={() =>
					ctx.setMydeiVendettaToggles((previous) => ({
						...previous,
						[key]: !active,
					}))
				}
				className={`rounded-md px-3 py-1 text-xs font-medium ${active ? "bg-red-700 text-red-100" : "bg-gray-700 text-gray-400 hover:bg-gray-600"}`}
			>
				{active ? "血仇中" : "进入血仇"}
			</button>
			{active && (
				<button
					type="button"
					onClick={() =>
						ctx.setMydeiGodslayerToggles((previous) => {
							const next = { ...previous };
							if (godslayerEnabled) delete next[key];
							else next[key] = true;
							return next;
						})
					}
					className={`rounded-md px-3 py-1 text-xs font-medium ${godslayerEnabled ? "bg-amber-700 text-amber-100" : "bg-gray-700 text-gray-300 hover:bg-gray-600"}`}
				>
					{godslayerEnabled ? "已触发弑神登神" : "弑神登神"}
				</button>
			)}
		</div>
	);
}
