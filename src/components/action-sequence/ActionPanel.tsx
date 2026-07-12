import { Fragment, useMemo } from "react";
import swRank2Icon from "../../assets/skillIcons/SkillIcon_1506_Rank2.webp";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { hasHyacineIca } from "../../mechanics/hyacineIca";
import { hasSilverWolfGodmode } from "../../mechanics/silverWolfGodmode";
import { getDisplayOrderedActions } from "../../utils/actionDisplayOrder";
import type { SpeedChangeMode } from "../../utils/actionSequence";
import {
	canSelectSkillTargetForAction,
	formatActionValue,
	getCharacterDisplayName,
	getMemeAdvanceRule,
	getTargetDefaultName,
	hasSkillEffect,
	isCharacterTarget,
	isLockedResourceNameForCharacters,
	limitPresets,
	maxResources,
	shouldRememberSkillTarget,
	toPositiveNumber,
} from "../../utils/actionSequence";
import { ActionLimitMarkerRow, ActionRow } from "./ActionTableRows";
import { SelectInput, TextInput } from "./Controls";
import ExportExcelButton from "./ExportExcelButton";

export default function ActionPanel() {
	const ctx = useActionSequence();
	const isImageExportLocked = ctx.actions.length > 100;
	const orderedActions = useMemo(
		() => getDisplayOrderedActions(ctx.actions),
		[ctx.actions],
	);

	// 白厄境界期间：只显示境界动作 + 非忆灵 + 敌人，隐藏我方角色和忆灵
	// 昔涟自 Q：不显示昔涟Q行，仅显示德谬歌Q
	const visibleActions = useMemo(() => {
		const filtered = orderedActions.filter((action) => {
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
			if (action.isDomainAction) return true;
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
										<TextInput
											value={resource}
											placeholder="资源名称"
											disabled={isLocked}
											title={
												isLocked
													? "长夜月在场时，【忆质】固定存在且不可修改"
													: undefined
											}
											onChange={(value) => ctx.updateResource(index, value)}
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
							<MenuContent />
						</div>
					</div>
				</>
			)}

			{/* Action table */}
			<div
				ref={ctx.imageExportRef}
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
										colSpan={4 + ctx.resources.length}
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
													colSpan={4 + ctx.resources.length}
													actionLimit={ctx.actionLimit}
												/>
											)}
											<ActionRow
												action={action}
												index={index}
												isPastOriginalLimit={
													action.actionValue > ctx.actionLimit
												}
											/>
										</Fragment>
									))}
									{limitMarkerPosition === visibleActions.length && (
										<ActionLimitMarkerRow
											colSpan={4 + ctx.resources.length}
											actionLimit={ctx.actionLimit}
										/>
									)}
								</>
							)}
						</tbody>
					</table>
				</div>
			</div>

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

