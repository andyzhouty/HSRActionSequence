import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import * as XLSX from "xlsx";
import type {
	GeneratedAction,
	SpeedChangeMode,
} from "../../utils/actionSequence";
import {
	ensureFileExtension,
	formatEditableNumber,
	formatActionValue,
	getCharacterDisplayName,
	getCounterWDomainRule,
	getCyreneUltimateRule,
	getErrorMessage,
	getMemeAdvanceRule,
	getOdeRuleForTarget,
	getTargetDefaultName,
	hasSemanticFlag,
	hasSkillEffect,
	isAllyTarget,
	isCharacterTarget,
	isEnemyTarget,
	isQFrontCombo,
	limitPresets,
	maxResources,
	shouldRememberSkillTarget,
	toPositiveNumber,
} from "../../utils/actionSequence";
import { SelectInput, TextInput } from "./Controls";

export default function ActionPanel() {
	const ctx = useActionSequence();
	const isImageExportLocked = ctx.actions.length > 100;
	const limitMarkerIndex = ctx.actions.findIndex(
		(action) => action.actionValue > ctx.actionLimit,
	);
	const limitMarkerPosition =
		limitMarkerIndex === -1 ? ctx.actions.length : limitMarkerIndex;

	return (
		<section className="min-w-0 rounded-2xl bg-gray-800 p-4 shadow">
			<div className="mb-4 grid grid-cols-1 items-start gap-3 lg:grid-cols-[420px_minmax(0,1fr)]">
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div>
						<label className="mb-2 block h-5 text-sm leading-5 text-gray-300">
							行动值上限
						</label>
						<div className="flex gap-2">
							<SelectInput
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
						<label className="mb-2 block h-5 text-sm leading-5 text-gray-300">
							显示上限
						</label>
						<input
							type="text"
							inputMode="decimal"
							value={ctx.displayedLimit}
							placeholder={formatEditableNumber(ctx.actionLimit + 100)}
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
					<div className="grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_112px]">
						<div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-2">
							{ctx.resources.map((resource, index) => (
								<div
									key={`resource-editor-${index}`}
									className="grid grid-cols-[minmax(0,1fr)_64px] gap-2"
								>
									<TextInput
										value={resource}
										placeholder="资源名称"
										onChange={(value) => ctx.updateResource(index, value)}
									/>
									<button
										type="button"
										onClick={() => ctx.removeResource(index)}
										className="h-10 rounded-lg border border-gray-600 bg-gray-800 px-2 text-xs text-gray-200 whitespace-nowrap hover:bg-gray-700"
									>
										删除
									</button>
								</div>
							))}
						</div>
						<button
							type="button"
							onClick={ctx.addResource}
							disabled={ctx.resources.length >= maxResources}
							className="h-10 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-gray-600"
						>
							添加资源
						</button>
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
					<div className="fixed inset-0 z-40" onClick={ctx.closeActionMenu} />
					<div
						className="fixed z-50 w-[580px] rounded-xl border border-gray-700 bg-gray-900 p-3 shadow-2xl"
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
							{ctx.actions.length}
						</p>
					</div>
					<table className="w-full table-auto divide-y divide-gray-700 text-left text-sm">
						<colgroup>
							<col className="w-12" />
							<col className="w-[1%]" />
							<col className="w-28" />
							<col className="w-28" />
							{ctx.resources.map((_, index) => (
								<col key={`resource-col-${index}`} />
							))}
						</colgroup>
						<thead className="bg-[#11182799] text-gray-300">
							<tr>
								<th className="w-12 min-w-12 max-w-12 whitespace-nowrap px-2 py-3 font-semibold">
									序号
								</th>
								<th className="w-[1%] whitespace-nowrap px-3 py-3 font-semibold">
									角色
								</th>
								<th className="whitespace-nowrap px-2 py-3 font-semibold">
									行动值
								</th>
								<th className="whitespace-nowrap px-2 py-3 font-semibold">
									技能
								</th>
								{ctx.resources.map((resource, index) => (
									<th
										key={`resource-header-${index}`}
										className="truncate whitespace-nowrap px-2 py-3 font-semibold"
										title={resource || `资源 ${index + 1}`}
									>
										{resource || `资源 ${index + 1}`}
									</th>
								))}
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-700">
							{ctx.actions.length === 0 ? (
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
									{ctx.actions.map((action, index) => (
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
									{limitMarkerPosition === ctx.actions.length && (
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
							: "正数减速，负数加速"
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
					className="h-10 min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
				<SelectInput
					value={
						ctx.actionOperation === "advance"
							? "relative"
							: ctx.operationSpeedMode
					}
					disabled={ctx.actionOperation !== "speed"}
					options={[
						{ value: "absolute", label: "\u00a0", title: "绝对变速" },
						{ value: "relative", label: "%", title: "相对变速" },
					]}
					onChange={(value) =>
						ctx.setOperationSpeedMode(value as SpeedChangeMode)
					}
				/>
				<button
					type="button"
					onClick={ctx.applyActionOperation}
					className="h-10 rounded-lg bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-500"
				>
					应用
				</button>
				<button
					type="button"
					onClick={ctx.closeActionMenu}
					className="h-10 rounded-lg border border-gray-600 bg-gray-800 px-3 text-sm font-medium text-gray-200 hover:bg-gray-700"
				>
					关闭
				</button>
			</div>

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

	const allies = ctx.characters.filter(
		(c) =>
			c.id !== character.id &&
			isAllyTarget(c.kind) &&
			toPositiveNumber(c.speed, 0) > 0,
	);
	const rememberedTargetId = shouldRememberSkillTarget(character.name)
		? ctx.defaultSkillTargets[character.id]
		: undefined;
	const currentTargetId = ctx.skillTargets[firstKey] ?? rememberedTargetId ?? "";
	const validCurrentTargetId = allies.some((ally) => ally.id === currentTargetId)
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
		hasSkillEffect(characterName, "E", "allyAdvance50NotPast") ||
		hasSkillEffect(characterName, "E", "allyTargetSelectable")
	);
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
	return ctx.characters
		.filter(
			(character) =>
				isCharacterTarget(character) && toPositiveNumber(character.speed, 0) > 0,
		)
		.map((character) => ({
			value: character.id,
			label:
				character.name.trim() ||
				getTargetDefaultName(character.kind, ctx.characters.indexOf(character)),
		}));
}

function hasMemeBeenSummonedBeforeAction(
	ctx: ReturnType<typeof useActionSequence>,
	ownerId: string,
	actionKey: string,
) {
	const selectedIndex = ctx.actions.findIndex((action) => action.key === actionKey);
	if (selectedIndex <= 0) return false;
	return ctx.actions.slice(0, selectedIndex).some((action) => {
		if (action.characterId !== ownerId) return false;
		if (action.isDomainAction || action.isMemospriteAction) return false;
		const skill = ctx.skillOverrides[action.key] ?? action.skill;
		return skill.includes("E");
	});
}

function MemeAdvanceSection() {
	const ctx = useActionSequence();
	const selectedKeys = [...ctx.selectedActionKeys];
	if (selectedKeys.length === 0) return null;
	const firstKey = selectedKeys[0];
	const firstAction = ctx.actions.find((action) => action.key === firstKey);
	if (!firstAction) return null;
	if (
		firstAction.isDomainAction ||
		firstAction.isMemospriteAction ||
		firstAction.isOdeExtraAction
	) {
		return null;
	}

	const actionTarget = ctx.charactersById[firstAction.characterId];
	if (!actionTarget) return null;
	if (
		actionTarget &&
		!isAllyTarget(actionTarget.kind) &&
		!isEnemyTarget(actionTarget.kind)
	) {
		return null;
	}

	const memeOwner = ctx.characters.find(
		(character) =>
			isCharacterTarget(character) &&
			toPositiveNumber(character.speed, 0) > 0 &&
			hasSkillEffect(character.name, "M", "memeAdvance"),
	);
	if (!memeOwner) return null;
	if (
		!hasMemeBeenSummonedBeforeAction(
			ctx,
			memeOwner.id,
			firstAction.key,
		)
	) {
		return null;
	}

	const memeKey = `${firstKey}-meme`;
	const currentTargetId = ctx.memeSelections[memeKey] ?? "";
	const targetOptions = getMemeTargetOptions(ctx);
	const memeRule = getMemeAdvanceRule(memeOwner.name);
	const validTargetId = targetOptions.some(
		(option) => option.value === currentTargetId,
	)
		? currentTargetId
		: "";
	if (targetOptions.length === 0) return null;
	const ownerName = getCharacterDisplayName(memeOwner.name) ?? memeOwner.name;

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
						if (validTargetId) {
							delete next[memeKey];
						} else {
							next[memeKey] =
								targetOptions.find((option) => option.value !== "")?.value ??
								"";
						}
						return next;
					});
				}}
				className={`h-8 rounded-md px-3 text-xs font-medium text-white ${
					validTargetId
						? "border border-gray-600 bg-gray-800 hover:bg-gray-700"
						: "bg-pink-600 hover:bg-pink-500"
				}`}
			>
				{validTargetId ? "取消迷迷拉条" : "迷迷拉条"}
			</button>
			{validTargetId && (
				<SelectInput
					value={validTargetId}
					options={targetOptions}
					onChange={(targetId) => {
						ctx.setMemeSelections((prev) => {
							const next = { ...prev };
							if (targetId === "") delete next[memeKey];
							else next[memeKey] = targetId;
							return next;
						});
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

	return (
		<div className="flex flex-wrap items-center gap-3 border-t border-gray-700 pt-3">
			<span className="whitespace-nowrap text-sm text-gray-300">
				插入大招：
			</span>
			<div className="flex flex-wrap items-center gap-2">
				{existingInterrupts.map((int, idx) => (
					<span
						key={`${firstKey}-int-${idx}`}
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

function ActionLimitMarkerRow({
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

/** Sub-component: single action row in the table */
function ActionRow({
	action,
	index,
	isPastOriginalLimit,
}: {
	action: GeneratedAction;
	index: number;
	isPastOriginalLimit: boolean;
}) {
	const ctx = useActionSequence();
	const isInterrupt =
		action.actionNo === 0 &&
		!action.isDomainAction &&
		!action.isMemospriteAction &&
		!action.isOdeExtraAction &&
		!action.isAssistAction;
	const isAssist = action.isAssistAction;
	const isDomain = action.isDomainAction;
	const isEnemyAction = isEnemyTarget(ctx.characterKinds[action.characterId]);
	const isCyreneMemospriteAction = Boolean(
		action.isMemospriteAction &&
			action.memospriteOwnerId &&
			hasSkillEffect(
				ctx.charactersById[action.memospriteOwnerId]?.name ?? "",
				"Q",
				"cyreneUltimate",
			),
	);
	const displayName =
		action.displayName ?? ctx.characterNames[action.characterId] ?? action.characterId;
	const isSelected = ctx.selectedActionKeys.has(action.key);
	const speedAdjustment = ctx.speedAdjustments[action.key];
	const getPreviousDomainActionValue = () => {
		const match = action.key.match(/^(.*-domain-)(\d+)$/);
		if (!match) return undefined;
		const previousIndex = Number.parseInt(match[2], 10) - 1;
		if (!Number.isFinite(previousIndex) || previousIndex < 0) {
			return undefined;
		}
		const previousAction = ctx.actions.find(
			(candidate) => candidate.key === `${match[1]}${previousIndex}`,
		);
		return previousAction?.actionValue;
	};
	const validateDomainActionValueOverride = () => {
		if (!action.isDomainAction) return;
		const rawValue =
			ctx.overrides[action.key] ?? formatActionValue(action.actionValue);
		if (rawValue === "") return;
		const parsed = Number.parseFloat(rawValue);
		if (!Number.isFinite(parsed)) return;
		const previousActionValue = getPreviousDomainActionValue();
		if (previousActionValue === undefined || parsed >= previousActionValue) {
			return;
		}
		ctx.setOverrides((prev) => ({
			...prev,
			[action.key]: formatEditableNumber(previousActionValue),
		}));
		ctx.setMessage("白厄境界行动值不能早于上一个额外回合");
	};
	const rowClass = (() => {
		if (isInterrupt) {
			return isSelected
				? "bg-[#065f4680] outline outline-1 outline-emerald-300"
				: "bg-[#064e3b66] outline outline-1 outline-emerald-500";
		}
		if (isCyreneMemospriteAction) {
			return isSelected
				? "bg-[#9d174d80] outline outline-1 outline-pink-300"
				: "bg-[#83184366] outline outline-1 outline-pink-400";
		}
		if (isDomain) {
			return isSelected
				? "bg-[#7e22ce80] outline outline-1 outline-purple-300"
				: "bg-[#581c8766] outline outline-1 outline-purple-400";
		}
		if (isEnemyAction) {
			return isSelected
				? "bg-[#7f1d1d80] outline outline-1 outline-red-300"
				: "bg-[#450a0a66] hover:bg-[#450a0a80]";
		}
		return isSelected
			? "bg-[#4b556380] outline outline-1 outline-gray-400"
			: "hover:bg-[#3741514d]";
	})();

	return (
		<tr
			key={action.key}
			onClick={(event) =>
				ctx.selectAction(action.key, event.ctrlKey || event.metaKey)
			}
			onContextMenu={(event) => {
				event.preventDefault();
				ctx.openActionMenu(
					action.key,
					event.ctrlKey || event.metaKey,
					event.clientY,
				);
			}}
			className={`cursor-pointer select-none ${rowClass} ${isPastOriginalLimit ? "border-l-2 border-l-cyan-400/70 opacity-80" : ""}`}
		>
			<td
				className={`w-12 min-w-12 max-w-12 whitespace-nowrap px-2 py-3 ${isEnemyAction ? "text-red-100" : "text-gray-400"}`}
			>
				{index + 1}
				{action.activeOdeLabels && action.activeOdeLabels.length > 0 && (
					<span
						className="ml-1 text-pink-300"
						title={action.activeOdeLabels.join("、")}
					>
						♥
					</span>
				)}
			</td>
			<td className="w-[1%] max-w-32 whitespace-nowrap px-3 py-4">
				<div
					className="truncate font-medium leading-5 text-white"
					title={displayName}
				>
					{displayName}
				</div>
				<div
					className={`truncate text-xs leading-5 ${isEnemyAction ? "text-[#fecacacc]" : "text-gray-400"}`}
				>
					{isDomain
					? `境界 ${action.actionNo}`
					: isAssist
						? "助战"
						: action.isMemeAction
						? "额外"
						: action.isMemospriteAction && action.actionNo > 0
						? `第 ${action.actionNo} 动`
						: action.isMemospriteAction
						? "额外"
						: action.isOdeExtraAction
						? "诗篇"
						: isInterrupt
						? "插队"
						: action.isAssistFollowUp
						? `额外 ${action.actionNo}`
						: `第 ${action.actionNo} 动`}
				</div>
			</td>
			<td className="px-2 py-3">
				<input
					type="text"
					inputMode="decimal"
					value={
						ctx.overrides[action.key] ?? formatActionValue(action.actionValue)
					}
					onChange={(event) => {
						const nextValue = event.target.value;
						if (nextValue === "") {
							ctx.setOverrides((prev) => {
								const n = { ...prev };
								delete n[action.key];
								return n;
							});
						} else if (/^\d*\.?\d*$/.test(nextValue)) {
							const parsed = Number.parseFloat(nextValue);
							if (
								Number.isFinite(parsed) &&
								parsed > ctx.displayedActionLimit
							) {
								ctx.setOverrides((prev) => ({
									...prev,
									[action.key]: formatEditableNumber(
										ctx.displayedActionLimit,
									),
								}));
								ctx.setMessage(
									"行动值不能超过当前显示上限，已自动贴到显示上限",
								);
								return;
							}
							ctx.setOverrides((prev) => ({
								...prev,
								[action.key]: nextValue,
							}));
						}
						}}
						onClick={(event) => event.stopPropagation()}
						onContextMenu={(event) => event.stopPropagation()}
						onBlur={validateDomainActionValueOverride}
						className="h-10 w-full rounded-lg border border-gray-600 bg-gray-700 px-2 font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
			</td>
			<td className="px-2 py-3">
				<div className="flex items-start gap-1">
					<SkillInput action={action} />
					<OdeInline action={action} />
					<MemeInline action={action} />
					<SkillTargetInline action={action} />
				</div>
				{isQFrontCombo(action.skill) && (
					<div className="mt-0.5 text-[10px] leading-3 text-gray-500">
						风舞不生效
					</div>
				)}
				{speedAdjustment && (
					<div className="mt-1 truncate text-xs text-blue-100">
						{speedAdjustment.mode === "relative" ? "%" : " "}
						{speedAdjustment.value}
					</div>
				)}
			</td>
			{ctx.resources.map((resource, resourceIndex) => (
				<td
					key={`${action.key}-resource-${resourceIndex}`}
					className="px-2 py-3"
				>
					<input
						type="text"
						value={ctx.resourceValues[action.key]?.[resource] ?? ""}
						onClick={(event) => event.stopPropagation()}
						onContextMenu={(event) => event.stopPropagation()}
						onChange={(event) =>
							ctx.updateResourceValue(action.key, resource, event.target.value)
						}
						className="h-10 w-full min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
					/>
				</td>
			))}
		</tr>
	);
}

function SkillInput({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	const char = ctx.charactersById[action.characterId];
	const inputRef = useRef<HTMLInputElement>(null);

	const displaySkill = action.isDomainFinalAction
		? action.skill
		: action.isAssistFollowUp
			? action.skill
		: (ctx.skillOverrides[action.key] ?? action.skill);
	const isDomain = action.isDomainAction;
	const isDomainFinalAction = action.isDomainFinalAction;
	const isInterrupt =
		action.actionNo === 0 &&
		!action.isDomainAction &&
		!action.isMemospriteAction &&
		!action.isOdeExtraAction &&
		!action.isAssistAction;
	const disabled = char
		? action.isAssistAction ||
			action.lockedSkill ||
			action.isMemospriteAction ||
			ctx.characterKinds[action.characterId] !== "角色"
		: true;
	const nonDomainSkillTitle =
		char && hasSemanticFlag(char.name, "wOnlyInDomain")
			? "A 普攻，E 战技，Q 大招，F 助战技；W 仅境界内"
			: "A 普攻，E 战技，Q 大招，W 反击，F 助战技";
	const domainSkillTitle =
		char === undefined
			? "境界内可填写技能"
			: `境界内可填写 ${getCounterWDomainRule(char.name).allowedSkills
					.filter(Boolean)
					.join("、")}`;

	useEffect(() => {
		if (inputRef.current && document.activeElement !== inputRef.current) {
			inputRef.current.value = displaySkill;
		}
	}, [displaySkill]);

	const commitDraftSkill = (rawSkill: string) => {
		const normalizedSkill = rawSkill.trim().toUpperCase();
		window.setTimeout(() => {
			if (normalizedSkill !== displaySkill) {
				ctx.updateActionSkill(action, normalizedSkill);
			}
		}, 0);
		return normalizedSkill;
	};

	if (isDomainFinalAction) {
		return (
			<>
				<span
					title="境界最后一动，固定显示为 Q，不视为白厄再次释放大招"
					className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-lg border border-[#fbbf2499] bg-[#f59e0b33] font-mono text-sm font-black text-amber-100"
				>
					Q
				</span>
				<span
					title="白厄大招境界"
					className="flex h-10 shrink-0 select-none items-center rounded-lg border border-[#a855f799] bg-[#581c8733] px-2 text-xs font-semibold text-purple-100"
				>
					境界
				</span>
			</>
		);
	}

	return (
		<>
			<input
				ref={inputRef}
				type="text"
				defaultValue={displaySkill}
				maxLength={6}
				disabled={disabled}
				data-export-kind={isDomain ? "domain-skill" : undefined}
				title={
					isDomain
						? domainSkillTitle
						: nonDomainSkillTitle
				}
				onFocus={(event) => event.currentTarget.select()}
				onMouseDown={(event) => event.stopPropagation()}
				onPointerDown={(event) => event.stopPropagation()}
				onClick={(event) => event.stopPropagation()}
				onContextMenu={(event) => event.stopPropagation()}
				onBlur={(event) => {
					event.currentTarget.value = commitDraftSkill(event.currentTarget.value);
				}}
				className={`h-10 shrink-0 select-text rounded-lg border px-1 text-center font-mono text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-45 ${
					isDomain
						? "w-10 border-[#fbbf2499] bg-[#f59e0b33] text-amber-100"
						: displaySkill === "Q" && !isInterrupt
							? "w-12 border-[#fbbf2499] bg-[#f59e0b33] text-amber-100"
							: "w-12 border-gray-600 bg-gray-700 text-gray-300"
				}`}
			/>
			{isDomain && (
				<span
					title="白厄大招境界"
					className="flex h-10 shrink-0 select-none items-center rounded-lg border border-[#a855f799] bg-[#581c8733] px-2 text-xs font-semibold text-purple-100"
				>
					境界
				</span>
			)}
		</>
	);
}

function OdeInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	if (action.isMemeAction) return null;
	if (!action.isMemospriteAction || !action.memospriteOwnerId) return null;
	const owner = ctx.charactersById[action.memospriteOwnerId];
	if (!owner) return null;
	if (!hasSkillEffect(owner.name, "Q", "cyreneUltimate")) return null;
	const cyreneRule = getCyreneUltimateRule(owner.name);
	const selection = ctx.odeSelections[action.key];
	const allies = ctx.characters.filter(
		(character) =>
			isAllyTarget(character.kind) && toPositiveNumber(character.speed, 0) > 0,
	);
	const targetOptions = allies.map((character) => {
		const ode = getOdeRuleForTarget(cyreneRule, character.name);
		return {
			value: character.id,
			label:
				character.name.trim() ||
				getTargetDefaultName(character.kind, ctx.characters.indexOf(character)),
			title: ode.fullName,
		};
	});
	const validTargetId = targetOptions.some(
		(option) => option.value === selection?.targetId,
	)
		? (selection?.targetId ?? "")
		: "";

	return (
		<>
			<SelectInput
				value={validTargetId}
				options={[
					{ value: "", label: "攻击" },
					...targetOptions,
				]}
				onChange={(targetId) => {
					ctx.setOdeSelections((prev) => {
						const next = { ...prev };
						if (targetId === "") {
							delete next[action.key];
							return next;
						}
						const target = ctx.characters.find(
							(character) => character.id === targetId,
						);
						const ode = target
							? getOdeRuleForTarget(cyreneRule, target.name)
							: cyreneRule.genericOde;
						next[action.key] = {
							odeCode: ode.code,
							targetId,
						};
						return next;
					});
				}}
				className="w-28"
			/>
		</>
	);
}

function MemeInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	if (!action.isMemeAction) return null;
	const targetOptions = getMemeTargetOptions(ctx);
	const currentTargetId = ctx.memeSelections[action.key] ?? "";
	const validTargetId = targetOptions.some(
		(option) => option.value === currentTargetId,
	)
		? currentTargetId
		: "";

	return (
		<SelectInput
			value={validTargetId}
			options={[{ value: "", label: "无目标" }, ...targetOptions]}
			onChange={(targetId) => {
				ctx.setMemeSelections((prev) => {
					const next = { ...prev };
					if (targetId === "") delete next[action.key];
					else next[action.key] = targetId;
					return next;
				});
			}}
			className="w-32"
		/>
	);
}

function SkillTargetInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	const char = ctx.charactersById[action.characterId];
	const rememberedTargetId =
		char && shouldRememberSkillTarget(char.name)
			? ctx.defaultSkillTargets[action.characterId]
			: undefined;
	const targetId = ctx.skillTargets[action.key] ?? rememberedTargetId;
	const skill = action.isDomainFinalAction
		? action.skill
		: (ctx.skillOverrides[action.key] ?? action.skill);
	const isTargetableSkill = Boolean(
		char &&
		isCharacterTarget(char) &&
		skill.includes("E") &&
		hasTargetableESkill(char.name),
	);

	if (isTargetableSkill && char) {
		const allies = ctx.characters.filter(
			(c) =>
				c.id !== char.id &&
				isAllyTarget(c.kind) &&
				toPositiveNumber(c.speed, 0) > 0,
		);
		const validTargetId = allies.some((ally) => ally.id === targetId)
			? (targetId ?? "")
			: "";
		const targetOptions = [
			{ value: "", label: "无目标" },
			...allies.map((c) => ({
				value: c.id,
				label:
					c.name.trim() ||
					getTargetDefaultName(c.kind, ctx.characters.indexOf(c)),
			})),
		];

		return (
			<SelectInput
				value={validTargetId}
				options={targetOptions}
				onChange={(nextTarget) => ctx.updateSkillTarget(action, nextTarget)}
				className="flex-1 min-w-0"
			/>
		);
	}

	const explicitTargetId = ctx.skillTargets[action.key];
	if (isTargetableSkill && explicitTargetId) {
		const targetName = ctx.characterNames[explicitTargetId] ?? explicitTargetId;
		return (
			<span className="truncate text-xs text-amber-200/80">→{targetName}</span>
		);
	}

	return null;
}

function ExportExcelButton() {
	const ctx = useActionSequence();
	const [exporting, setExporting] = useState(false);

	const doExport = useCallback(async () => {
		if (ctx.actions.length === 0) {
			ctx.setMessage("没有行动数据可导出");
			return;
		}
		try {
			setExporting(true);
			const header = ["序号", "角色", "动数", "行动值", "技能"];
			for (const r of ctx.resources) {
				header.push(r || `资源`);
			}
			const rows = ctx.actions.map((a, i) => {
				const row: (string | number)[] = [
					i + 1,
					ctx.characterNames[a.characterId] ?? a.characterId,
					a.isDomainAction ? `境界${a.actionNo}` : `第${a.actionNo}动`,
					Number.parseFloat(formatActionValue(a.actionValue)),
					a.skill,
				];
				for (const r of ctx.resources) {
					row.push(ctx.resourceValues[a.key]?.[r] ?? "");
				}
				return row;
			});
			const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
			ws["!cols"] = [
				{ wch: 6 },
				{ wch: 10 },
				{ wch: 8 },
				{ wch: 10 },
				{ wch: 6 },
				...ctx.resources.map(() => ({ wch: 10 })),
			];
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "行动序列");
			const base64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

			const selectedPath = await save({
				title: "导出 Excel",
				defaultPath: `action-sequence-${Date.now()}.xlsx`,
				filters: [{ name: "Excel", extensions: ["xlsx"] }],
			});
			if (!selectedPath) {
				setExporting(false);
				return;
			}
			const filePath = ensureFileExtension(selectedPath, ".xlsx");
			await invoke("write_base64_file", { path: filePath, dataBase64: base64 });
			ctx.setMessage(`已导出 Excel 文件：${filePath}`);
		} catch (error) {
			ctx.setMessage(`Excel 导出失败：${getErrorMessage(error)}`);
		} finally {
			setExporting(false);
		}
	}, [ctx.actions, ctx.characterNames, ctx.resources, ctx.resourceValues]);

	return (
		<button
			type="button"
			onClick={doExport}
			disabled={exporting}
			className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-gray-600"
		>
			{exporting ? "生成中..." : "导出 Excel"}
		</button>
	);
}
