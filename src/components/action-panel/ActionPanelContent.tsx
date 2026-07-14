import { useMemo, useRef, useState } from "react";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import {
	canExchangeActionOrder,
	getActionValueBucket,
	getDisplayOrderedActions,
	getExtraTurnParentKey,
} from "../../utils/actionDisplayOrder";
import {
	formatActionValue,
	hasSkillEffect,
	isLockedResourceNameForCharacters,
	limitPresets,
	maxResources,
} from "../../utils/actionSequence";
import { SelectInput } from "../Controls";
import ExportExcelButton from "../ExportExcelButton";
import { ActionMenuContent } from "./ActionMenuContent";
import { ActionSequenceTable } from "./ActionSequenceTable";
import { ResourceNameInput } from "./ResourceNameInput";

export default function ActionPanel() {
	const ctx = useActionSequence();
	const isImageExportLocked = ctx.actions.length > 100;
	const orderedActions = useMemo(
		() => getDisplayOrderedActions(ctx.actions, ctx.sameAVOrder),
		[ctx.actions, ctx.sameAVOrder],
	);

	// 白厄境界期间：显示境界动作、阿哈时刻、非忆灵与敌人，隐藏我方角色和忆灵
	// 昔涟自 Q：不显示昔涟Q行，仅显示德谬歌Q
	const visibleActions = useMemo(() => {
		const archerArrowParentKeys = new Set(
			orderedActions
				.filter((action) => action.hasArcherExtraEs)
				.map((action) => action.key),
		);
		const filtered = orderedActions.filter((action) => {
			// 欢愉技：父级行有 hasElationSkills（阿哈时刻）→ 折叠菜单；否则独立行
			if (
				action.isElationSkill &&
				action.elationSkillParentKey &&
				orderedActions.some(
					(a) => a.key === action.elationSkillParentKey && a.hasElationSkills,
				)
			)
				return false;
			const archerArrowParentKey =
				action.archerExtraEParentKey ??
				action.key.match(/^(.*)-ea\d+(?:-|$)/)?.[1];
			if (
				archerArrowParentKey &&
				archerArrowParentKeys.has(archerArrowParentKey)
			)
				return false;
			// 隐藏昔涟自 Q 行（德谬歌 Q 已单独显示）
			if (
				action.skill === "Q" &&
				action.key.endsWith("-q") &&
				hasSkillEffect(
					ctx.charactersById[action.characterId]?.name ?? "",
					"Q",
					"cyreneUltimate",
				)
			) {
				return false;
			}
			return true;
		});
		const firstDomainIdx = filtered.findIndex((a) => a.isDomainAction);
		let lastDomainIdx = -1;
		for (let i = filtered.length - 1; i >= 0; i--) {
			if (filtered[i].isDomainAction) {
				lastDomainIdx = i;
				break;
			}
		}
		if (firstDomainIdx === -1 || lastDomainIdx === -1) return filtered;
		return filtered.filter((action, idx) => {
			if (idx < firstDomainIdx || idx > lastDomainIdx) return true;
			if (action.isDomainAction || action.isAhaInstant) return true;
			const kind = ctx.characterKinds[action.characterId];
			if (kind === "非忆灵" || kind === "倒计时" || kind === "敌人")
				return true;
			return false;
		});
	}, [orderedActions, ctx.characterKinds, ctx.charactersById]);
	const limitMarkerIndex = visibleActions.findIndex(
		(action) => action.actionValue > ctx.actionLimit,
	);
	const limitMarkerPosition =
		limitMarkerIndex === -1 ? visibleActions.length : limitMarkerIndex;

	// 欢愉技折叠菜单
	const [expandedAhaKeys, setExpandedAhaKeys] = useState<Set<string>>(
		new Set(),
	);
	const elationSkillsByParent = useMemo(() => {
		const map = new Map<string, typeof orderedActions>();
		for (const action of orderedActions) {
			if (action.isElationSkill && action.elationSkillParentKey) {
				const list = map.get(action.elationSkillParentKey) ?? [];
				list.push(action);
				map.set(action.elationSkillParentKey, list);
			}
		}
		return map;
	}, [orderedActions]);
	const [expandedArcherArrowKeys, setExpandedArcherArrowKeys] = useState<
		Set<string>
	>(new Set());
	const archerArrowChildrenByParent = useMemo(() => {
		const parentKeys = new Set(
			orderedActions
				.filter((action) => action.hasArcherExtraEs)
				.map((action) => action.key),
		);
		const map = new Map<string, typeof orderedActions>();
		for (const action of orderedActions) {
			const parentKey =
				action.archerExtraEParentKey ??
				action.key.match(/^(.*)-ea\d+(?:-|$)/)?.[1];
			if (!parentKey || !parentKeys.has(parentKey)) continue;
			const children = map.get(parentKey) ?? [];
			children.push(action);
			map.set(parentKey, children);
		}
		return map;
	}, [orderedActions]);
	const toggleArcherArrowExpand = (key: string) => {
		setExpandedArcherArrowKeys((prev) => {
			const next = new Set(prev);
			if (next.has(key)) next.delete(key);
			else next.add(key);
			return next;
		});
	};
	const elationSkillsExportData = useMemo(() => {
		const entries: Record<
			string,
			{
				id: string;
				name: string;
				av: number;
				resources: Record<string, string>;
			}[]
		> = {};
		for (const [parentKey, skills] of elationSkillsByParent) {
			entries[parentKey] = skills.map((es) => ({
				id: es.characterId,
				name: ctx.characterNames[es.characterId] ?? es.characterId,
				av: es.actionValue,
				resources: Object.fromEntries(
					ctx.resources.map((r) => [r, ctx.resourceValues[es.key]?.[r] ?? ""]),
				),
			}));
		}
		return JSON.stringify(entries);
	}, [
		elationSkillsByParent,
		ctx.characterNames,
		ctx.resources,
		ctx.resourceValues,
	]);
	const toggleAhaExpand = (ahaKey: string) => {
		setExpandedAhaKeys((prev) => {
			const next = new Set(prev);
			if (next.has(ahaKey)) next.delete(ahaKey);
			else next.add(ahaKey);
			return next;
		});
	};

	// 拖拽排序状态
	const dragSourceKeyRef = useRef<string | null>(null);
	const dragPreviewRef = useRef<HTMLDivElement | null>(null);
	const describeDragAction = (action: (typeof orderedActions)[number]) => {
		const name = ctx.characterNames[action.characterId] ?? action.characterId;
		const skill = action.skill || "行动";
		return `${name} · ${skill}`;
	};
	const describeDragTarget = (action: (typeof orderedActions)[number]) => {
		if (action.isArcherExtraE && action.archerExtraEIndex !== undefined) {
			return `第 ${action.archerExtraEIndex} 箭`;
		}
		return describeDragAction(action);
	};
	const updateDragPreview = (
		event: React.DragEvent,
		source: (typeof orderedActions)[number],
		target?: (typeof orderedActions)[number],
		insertAfter = false,
	) => {
		const preview = dragPreviewRef.current;
		if (!preview) return;
		preview.textContent = target
			? `移动：${describeDragAction(source)} -> ${describeDragTarget(target)}${insertAfter ? " 后" : " 前"}`
			: `拖拽：${describeDragAction(source)}（拖到行动上方或下方以插入）`;
		preview.style.left = `${event.clientX + 16}px`;
		preview.style.top = `${event.clientY + 16}px`;
	};
	const removeDragPreview = () => {
		dragPreviewRef.current?.remove();
		dragPreviewRef.current = null;
	};
	const getDragGroupActions = (
		actions: readonly (typeof orderedActions)[number][],
		parentKey: string,
		actionValue: number,
	) =>
		actions.filter(
			(candidate) =>
				getExtraTurnParentKey(candidate) === parentKey &&
				getActionValueBucket(candidate.actionValue) ===
					getActionValueBucket(actionValue),
		);
	const isDropAfterAction = (event: React.DragEvent, target: Element) => {
		const bounds = target.getBoundingClientRect();
		// 无布局环境（例如测试或不可见行）没有可用的落点区域，按行末处理。
		if (bounds.height <= 1) return true;
		return event.clientY > bounds.top + bounds.height / 2;
	};
	const dragGroupLabels = useMemo(() => {
		const groups = new Map<string, (typeof orderedActions)[number][]>();
		for (const action of ctx.actions) {
			const parentKey = getExtraTurnParentKey(action);
			if (!parentKey) continue;
			const groupKey = `${parentKey}:${getActionValueBucket(action.actionValue)}`;
			const members = groups.get(groupKey) ?? [];
			members.push(action);
			groups.set(groupKey, members);
		}
		const labels = new Map<string, number>();
		let groupNumber = 1;
		for (const members of groups.values()) {
			if (members.length < 2) continue;
			for (const member of members) labels.set(member.key, groupNumber);
			groupNumber += 1;
		}
		return labels;
	}, [ctx.actions]);

	const getDragProps = (action: (typeof orderedActions)[number]) => {
		// 欢愉技在阿哈时刻内按参演顺序固定，不能单独拖拽换序。
		if (action.isElationSkill) return undefined;
		const parentKey = getExtraTurnParentKey(action);
		const groupNumber = dragGroupLabels.get(action.key);
		if (!parentKey || groupNumber === undefined) return undefined;
		const draggable =
			!action.isArcherExtraE && !action.isGilgameshTechniqueAction;
		const getDragSourceKey = (event: React.DragEvent) => {
			if (dragSourceKeyRef.current) return dragSourceKeyRef.current;
			try {
				const data = JSON.parse(event.dataTransfer.getData("text/plain"));
				return typeof data.key === "string" ? data.key : null;
			} catch {
				return null;
			}
		};
		const getDropPlan = (event: React.DragEvent) => {
			const sourceKey = getDragSourceKey(event);
			if (
				!sourceKey ||
				sourceKey === action.key ||
				action.isGilgameshTechniqueAction
			)
				return null;
			const source = orderedActions.find(
				(candidate) => candidate.key === sourceKey,
			);
			if (
				!source ||
				source.isGilgameshTechniqueAction ||
				!canExchangeActionOrder(source, action) ||
				getExtraTurnParentKey(source) !== parentKey ||
				getActionValueBucket(source.actionValue) !==
					getActionValueBucket(action.actionValue)
			) {
				return null;
			}
			const orderedGroup = getDragGroupActions(
				orderedActions,
				parentKey,
				action.actionValue,
			);
			const sourceIndex = orderedGroup.findIndex(
				(candidate) => candidate.key === source.key,
			);
			const targetIndex = orderedGroup.findIndex(
				(candidate) => candidate.key === action.key,
			);
			if (sourceIndex < 0 || targetIndex < 0) return null;
			const insertAfter = isDropAfterAction(event, event.currentTarget);
			const reorderedGroup = orderedGroup.filter(
				(candidate) => candidate.key !== source.key,
			);
			let insertionIndex = targetIndex + (insertAfter ? 1 : 0);
			if (sourceIndex < insertionIndex) insertionIndex -= 1;
			reorderedGroup.splice(insertionIndex, 0, source);
			if (
				reorderedGroup.every(
					(candidate, index) => candidate.key === orderedGroup[index]?.key,
				)
			)
				return null;
			return { source, reorderedGroup, insertAfter };
		};
		return {
			draggable,
			groupNumber,
			onDragStart: (e: React.DragEvent) => {
				if (!parentKey) return;
				dragSourceKeyRef.current = action.key;
				e.dataTransfer.effectAllowed = "move";
				e.dataTransfer.setData(
					"text/plain",
					JSON.stringify({ key: action.key, parentKey }),
				);
				removeDragPreview();
				const preview = document.createElement("div");
				preview.className =
					"pointer-events-none fixed z-50 max-w-sm rounded-md border border-cyan-300/70 bg-gray-900/95 px-3 py-2 text-xs text-cyan-50 shadow-xl";
				document.body.appendChild(preview);
				dragPreviewRef.current = preview;
				updateDragPreview(e, action);
				// Edge 会额外绘制原生拖拽影像，使用透明画布避免与自定义悬浮窗重叠。
				const dragImage = document.createElement("canvas");
				dragImage.width = 1;
				dragImage.height = 1;
				e.dataTransfer.setDragImage(dragImage, 0, 0);
			},
			onDragOver: (e: React.DragEvent) => {
				const plan = getDropPlan(e);
				if (!plan) return;
				e.preventDefault();
				updateDragPreview(e, plan.source, action, plan.insertAfter);
			},
			onDrop: (e: React.DragEvent) => {
				const plan = getDropPlan(e);
				if (!plan) return;
				e.preventDefault();
				const defaultGroup = getDragGroupActions(
					ctx.actions,
					parentKey,
					action.actionValue,
				);
				ctx.setSameAVOrder((prev) => {
					const next = { ...prev };
					for (let index = 0; index < plan.reorderedGroup.length; index++) {
						const key = plan.reorderedGroup[index].key;
						const defaultIndex = defaultGroup.findIndex(
							(candidate) => candidate.key === key,
						);
						if (index === defaultIndex) delete next[key];
						else next[key] = index;
					}
					return next;
				});
				dragSourceKeyRef.current = null;
				removeDragPreview();
			},
			onDragEnd: () => {
				dragSourceKeyRef.current = null;
				removeDragPreview();
			},
		};
	};

	return (
		<section className="min-w-0 rounded-2xl bg-gray-800 p-4 shadow">
			<div className="mb-4 grid grid-cols-1 items-start gap-3 lg:grid-cols-[500px_minmax(0,1fr)]">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div>
						<label
							htmlFor="action-limit-preset"
							className="mb-2 block h-5 text-sm leading-5 text-gray-300"
						>
							行动值上限
						</label>
						<div className="flex gap-2">
							<SelectInput
								id="action-limit-preset"
								value={ctx.limitPreset}
								options={limitPresets.map((preset) => ({
									value: preset,
									label: preset,
								}))}
								onChange={ctx.setLimitPreset}
								className="w-28"
							/>
							<input
								type="text"
								inputMode="decimal"
								value={ctx.customLimit}
								disabled={ctx.limitPreset !== "自定义"}
								placeholder="自定义"
								onChange={(event) => {
									const nextValue = event.target.value;
									if (nextValue === "" || /^\d*\.?\d*$/.test(nextValue)) {
										ctx.setCustomLimit(nextValue);
									}
								}}
								className="h-10 min-w-0 flex-1 rounded-lg border border-gray-600 bg-gray-700 px-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
							/>
						</div>
					</div>
					<div>
						<label
							htmlFor="display-limit"
							className="mb-2 block h-5 text-sm leading-5 text-gray-300"
						>
							显示上限
						</label>
						<input
							id="display-limit"
							type="text"
							inputMode="decimal"
							value={ctx.displayedLimit}
							placeholder={formatActionValue(ctx.actionLimit + 100)}
							title="默认跟随行动值上限 + 100"
							onChange={(event) => {
								const nextValue = event.target.value;
								if (nextValue === "" || /^\d*\.?\d*$/.test(nextValue)) {
									ctx.setDisplayedLimit(nextValue);
								}
							}}
							className="h-10 w-full min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</div>
				</div>

				<div>
					<div className="mb-2 flex h-5 items-center gap-3">
						<span className="text-sm leading-5 text-gray-300">资源列</span>
					</div>
					<div className="grid grid-cols-1 gap-2">
						<div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2">
							{ctx.resources.map((resource, index) => {
								const isLocked = isLockedResourceNameForCharacters(
									resource,
									ctx.characters,
								);
								return (
									<div
										key={`resource-editor-${resource}`}
										className="grid grid-cols-[minmax(0,1fr)_64px] gap-2"
									>
										<ResourceNameInput
											value={resource}
											disabled={isLocked}
											title={
												isLocked
													? "长夜月在场时，【忆质】固定存在且不可修改"
													: undefined
											}
											onCommit={(value) => ctx.updateResource(index, value)}
										/>
										{isLocked ? (
											<div className="flex h-10 items-center justify-center rounded-lg border border-gray-700 bg-gray-900 px-2 text-xs text-gray-500">
												固定
											</div>
										) : (
											<button
												type="button"
												onClick={() => ctx.removeResource(index)}
												className="h-10 rounded-lg border border-gray-600 bg-gray-800 px-2 text-xs text-gray-200 whitespace-nowrap hover:bg-gray-700"
											>
												删除
											</button>
										)}
									</div>
								);
							})}
							<button
								type="button"
								onClick={ctx.addResource}
								disabled={ctx.resources.length >= maxResources}
								className="h-10 rounded-lg border border-blue-500 bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:border-gray-500 disabled:bg-gray-600"
							>
								添加资源
							</button>
						</div>
					</div>
				</div>
			</div>

			{/* Action sequence controls */}
			<div className="mb-3 flex flex-wrap items-center justify-between gap-3">
				<div>
					<h3 className="text-lg font-semibold text-white">行动序列</h3>
					<p className="text-sm text-gray-400">
						设定上限 {formatActionValue(ctx.actionLimit)}，显示至{" "}
						{formatActionValue(ctx.displayedActionLimit)}，共{" "}
						{ctx.actions.length} 条行动。
					</p>
				</div>
				<button
					type="button"
					onClick={() => void ctx.exportImage()}
					disabled={ctx.isExportingImage || isImageExportLocked}
					title={
						isImageExportLocked
							? "当前行动数超过 100，图片过大，已锁定导出"
							: undefined
					}
					className="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-600"
				>
					{ctx.isExportingImage
						? "生成中..."
						: isImageExportLocked
							? "图片过大"
							: "导出图片"}
				</button>
				<ExportExcelButton />
			</div>

			{/* Floating menu */}
			{ctx.actionMenuOpen && (
				<>
					{/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
					<button
						className="fixed inset-0 z-40 cursor-default"
						onClick={ctx.closeActionMenu}
						onKeyDown={(e) => {
							if (e.key === "Escape") ctx.closeActionMenu();
						}}
						type="button"
						aria-label="关闭菜单"
					/>
					<div
						className="fixed z-50 w-[640px] rounded-xl border border-gray-700 bg-gray-900 p-3 text-xs shadow-2xl"
						style={{
							right: 16,
							top: Math.min(ctx.actionMenuPos, window.innerHeight - 480),
						}}
					>
						<div className="space-y-3">
							<ActionMenuContent />
						</div>
					</div>
				</>
			)}

			<ActionSequenceTable
				visibleActions={visibleActions}
				limitMarkerPosition={limitMarkerPosition}
				elationSkillsByParent={elationSkillsByParent}
				archerArrowChildrenByParent={archerArrowChildrenByParent}
				expandedAhaKeys={expandedAhaKeys}
				expandedArcherArrowKeys={expandedArcherArrowKeys}
				onToggleAha={toggleAhaExpand}
				onToggleArcherArrows={toggleArcherArrowExpand}
				getDragProps={getDragProps}
				elationSkillsExportData={elationSkillsExportData}
			/>

			{/* Export/Import */}
			<div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
				<textarea
					value={ctx.importText}
					onChange={(event) => ctx.setImportText(event.target.value)}
					placeholder="JSON 导入 / 导出内容"
					className="min-h-32 rounded-xl border border-gray-600 bg-gray-700 p-3 font-mono text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<div className="flex flex-col gap-2">
					<button
						type="button"
						onClick={() => void ctx.exportJson()}
						className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-500"
					>
						导出 JSON
					</button>
					<button
						type="button"
						onClick={() => ctx.importJson()}
						className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
					>
						导入 JSON
					</button>
					<button
						type="button"
						onClick={() => void ctx.importFromFile()}
						className="rounded-lg border border-gray-600 bg-gray-800 px-4 py-2 font-medium text-gray-200 hover:bg-gray-700"
					>
						从文件导入
					</button>
					{ctx.message && (
						<p className="text-sm text-gray-300">{ctx.message}</p>
					)}
				</div>
			</div>
		</section>
	);
}