/** Sub-component: the floating context menu content */
function MenuContent() {
	const ctx = useActionSequence();
	const selectedActions = ctx.actions.filter((action) =>
		ctx.selectedActionKeys.has(action.key),
	);
	const selectedDomainOnly =
		selectedActions.length > 0 &&
		selectedActions.every((action) => action.isDomainAction);

	return (
		<>
			<div className="grid gap-3 lg:grid-cols-[180px_minmax(0,1fr)_96px_96px_auto]">
				<SelectInput
					value={ctx.actionOperation}
					options={[
						{
							value: "advance",
							label: selectedDomainOnly ? "行动提前" : "行动提前/延后",
						},
						{ value: "speed", label: "加速/减速" },
					]}
					onChange={(value) =>
						ctx.setActionOperation(value as "advance" | "speed")
					}
				/>
				<input
					type="text"
					inputMode="decimal"
					value={ctx.operationValue}
					placeholder={
						ctx.actionOperation === "advance"
							? selectedDomainOnly
								? "正数提前"
								: "正数提前，负数延后"
							: "正数加速，负数减速"
					}
					onChange={(event) => {
						const nextValue = event.target.value;
						const pattern =
							selectedDomainOnly && ctx.actionOperation === "advance"
								? /^\d*\.?\d*$/
								: /^-?\d*\.?\d*$/;
						if (nextValue === "" || pattern.test(nextValue))
							ctx.setOperationValue(nextValue);
					}}
					className="h-9 min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-2 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<SelectInput
					value={
						ctx.actionOperation === "advance"
							? "relative"
							: ctx.operationSpeedMode
					}
					disabled={ctx.actionOperation !== "speed"}
					options={[
						{
							value: "absolute",
							label: "\u00a0",
							title: "绝对变速",
						},
						{ value: "relative", label: "%", title: "相对变速" },
					]}
					onChange={(value) =>
						ctx.setOperationSpeedMode(value as SpeedChangeMode)
					}
				/>
				<button
					type="button"
					onClick={ctx.applyActionOperation}
					className="h-9 rounded-lg bg-blue-600 px-2 text-xs font-medium text-white hover:bg-blue-500"
				>
					应用
				</button>
				<button
					type="button"
					onClick={ctx.closeActionMenu}
					className="h-9 rounded-lg border border-gray-600 bg-gray-800 px-2 text-xs font-medium text-gray-200 hover:bg-gray-700"
				>
					关闭
				</button>
			</div>

			{ctx.actionOperation === "advance" && (
				<div className="mt-2 flex items-center gap-2">
					<label
						htmlFor="advance-ceiling"
						className="whitespace-nowrap text-gray-400"
					>
						提前上限（行动序号）
					</label>
					<input
						id="advance-ceiling"
						type="text"
						inputMode="numeric"
						value={ctx.advanceCeiling}
						placeholder="留空不限"
						title="填入行动序号（如3），提前后的行动值不会早于该行动的行动值"
						onChange={(event) => {
							const next = event.target.value;
							if (next === "" || /^\d*$/.test(next))
								ctx.setAdvanceCeiling(next);
						}}
						className="h-8 w-20 rounded-lg border border-gray-600 bg-gray-700 px-2 text-center text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</div>
			)}

			{/* Skill target section */}
			<SkillTargetSection />

			{/* Phainon domain section */}
			<DomainEndSection />

			{/* Himeko Nova assist section */}
			<AssistCancelSection />

			{/* Memory Trailblazer memosprite advance section */}
			<MemeAdvanceSection />

			{/* Interrupt section */}
			<InterruptSection />

			{/* Silver Wolf E2 godmode extra section */}
			<GodmodeExtraSection />

			{/* Hyacine E2 section */}
			<HyacineE2Section />

			{/* Ica kill section */}
			<IcaKillSection />

			{/* Meme kill section */}
			<MemeKillSection />

			{/* Evernight self-destruction section */}
			<EvernightSelfDestructSection />
		</>
	);
}

function SkillTargetSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((a) => a.key === firstKey);
	if (!firstAction) return null;
	const character = ctx.charactersById[firstAction.characterId];
	if (!character) return null;
	const skill = firstAction.isDomainFinalAction
		? firstAction.skill
		: (ctx.skillOverrides[firstKey] ?? firstAction.skill);
	const isEligible =
		isCharacterTarget(character) &&
		skill.includes("E") &&
		hasTargetableESkill(character.name);
	if (!isEligible) return null;

	const availableMemos = ctx.memospriteTargets.filter((m) =>
		isMemospriteAvailableForAction(ctx, m, firstAction.key),
	);
	const allies = [...ctx.characters, ...availableMemos].filter(
		(c) =>
			canSelectSkillTargetForAction(character, c) &&
			toPositiveNumber(c.speed, 0) > 0,
	);
	const rememberedTargetId = shouldRememberSkillTarget(character.name)
		? ctx.defaultSkillTargets[character.id]
		: undefined;
	const currentTargetId =
		ctx.skillTargets[firstKey] ?? rememberedTargetId ?? "";
	const validCurrentTargetId = allies.some(
		(ally) => ally.id === currentTargetId,
	)
		? currentTargetId
		: "";
	const targetOptions = [
		{ value: "", label: "无" },
		...allies.map((c) => ({
			value: c.id,
			label:
				c.name.trim() ||
				getTargetDefaultName(c.kind, ctx.characters.indexOf(c)),
		})),
	];
	const displayName = getCharacterDisplayName(character.name) ?? character.name;

	return (
		<div className="flex items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				{displayName} E 目标：
			</span>
			<SelectInput
				value={validCurrentTargetId}
				options={targetOptions}
				onChange={(targetId) => ctx.updateSkillTarget(firstAction, targetId)}
				className="w-48"
			/>
			{validCurrentTargetId && (
				<span className="text-xs text-amber-200/80">
					{hasSkillEffect(character.name, "E", "allyAdvance50NotPast")
						? "目标行动提前 50%"
						: hasSkillEffect(character.name, "E", "allyPullToCurrent")
							? "目标立刻行动"
							: "已选择目标"}
				</span>
			)}
		</div>
	);
}

function hasTargetableESkill(characterName: string) {
	return (
		hasSkillEffect(characterName, "E", "allyPullToCurrent") ||
		hasSkillEffect(characterName, "E", "sundayPullWithMemosprite") ||
		hasSkillEffect(characterName, "E", "allyAdvance50NotPast") ||
		hasSkillEffect(characterName, "E", "allyTargetSelectable")
	);
}

/**
 * 判断某个忆灵在指定行动之前是否已被召唤出场。
 * 衣匠（阿格莱雅 E/Q 召唤）、迷迷（记忆主 E 召唤）仅在主人使用对应技能后才可选作目标。
 */
function isMemospriteAvailableForAction(
	ctx: ReturnType<typeof useActionSequence>,
	memosprite: import("../../utils/actionSequence").CharacterConfig,
	currentActionKey: string,
): boolean {
	const orderedActions = getDisplayOrderedActions(ctx.actions);
	const isGarmentmaker = memosprite.id.endsWith("-garmentmaker");
	const isMeme = memosprite.id.endsWith("-meme");
	const isCyreneMemosprite = memosprite.id.endsWith("-memosprite");
	const isEvey = memosprite.id.endsWith("-evey");

	// 非战内召唤的忆灵始终可用
	if (!isGarmentmaker && !isMeme && !isCyreneMemosprite && !isEvey) return true;

	const suffix = isGarmentmaker
		? "-garmentmaker"
		: isMeme
			? "-meme"
			: isCyreneMemosprite
				? "-memosprite"
				: "-evey";
	const ownerId = memosprite.id.slice(0, -suffix.length);

	const selectedIndex = orderedActions.findIndex(
		(a) => a.key === currentActionKey,
	);
	if (selectedIndex <= 0) return isEvey;

	if (isEvey) {
		let onField = true;
		for (const action of orderedActions.slice(0, selectedIndex)) {
			if (
				action.characterId === ownerId &&
				!action.isDomainAction &&
				!action.isMemospriteAction
			) {
				const skill = ctx.skillOverrides[action.key] ?? action.skill;
				if (!onField && (skill.includes("E") || skill.includes("Q"))) {
					onField = true;
				}
			}
			if (action.characterId === `${ownerId}-evey`) {
				const skill = ctx.skillOverrides[action.key] ?? action.skill;
				if ((skill || "A") === "E") {
					onField = false;
				}
			}
		}
		return onField;
	}

	return orderedActions.slice(0, selectedIndex).some((action) => {
		if (action.characterId !== ownerId) return false;
		if (action.isDomainAction || action.isMemospriteAction) return false;
		const skill = ctx.skillOverrides[action.key] ?? action.skill;
		// 衣匠、迷迷、德谬歌均由 E 或 Q 召唤
		return skill.includes("E") || skill.includes("Q");
	});
}

function DomainEndSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((a) => a.key === firstKey);
	if (!firstAction?.isDomainAction) return null;
	const isEndingHere = ctx.domainEndOverrides[firstKey] ?? false;

	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				白厄境界：
			</span>
			<button
				type="button"
				onClick={() => {
					ctx.setDomainEndOverrides((prev) => {
						const next = { ...prev };
						const domainPrefix = firstKey.replace(/-domain-\d+$/, "");
						for (const key of Object.keys(next)) {
							if (key.startsWith(`${domainPrefix}-domain-`)) delete next[key];
						}
						if (!isEndingHere) next[firstKey] = true;
						return next;
					});
				}}
				className={`h-8 rounded-md px-3 text-xs font-medium text-white ${
					isEndingHere
						? "border border-gray-600 bg-gray-800 hover:bg-gray-700"
						: "bg-amber-600 hover:bg-amber-500"
				}`}
			>
				{isEndingHere ? "取消提前结束" : "提前结束境界"}
			</button>
			<span className="text-xs text-gray-400">
				白厄境界期间不可插入其他角色大招
			</span>
		</div>
	);
}

function hasEveyOnFieldBeforeAction(
	ctx: ReturnType<typeof useActionSequence>,
	actionKey: string,
) {
	const owner = ctx.characters.find((character) =>
		hasSkillEffect(character.name, "E", "summonEvey"),
	);
	if (!owner) return false;
	if (actionKey.startsWith(`${owner.id}-evey-`)) return true;
	const orderedActions = getDisplayOrderedActions(ctx.actions);
	const selectedIndex = orderedActions.findIndex(
		(action) => action.key === actionKey,
	);
	if (selectedIndex === -1) return false;
	let onField = true;
	for (const action of orderedActions.slice(0, selectedIndex)) {
		if (
			action.characterId === owner.id &&
			!action.isDomainAction &&
			!action.isMemospriteAction
		) {
			const skill = ctx.skillOverrides[action.key] ?? action.skill;
			if (!onField && (skill.includes("E") || skill.includes("Q"))) {
				onField = true;
			}
		}
		if (action.characterId === `${owner.id}-evey`) {
			const skill = ctx.skillOverrides[action.key] ?? action.skill;
			if ((skill || "A") === "E") {
				onField = false;
			}
		}
	}
	return onField;
}

function AssistCancelSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((action) => action.key === firstKey);
	if (!firstAction) return null;

	const sourceKey = firstAction.assistSourceKey ?? firstAction.key;
	const sourceSkill = ctx.skillOverrides[sourceKey] ?? "";
	const isAssistAction = firstAction.isAssistAction ?? false;
	const isAssistFollowUp = firstAction.isAssistFollowUp ?? false;
	const hasPendingAssistSkill = sourceSkill.includes("F");
	if (!isAssistAction && !isAssistFollowUp && !hasPendingAssistSkill) {
		return null;
	}

	const isSecondAssist = isAssistAction && (firstAction.assistIndex ?? 1) >= 2;

	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				姬子·启行助战：
			</span>
			<button
				type="button"
				onClick={() => {
					ctx.cancelHimekoNovaAssist(firstAction);
					ctx.closeActionMenu();
				}}
				className="h-8 rounded-md bg-amber-600 px-3 text-xs font-medium text-white hover:bg-amber-500"
			>
				{isSecondAssist ? "取消第二个助战技" : "取消助战技"}
			</button>
			<span className="text-xs text-gray-400">
				{isSecondAssist ? "恢复一个额外回合" : "恢复原回合"}
			</span>
		</div>
	);
}

function getMemeTargetOptions(ctx: ReturnType<typeof useActionSequence>) {
	const allTargets = [
		...ctx.characters,
		...ctx.memospriteTargets.filter(
			(m) => !ctx.characters.some((c) => c.id === m.id),
		),
	];
	return allTargets
		.filter(
			(character) =>
				(character.kind === "角色" || character.kind === "忆灵") &&
				toPositiveNumber(character.speed, 0) > 0,
		)
		.map((character) => ({
			value: character.id,
			label: character.name.trim() || character.id,
		}));
}

