import { formatActionValue } from "../../utils/actionSequence";

export function ActionLimitMarkerRow({
	colSpan,
	actionLimit,
}: {
	colSpan: number;
	actionLimit: number;
}) {
	return (
		<tr className="bg-[#0f172acc]">
			<td colSpan={colSpan} className="px-3 py-2">
				<div className="flex items-center gap-3 text-xs text-cyan-100">
					<div className="h-px flex-1 border-t border-dashed border-cyan-400/60" />
					<span className="whitespace-nowrap rounded-full border border-cyan-400/60 bg-cyan-950/50 px-3 py-1 font-medium">
						原设定行动值上限 {formatActionValue(actionLimit)}
					</span>
					<div className="h-px flex-1 border-t border-dashed border-cyan-400/60" />
				</div>
			</td>
		</tr>
	);
}
