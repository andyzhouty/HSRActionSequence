import { Fragment } from "react";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import type { GeneratedAction } from "../../utils/actionSequence";
import { formatActionValue } from "../../utils/actionSequence";
import {
	ActionLimitMarkerRow,
	ActionRow,
	type ActionRowDragProps,
} from "../ActionTableRows";

type ActionSequenceTableProps = {
	visibleActions: readonly GeneratedAction[];
	limitMarkerPosition: number;
	elationSkillsByParent: ReadonlyMap<string, readonly GeneratedAction[]>;
	archerArrowChildrenByParent: ReadonlyMap<string, readonly GeneratedAction[]>;
	expandedAhaKeys: ReadonlySet<string>;
	expandedArcherArrowKeys: ReadonlySet<string>;
	onToggleAha: (key: string) => void;
	onToggleArcherArrows: (key: string) => void;
	getDragProps: (action: GeneratedAction) => ActionRowDragProps | undefined;
	elationSkillsExportData: string;
};

/** 行动表及其可展开的阿哈/红A子行动。 */
export function ActionSequenceTable({
	visibleActions,
	limitMarkerPosition,
	elationSkillsByParent,
	archerArrowChildrenByParent,
	expandedAhaKeys,
	expandedArcherArrowKeys,
	onToggleAha,
	onToggleArcherArrows,
	getDragProps,
	elationSkillsExportData,
}: ActionSequenceTableProps) {
	const ctx = useActionSequence();
	const colSpan = 4 + ctx.resources.length;

	return (
		<div
			ref={ctx.imageExportRef}
			data-elation-skills={elationSkillsExportData}
			className="overflow-x-auto rounded-xl border border-gray-700 bg-gray-800 pb-4"
		>
			<div className="bg-gray-800">
				<div className="border-b border-gray-700 bg-[#11182799] px-3 py-2">
					<h3 className="text-lg font-semibold text-white">行动序列</h3>
					<p className="text-sm text-gray-400">
						设定行动值上限 {formatActionValue(ctx.actionLimit)} / 显示至{" "}
						{formatActionValue(ctx.displayedActionLimit)} / 行动数{" "}
						{visibleActions.length}
					</p>
				</div>
				<table className="w-full table-auto divide-y divide-gray-700 text-left text-sm">
					<colgroup>
						<col className="w-12" />
						<col className="w-[1%]" />
						<col className="w-28" />
						<col className="w-28" />
						{ctx.resources.map((name) => (
							<col key={`resource-col-${name}`} />
						))}
					</colgroup>
					<thead className="bg-[#11182799] text-gray-300">
						<tr>
							<th className="w-12 min-w-12 max-w-12 whitespace-nowrap px-2 py-3 font-semibold">
								序号
							</th>
							<th className="w-[1%] whitespace-nowrap px-3 py-3 font-semibold">
								目标
							</th>
							<th className="whitespace-nowrap px-2 py-3 font-semibold">
								行动值
							</th>
							<th className="whitespace-nowrap px-2 py-3 font-semibold">
								技能
							</th>
							{ctx.resources.map((resource, index) => (
								<th
									key={`resource-header-${resource}`}
									className="truncate whitespace-nowrap px-2 py-3 font-semibold"
									title={resource || `资源 ${index + 1}`}
								>
									{resource || `资源 ${index + 1}`}
								</th>
							))}
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-700">
						{visibleActions.length === 0 ? (
							<tr>
								<td
									colSpan={colSpan}
									className="px-4 py-10 text-center text-gray-400"
								>
									请至少填写一个有效速度。
								</td>
							</tr>
						) : (
							<>
								{visibleActions.map((action, index) => (
									<Fragment key={`action-with-marker-${action.key}`}>
										{index === limitMarkerPosition && (
											<ActionLimitMarkerRow
												colSpan={colSpan}
												actionLimit={ctx.actionLimit}
											/>
										)}
										<ActionRow
											action={action}
											index={index}
											isPastOriginalLimit={action.actionValue > ctx.actionLimit}
											onToggleElationSkills={
												action.hasElationSkills
													? () => onToggleAha(action.key)
													: undefined
											}
											onToggleArcherArrows={
												action.hasArcherExtraEs
													? () => onToggleArcherArrows(action.key)
													: undefined
											}
											dragProps={getDragProps(action)}
										/>
										{action.hasArcherExtraEs &&
											expandedArcherArrowKeys.has(action.key) &&
											archerArrowChildrenByParent
												.get(action.key)
												?.map((child) => (
													<ActionRow
														key={child.key}
														action={child}
														index={index}
														isPastOriginalLimit={
															child.actionValue > ctx.actionLimit
														}
														onToggleElationSkills={
															child.hasElationSkills
																? () => onToggleAha(child.key)
																: undefined
														}
														dragProps={getDragProps(child)}
													/>
												))}
										{action.hasElationSkills &&
											expandedAhaKeys.has(action.key) &&
											elationSkillsByParent
												.get(action.key)
												?.map((skill) => (
													<ElationSkillRow key={skill.key} action={skill} />
												))}
									</Fragment>
								))}
								{limitMarkerPosition === visibleActions.length && (
									<ActionLimitMarkerRow
										colSpan={colSpan}
										actionLimit={ctx.actionLimit}
									/>
								)}
							</>
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
}

function ElationSkillRow({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	const character = ctx.charactersById[action.characterId];
	return (
		<tr
			data-action-key={action.key}
			className="bg-[#c2410c15] hover:bg-[#c2410c25]"
		>
			<td className="w-12 min-w-12 max-w-12 whitespace-nowrap px-2 py-2 text-center text-xs text-orange-400/60">
				ES
			</td>
			<td className="w-[1%] max-w-32 whitespace-nowrap px-3 py-2">
				<div className="truncate text-sm font-medium text-orange-200/80">
					{character?.name ?? action.characterId}
				</div>
			</td>
			<td className="whitespace-nowrap px-2 py-2 text-center text-xs text-orange-300/60">
				{formatActionValue(action.actionValue)}
			</td>
			<td className="whitespace-nowrap px-2 py-2">
				<span className="rounded bg-orange-500/20 px-1.5 py-0.5 font-mono text-xs font-bold text-orange-300">
					ES
				</span>
			</td>
			{ctx.resources.map((name) => (
				<td
					key={`es-res-${action.key}-${name}`}
					className="whitespace-nowrap px-2 py-2"
				>
					<input
						type="text"
						value={ctx.resourceValues[action.key]?.[name] ?? ""}
						onClick={(event) => event.stopPropagation()}
						onContextMenu={(event) => event.stopPropagation()}
						onChange={(event) =>
							ctx.updateResourceValue(action.key, name, event.target.value)
						}
						className="h-10 w-full min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</td>
			))}
		</tr>
	);
}