function hasMemeBeenSummonedBeforeAction(
	ctx: ReturnType<typeof useActionSequence>,
	ownerId: string,
	actionKey: string,
) {
	const orderedActions = getDisplayOrderedActions(ctx.actions);
	const selectedIndex = orderedActions.findIndex(
		(action) => action.key === actionKey,
	);
	if (selectedIndex <= 0) return false;
	return orderedActions.slice(0, selectedIndex).some((action) => {
		if (action.characterId !== ownerId) return false;
		if (action.isDomainAction || action.isMemospriteAction) return false;
		const skill = ctx.skillOverrides[action.key] ?? action.skill;
		return skill.includes("E") || skill.includes("Q");
	});
}

function MemeAdvanceSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((action) => action.key === firstKey);
	if (!firstAction) return null;
	if (firstAction.isDomainAction || firstAction.isOdeExtraAction) {
		return null;
	}

	const actionTarget =
		ctx.charactersById[firstAction.characterId] ??
		ctx.memospriteTargets.find((m) => m.id === firstAction.characterId);
	if (!actionTarget) return null;
	if (actionTarget.kind === "倒计时") return null;

	const memeOwner = ctx.characters.find(
		(character) =>
			isCharacterTarget(character) &&
			toPositiveNumber(character.speed, 0) > 0 &&
			hasSkillEffect(character.name, "M", "memeAdvance"),
	);
	if (!memeOwner) return null;
	if (!hasMemeBeenSummonedBeforeAction(ctx, memeOwner.id, firstAction.key)) {
		return null;
	}

	const memeKey = `${firstKey}-meme`;
	const currentTargetId = ctx.memeSelections[memeKey] ?? "";
	const targetOptions = getMemeTargetOptions(ctx);
	const lastMemeTargetIsValid = ctx.lastMemeTarget
		? targetOptions.some((o) => o.value === ctx.lastMemeTarget)
		: false;
	const defaultTarget = lastMemeTargetIsValid
		? ctx.lastMemeTarget
		: (targetOptions[0]?.value ?? "");
	const memeRule = getMemeAdvanceRule(memeOwner.name);
	if (targetOptions.length === 0) return null;
	const ownerName = getCharacterDisplayName(memeOwner.name) ?? memeOwner.name;
	const isEnabled = memeKey in ctx.memeSelections;

	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				{ownerName}：
			</span>
			<button
				type="button"
				onClick={() => {
					ctx.setMemeSelections((prev) => {
						const next = { ...prev };
						if (memeKey in prev) {
							delete next[memeKey];
						} else {
							next[memeKey] = defaultTarget;
						}
						return next;
					});
				}}
				className={`h-8 rounded-md px-3 text-xs font-medium text-white ${
					isEnabled
						? "border border-gray-600 bg-gray-800 hover:bg-gray-700"
						: "bg-pink-600 hover:bg-pink-500"
				}`}
			>
				{isEnabled ? "取消迷迷拉条" : "迷迷拉条"}
			</button>
			{isEnabled && (
				<SelectInput
					value={currentTargetId}
					options={[{ value: "", label: "无目标" }, ...targetOptions]}
					onChange={(targetId) => {
						ctx.setMemeSelections((prev) => {
							const next = { ...prev };
							if (targetId === "") next[memeKey] = "";
							else next[memeKey] = targetId;
							return next;
						});
						if (targetId) ctx.setLastMemeTarget(targetId);
					}}
					className="w-40"
				/>
			)}
			<span className="text-xs text-gray-400">
				{memeRule.memospriteName}获得一动，并使目标提前{" "}
				{memeRule.advancePercent}%
			</span>
		</div>
	);
}

function InterruptSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((a) => a.key === firstKey);
	if (firstAction?.isDomainAction) return null;
	const existingInterrupts = ctx.ultInterrupts[firstKey] ?? [];
	const allCasters = ctx.characters.filter(
		(c) => toPositiveNumber(c.speed, 0) > 0,
	);
	const casterOptions = allCasters.map((c) => ({
		value: c.id,
		label:
			c.name.trim() || getTargetDefaultName(c.kind, ctx.characters.indexOf(c)),
	}));

	// 检测本行动是否有自 Q 插队（AQ/EQ/QA）
	const selfQOverride = (() => {
		const override = ctx.skillOverrides[firstKey];
		if (
			override &&
			override.length > 1 &&
			override.includes("Q") &&
			!override.includes("W")
		) {
			return override;
		}
		return null;
	})();
	const charName = firstAction
		? (ctx.charactersById[firstAction.characterId]?.name ?? "")
		: "";

	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				插入大招：
			</span>
			<div className="flex flex-wrap items-center gap-2">
				{selfQOverride && (
					<span className="inline-flex items-center gap-1 rounded-md border border-amber-700 bg-amber-900/40 px-2 py-1 text-xs text-amber-200">
						{charName || selfQOverride[0]}
						<span className="text-gray-400">自插队</span>
						<button
							type="button"
							onClick={() => {
								const withoutQ = selfQOverride.replace(/Q/g, "");
								if (firstAction) {
									ctx.updateActionSkill(firstAction, withoutQ);
								}
							}}
							className="ml-0.5 text-gray-400 hover:text-red-300"
						>
							×
						</button>
					</span>
				)}
				{existingInterrupts.map((int, idx) => (
					<span
						key={`${firstKey}-int-${int.casterId}-${int.timing}`}
						className="inline-flex items-center gap-1 rounded-md border border-gray-600 bg-gray-800 px-2 py-1 text-xs text-gray-200"
					>
						{ctx.characters.find((c) => c.id === int.casterId)?.name ??
							int.casterId}
						<span className="text-gray-500">
							{int.timing === "before" ? "行动前" : "行动后"}
						</span>
						<button
							type="button"
							onClick={() =>
								ctx.setUltInterrupts((prev) => {
									const n = { ...prev };
									const a = [...(n[firstKey] ?? [])];
									a.splice(idx, 1);
									if (a.length === 0) delete n[firstKey];
									else n[firstKey] = a;
									return n;
								})
							}
							className="ml-0.5 text-gray-400 hover:text-red-300"
						>
							×
						</button>
					</span>
				))}
				{casterOptions.length > 0 && (
					<div className="flex items-center gap-1">
						<SelectInput
							value={ctx.draftInterruptCaster}
							options={[{ value: "", label: "添加…" }, ...casterOptions]}
							onChange={ctx.setDraftInterruptCaster}
							className="w-28"
						/>
						{ctx.draftInterruptCaster && (
							<>
								<SelectInput
									value={ctx.draftInterruptTiming}
									options={[
										{ value: "before", label: "行动前" },
										{ value: "after", label: "行动后" },
									]}
									onChange={(t) =>
										ctx.setDraftInterruptTiming(t as "before" | "after")
									}
									className="w-24"
								/>
								<button
									type="button"
									onClick={() => {
										ctx.setUltInterrupts((prev) => {
											const n = { ...prev };
											const a = [...(n[firstKey] ?? [])];
											a.push({
												casterId: ctx.draftInterruptCaster,
												timing: ctx.draftInterruptTiming,
											});
											n[firstKey] = a;
											return n;
										});
										ctx.setDraftInterruptCaster("");
										ctx.setDraftInterruptTiming("before");
									}}
									className="h-8 rounded-md bg-blue-600 px-2 text-xs text-white hover:bg-blue-500"
								>
									添加
								</button>
							</>
						)}
					</div>
				)}
			</div>
			{existingInterrupts.length > 0 && (
				<span className="text-xs text-gray-400">插队大招不占用大招周期</span>
			)}
		</div>
	);
}

function GodmodeExtraSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((a) => a.key === firstKey);
	if (!firstAction) return null;
	if (firstAction.isDomainAction) return null;
	const toggleKey = firstAction.key.endsWith("-sparxie-extra-q")
		? firstAction.key.slice(0, -2)
		: firstKey;

	// 仅队友/阿哈行动时显示
	const charKind = ctx.characterKinds[firstAction.characterId];
	const isEligible =
		charKind === "角色" ||
		charKind === "忆灵" ||
		firstAction.characterId === "@aha";
	if (!isEligible) return null;

	// 仅银狼在无敌玩家状态时显示
	const swChar = ctx.characters.find((c) => hasSilverWolfGodmode(c.name));
	if (!swChar) return null;
	// 无敌玩家状态：有SW的Q行动记录即视为可能处于无敌玩家中
	const swInGodmode = ctx.actions.some(
		(a) =>
			a.characterId === swChar.id &&
			(a.skill === "Q" || a.lockedSkill === true),
	);
	if (!swInGodmode) return null;

	const isOn = ctx.godmodeExtraActions[toggleKey] === true;
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				银狼 E2 额外行动：
			</span>
			<button
				type="button"
				onClick={() => {
					if (isOn) {
						ctx.setGodmodeExtraActions((prev) => {
							const next = { ...prev };
							delete next[toggleKey];
							return next;
						});
					} else {
						ctx.setGodmodeExtraActions((prev) => ({
							...prev,
							[toggleKey]: true,
						}));
					}
				}}
				className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
					isOn
						? "border-violet-500/70 bg-violet-500/20 text-violet-200 hover:bg-violet-500/30"
						: "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
				}`}
			>
				<img src={swRank2Icon} alt="E2" className="inline-block h-5 w-5" />
				{isOn ? "已开启" : "已关闭"}
			</button>
			{isOn && (
				<span className="text-xs text-gray-400">行动后银狼插入额外 A</span>
			)}
		</div>
	);
}

function HyacineE2Section() {
	const ctx = useActionSequence();
	const hasHyacine = ctx.characters.some((c) => hasHyacineIca(c.name));
	if (!hasHyacine) return null;

	const isOn = ctx.hyacineE2Active;
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				风堇 E2 全队加速：
			</span>
			<button
				type="button"
				onClick={() => ctx.setHyacineE2Active(!isOn)}
				className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
					isOn
						? "border-emerald-500/70 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
						: "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
				}`}
			>
				{isOn ? "已开启" : "已关闭"}
			</button>
			{isOn && (
				<span className="text-xs text-gray-400">
					全队 speed += baseSpeed × 30%
				</span>
			)}
		</div>
	);
}

function IcaKillSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((a) => a.key === firstKey);
	if (!firstAction) return null;

	const hasHyacine = ctx.characters.some((c) => hasHyacineIca(c.name));
	if (!hasHyacine) return null;

	if (hasHyacineIca(ctx.charactersById[firstAction.characterId]?.name ?? ""))
		return null;
	if (firstAction.isIcaAction) return null;
	const charKind = ctx.characterKinds[firstAction.characterId];
	if (charKind === "倒计时") return null;

	const isOn = ctx.icaKillToggles[firstKey] === true;
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				小伊卡死亡：
			</span>
			<button
				type="button"
				onClick={() => {
					if (isOn) {
						ctx.setIcaKillToggles((prev) => {
							const next = { ...prev };
							delete next[firstKey];
							return next;
						});
					} else {
						ctx.setIcaKillToggles((prev) => ({
							...prev,
							[firstKey]: true,
						}));
					}
				}}
				className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
					isOn
						? "border-red-500/70 bg-red-500/20 text-red-200 hover:bg-red-500/30"
						: "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
				}`}
			>
				{isOn ? "已标记" : "未标记"}
			</button>
			{isOn && (
				<span className="text-xs text-gray-400">
					此行动后 Ica 死亡，风堇 30% 自拉条
				</span>
			)}
		</div>
	);
}

function MemeKillSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((a) => a.key === firstKey);
	if (!firstAction) return null;

	const memeOwner = ctx.characters.find((character) =>
		hasSkillEffect(character.name, "E", "summonMeme"),
	);
	if (!memeOwner) return null;
	const charKind = ctx.characterKinds[firstAction.characterId];
	if (charKind === "倒计时") return null;

	const isOn = ctx.memeKillToggles[firstKey] === true;
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				迷迷死亡：
			</span>
			<button
				type="button"
				onClick={() => {
					if (isOn) {
						ctx.setMemeKillToggles((prev) => {
							const next = { ...prev };
							delete next[firstKey];
							return next;
						});
					} else {
						ctx.setMemeKillToggles((prev) => ({
							...prev,
							[firstKey]: true,
						}));
					}
				}}
				className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
					isOn
						? "border-red-500/70 bg-red-500/20 text-red-200 hover:bg-red-500/30"
						: "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
				}`}
			>
				{isOn ? "已标记" : "未标记"}
			</button>
			{isOn && (
				<span className="text-xs text-gray-400">
					此行动后迷迷死亡，记忆主 25% 自拉条
				</span>
			)}
		</div>
	);
}

function EvernightSelfDestructSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((action) => action.key === firstKey);
	if (!firstAction) return null;

	const owner = ctx.characters.find((character) =>
		hasSkillEffect(character.name, "E", "summonEvey"),
	);
	if (!owner) return null;
	if (firstAction.characterId === "@av0" || firstAction.isDomainAction)
		return null;
	if (!hasEveyOnFieldBeforeAction(ctx, firstKey)) return null;

	const rawValue = ctx.resourceValues[firstKey]?.忆质 ?? "";
	const parsedValue = Number.parseFloat(rawValue);
	const hasNumericValue =
		rawValue.trim() !== "" && Number.isFinite(parsedValue);
	const isAutoSelfDestruct = hasNumericValue && parsedValue >= 16;
	const isBlockedByInsufficient = hasNumericValue && parsedValue < 16;
	const isManualSelfDestruct =
		!hasNumericValue && ctx.evernightSelfDestructToggles[firstKey] === true;
	const isOn = isAutoSelfDestruct || isManualSelfDestruct;
	const hint = isAutoSelfDestruct
		? "当前忆质 >= 16，长夜会在本回合结束后自动以锁定 E 立刻行动并离场"
		: isBlockedByInsufficient
			? "当前忆质 < 16，视为误操作，本次不会自爆"
			: isOn
				? "本回合结束后长夜会以锁定 E 立刻行动并离场"
				: "未填写忆质时，可通过右键手动标记自爆";
	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				长夜自爆：
			</span>
			<button
				type="button"
				disabled={isAutoSelfDestruct || isBlockedByInsufficient}
				onClick={() => {
					if (isOn) {
						ctx.setEvernightSelfDestructToggles((prev) => {
							const next = { ...prev };
							delete next[firstKey];
							return next;
						});
					} else {
						ctx.setEvernightSelfDestructToggles((prev) => ({
							...prev,
							[firstKey]: true,
						}));
					}
				}}
				className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
					isOn
						? "border-red-500/70 bg-red-500/20 text-red-200 hover:bg-red-500/30"
						: "border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600"
				} ${isAutoSelfDestruct || isBlockedByInsufficient ? "cursor-not-allowed opacity-70" : ""}`}
			>
				{isAutoSelfDestruct ? "已自爆" : isOn ? "已标记" : "未标记"}
			</button>
			<span
				className={`text-xs ${
					isBlockedByInsufficient ? "text-amber-300" : "text-gray-400"
				}`}
			>
				{hint}
			</span>
		</div>
	);
}
