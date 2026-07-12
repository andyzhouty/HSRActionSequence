import { useState } from "react";
import ahaIcon from "../../assets/aha/aha.webp";
import fireflyUltIcon from "../../assets/skillIcons/SkillIcon_1310_Ultra.webp";
import swPassiveIcon from "../../assets/skillIcons/SkillIcon_1506_Passive.webp";
import swRank2Icon from "../../assets/skillIcons/SkillIcon_1506_Rank2.webp";
import souldragonIcon from "../../assets/skillIcons/SkillIcon_1414_BP.webp";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { getDisplayOrderedActions } from "../../utils/actionDisplayOrder";
import type { GeneratedAction } from "../../utils/actionSequence";
import {
	canSelectSkillTargetForAction,
	formatActionValue,
	formatEditableNumber,
	getCounterWDomainRule,
	getCyreneUltimateRule,
	getFireflyCombustionRule,
	getCharacterCid,
	getOdeRuleForTarget,
	getTargetDefaultName,
	hasSemanticFlag,
	hasSkillEffect,
	isAllyTarget,
	isCharacterTarget,
	isEnemyTarget,
	isQFrontCombo,
	shouldRememberSkillTarget,
	toPositiveNumber,
} from "../../utils/actionSequence";
import { hasSilverWolfGodmode } from "../../mechanics/silverWolfGodmode";
import { SelectInput } from "./Controls";

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

	// 昔涟的德谬歌由 Q 即刻召唤，同样需要等 Q 之后
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
		if (isGarmentmaker) {
			// 衣匠由 E 或 Q 召唤
			return skill.includes("E") || skill.includes("Q");
		}
		// 迷迷 / 德谬歌由 E 或 Q 召唤
		return skill.includes("E") || skill.includes("Q");
	});
}

function hasTargetableESkill(characterName: string) {
	return (
		hasSkillEffect(characterName, "E", "allyPullToCurrent") ||
		hasSkillEffect(characterName, "E", "sundayPullWithMemosprite") ||
		hasSkillEffect(characterName, "E", "allyAdvance50NotPast") ||
		hasSkillEffect(characterName, "E", "allyTargetSelectable")
	);
}

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

/** Sub-component: single action row in the table */
export function ActionRow({
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
		!action.isSparxieExtraAction &&
		!action.isDomainAction &&
		!action.isMemospriteAction &&
		!action.isEveyAction &&
		!action.isOdeExtraAction &&
		!action.isAssistAction;
	const isAssist = action.isAssistAction;
	const isDomain = action.isDomainAction;
	const isEnemyAction = isEnemyTarget(ctx.characterKinds[action.characterId]);
	const isCombustionCountdown =
		action.isCombustionAction &&
		(action.targetKind === "非忆灵" || action.targetKind === "倒计时");
	const isCyreneMemospriteAction = Boolean(
		action.isMemospriteAction &&
			action.memospriteOwnerId &&
			hasSkillEffect(
				ctx.charactersById[action.memospriteOwnerId]?.name ?? "",
				"Q",
				"cyreneUltimate",
			),
	);
	const isPollux = action.isPolluxAction;
	const displayName =
		action.displayName ??
		ctx.characterNames[action.characterId] ??
		action.characterId;
	const isSelected = ctx.selectedActionKeys.has(action.key);
	const speedAdjustment = ctx.speedAdjustments[action.key];
	const [actionValueDraft, setActionValueDraft] = useState<string | null>(null);
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
			ctx.overrides[action.key] ?? formatEditableNumber(action.actionValue);
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
		if (action.characterId === "@av0") {
			return isSelected
				? "bg-[#1e40af80] outline outline-1 outline-blue-300"
				: "bg-[#1e3a5f66] hover:bg-[#1e3a5f80]";
		}
		if (isPollux) {
			return isSelected
				? "bg-[#6b21a880] outline outline-1 outline-purple-300"
				: "bg-[#4c1d9566] hover:bg-[#4c1d9580]";
		}
		if (action.isEveyAction) {
			return isSelected
				? "bg-[#8F435C99] outline outline-1 outline-pink-200"
				: "bg-[#8F435C] hover:bg-[#79354C]";
		}
		if (isDomain) {
			return isSelected
				? "bg-[#7e22ce80] outline outline-1 outline-purple-300"
				: "bg-[#581c8766] outline outline-1 outline-purple-400";
		}
		if (action.isAglaeaGarmentmakerAction) {
			return isSelected
				? "bg-[#eab30880] outline outline-1 outline-yellow-300"
				: "bg-[#ca8a0466] hover:bg-[#ca8a0480]";
		}
		if (action.isAglaeaCountdownAction) {
			return isSelected
				? "bg-[#92400e80] outline outline-1 outline-amber-300"
				: "bg-[#78350f66] hover:bg-[#78350f80]";
		}
		if (action.isAglaeaSupremeAction) {
			return isSelected
				? "bg-[#a1620780] outline outline-1 outline-yellow-300"
				: "bg-[#713f1266] hover:bg-[#713f1280]";
		}
		if (isEnemyAction) {
			return isSelected
				? "bg-[#7f1d1d80] outline outline-1 outline-red-300"
				: "bg-[#450a0a66] hover:bg-[#450a0a80]";
		}
		if (action.isCombustionAction) {
			return isSelected
				? "bg-[#6ab5b680] outline outline-1 outline-teal-300"
				: "bg-[#6ab5b666] hover:bg-[#6ab5b680]";
		}
		if (action.isAhaInstant) {
			return isSelected
				? "bg-[#ea580c80] outline outline-1 outline-orange-300"
				: "bg-[#c2410c66] hover:bg-[#c2410c80]";
		}
		if (
			action.isMemospriteAction &&
			!action.isAglaeaGarmentmakerAction &&
			!isCyreneMemospriteAction
		) {
			return isSelected
				? "bg-[#ee598980] outline outline-1 outline-pink-300"
				: "bg-[#ec489966] hover:bg-[#db277780]";
		}
		return isSelected
			? "bg-[#4b556380] outline outline-1 outline-gray-400"
			: "hover:bg-[#3741514d]";
	})();

	return (
		<tr
			key={action.key}
			data-action-key={action.key}
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
			title={
				speedAdjustment
					? `速度: ${action.speed} (后续${speedAdjustment.mode === "relative" ? `${speedAdjustment.value}%` : speedAdjustment.value}) / 行动值: ${formatActionValue(action.actionValue)}`
					: `速度: ${action.speed} / 行动值: ${formatActionValue(action.actionValue)}`
			}
			className={`cursor-pointer select-none ${rowClass} ${isPastOriginalLimit ? "border-l-2 border-l-cyan-400/70 opacity-80" : ""}`}
		>
			<td
				className={`w-12 min-w-12 max-w-12 whitespace-nowrap px-2 py-3 ${isEnemyAction ? "text-red-100" : "text-gray-400"}`}
			>
				{isCombustionCountdown ? (
					<div className="flex h-full items-center justify-center">
						<img
							src={fireflyUltIcon}
							alt="🔥"
							className="inline-block h-5 w-5"
						/>
					</div>
				) : action.isAhaInstant ? (
					<div className="flex h-full items-center justify-center">
						<img src={ahaIcon} alt="🎭" className="inline-block h-6 w-6" />
					</div>
				) : action.isSouldragonAction ? (
					<div className="flex h-full items-center justify-center">
						<img
							src={souldragonIcon}
							alt="龙灵"
							className="inline-block h-7 w-7"
						/>
					</div>
				) : action.skill === "Q" &&
				  hasSilverWolfGodmode(
						ctx.charactersById[action.characterId]?.name ?? "",
					) ? (
					<div className="flex h-full items-center justify-center">
						<img
							src={swPassiveIcon}
							alt="⚡"
							className="inline-block h-6 w-6"
						/>
					</div>
				) : action.key.includes("-godmode-A") ? (
					<div className="flex h-full items-center justify-center">
						<img
							src={swRank2Icon}
							alt="E2"
							className="inline-block h-6 w-6"
						/>
					</div>
				) : (
					index + 1
				)}
				{action.isRomanceAction && (
					<span className="text-yellow-300" title="浪漫之诗充能">
						⚡
					</span>
				)}
				{action.activeOdeLabels && action.activeOdeLabels.length > 0 && (
					<span
						className="text-pink-300"
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
				{!action.isAglaeaCountdownAction &&
					!isCombustionCountdown &&
					!action.isSouldragonAction &&
					action.characterId !== "@av0" && (
					<div
						className={`truncate text-xs leading-5 ${isEnemyAction ? "text-[#fecacacc]" : "text-gray-400"}`}
					>
						{action.isAhaInstant
							? action.isExtraAha
								? "额外"
								: "阿哈"
							: action.isSparxieExtraAction
								? "额外"
							: isDomain
								? `境界 ${action.actionNo}`
						: isAssist
							? "助战"
							: action.isEveySelfDestructAction
								? "额外"
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
															: action.key.includes("-break-extra-")
																? "额外"
																: action.isAglaeaSupremeAction
																	? `至高 ${action.actionNo}`
																	: `第 ${action.actionNo} 动`}
					</div>
				)}
			</td>

			<td className="px-2 py-3">
				<input
					type="text"
					inputMode="decimal"
					value={
						actionValueDraft ??
						formatActionValue(
							Number.parseFloat(
								ctx.overrides[action.key] ??
									formatEditableNumber(action.actionValue),
							),
						)
					}
					onFocus={() => {
						const currentValue = Number.parseFloat(
							ctx.overrides[action.key] ??
								formatEditableNumber(action.actionValue),
						);
						setActionValueDraft(formatActionValue(currentValue));
					}}
					onChange={(event) => {
						const nextValue = event.target.value;
						setActionValueDraft(nextValue);
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
									[action.key]: formatEditableNumber(ctx.displayedActionLimit),
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
					onBlur={() => {
						setActionValueDraft(null);
						validateDomainActionValueOverride();
					}}
					className="h-10 w-full rounded-lg border border-gray-600 bg-gray-700 px-2 font-mono text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
				/>
			</td>
			<td className="px-2 py-3">
				<div className="flex items-center gap-1">
					{!action.isAglaeaCountdownAction &&
						!isCombustionCountdown &&
						!action.isSouldragonAction && (
						<SkillInput action={action} />
					)}
					<OdeInline action={action} />
					{!action.isAglaeaCountdownAction && !isCombustionCountdown && (
						<CombustionBreakInline action={action} />
					)}
					<PolluxKillInline action={action} />
					<MemeInline action={action} />
					<SkillTargetInline action={action} />
					<AttackInline action={action} />
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
			{ctx.resources.map((resource) => (
				<td key={`${action.key}-resource-${resource}`} className="px-2 py-3">
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

function AttackInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	const attacker = ctx.charactersById[action.characterId];
	const hasSouldragonOwner = ctx.characters.some(
		(character) => getCharacterCid(character.name) === "1414",
	);
	if (
		!hasSouldragonOwner ||
		!attacker ||
		attacker.kind !== "角色" ||
		action.isSouldragonAction
	) {
		return null;
	}

	const isForcedOff =
		getCharacterCid(attacker.name) === "1414" && action.skill === "E";
	const isEnabled = !isForcedOff && ctx.attackDisabled[action.key] !== true;

	return (
		<button
			type="button"
			disabled={isForcedOff}
			aria-pressed={isEnabled}
			onClick={(event) => {
				event.stopPropagation();
				if (isForcedOff) return;
				ctx.setAttackDisabled((prev) => {
					const next = { ...prev };
					if (isEnabled) next[action.key] = true;
					else delete next[action.key];
					return next;
				});
			}}
			className={`h-8 rounded-md border px-2 text-xs font-medium ${
				isEnabled
					? "border-red-500/60 bg-red-900/50 text-red-100 hover:bg-red-800/60"
					: "border-gray-600 bg-gray-800 text-gray-500 disabled:cursor-not-allowed"
			}`}
		>
			攻击
		</button>
	);
}

function SkillInput({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	const char = ctx.charactersById[action.characterId];

	const rawDisplaySkill =
		action.isDomainFinalAction ||
		action.isAssistFollowUp ||
		action.isCombustionAction
			? action.skill
			: (ctx.skillOverrides[action.key] ?? action.skill);
	// 输入框失焦后自动去除 AQ/EQ 中的 Q（Q 由引擎处理为插队）
	const displaySkill =
		rawDisplaySkill.length > 1 && rawDisplaySkill.includes("Q")
			? rawDisplaySkill.replace(/Q/g, "")
			: rawDisplaySkill;
	const isDomain = action.isDomainAction;
	const isDomainFinalAction = action.isDomainFinalAction;
	const isInterrupt =
		action.actionNo === 0 &&
		!action.isSparxieExtraAction &&
		!action.isDomainAction &&
		!action.isMemospriteAction &&
		!action.isEveyAction &&
		!action.isOdeExtraAction &&
		!action.isAssistAction;
	const disabled = char
		? action.isAssistAction ||
			(action.lockedSkill && !action.isPolluxAction) ||
			(action.isMemospriteAction &&
				!action.isPolluxAction &&
				!action.isEveyAction) ||
			(ctx.characterKinds[action.characterId] !== "角色" &&
				!action.isPolluxAction &&
				!action.isEveyAction)
		: !action.isPolluxAction && !action.isEveyAction;
	const nonDomainSkillTitle =
		char && hasSemanticFlag(char.name, "wOnlyInDomain")
			? "A 普攻，E 战技，Q 大招，F 助战技；W 仅境界内"
			: "A 普攻，E 战技，Q 大招，W 反击，F 助战技";
	const domainSkillTitle =
		char === undefined
			? "境界内可填写技能"
			: char.eidolon >= 2
				? `境界内可填写 ${getCounterWDomainRule(char.name)
						.allowedSkills.filter(Boolean)
						.join("、")}`
				: "境界内可填写 " +
					getCounterWDomainRule(char.name)
						.allowedSkills.filter((s) => s !== "EA" && s !== "EW")
						.join("、");
	const supremeSkillTitle =
		char === undefined ? "至高之姿下可填写技能" : "至高之姿下可填写 A、AQ、Q";
	const skillTitle = action.isEpicTriggeredMemosprite
		? "记忆主史诗触发的德谬歌额外攻击"
		: action.isCyreneEnhancedQ
			? "昔涟强化Q触发的德谬歌额外回合"
			: isDomain
				? domainSkillTitle
				: action.isAglaeaSupremeAction
					? supremeSkillTitle
					: nonDomainSkillTitle;
	const [draft, setDraft] = useState<string | null>(null);
	const commitDraftSkill = (rawSkill: string) => {
		const normalizedSkill = rawSkill.trim().toUpperCase();
		window.setTimeout(() => {
			if (normalizedSkill !== displaySkill) {
				ctx.updateActionSkill(action, normalizedSkill);
			}
		}, 0);
	};

	if (action.isAhaInstant) {
		return (
			<div className="flex h-10 w-10 shrink-0 items-center justify-center">
				<img src={ahaIcon} alt="🎭" className="inline-block h-8 w-8" />
			</div>
		);
	}

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

	const resolvedValue = draft ?? displaySkill;

	return (
		<>
			<input
				type="text"
				value={resolvedValue}
				onChange={(event) => setDraft(event.currentTarget.value.toUpperCase())}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						commitDraftSkill(draft ?? displaySkill);
						setDraft(null);
					}
				}}
				maxLength={6}
				disabled={disabled}
				data-export-kind={isDomain ? "domain-skill" : undefined}
				title={skillTitle}
				onFocus={(event) => event.currentTarget.select()}
				onMouseDown={(event) => event.stopPropagation()}
				onPointerDown={(event) => event.stopPropagation()}
				onClick={(event) => event.stopPropagation()}
				onContextMenu={(event) => event.stopPropagation()}
				onBlur={() => {
					commitDraftSkill(draft ?? displaySkill);
					setDraft(null);
				}}
				className={`h-10 shrink-0 select-text rounded-lg border px-1 text-center font-mono text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-45 ${
					isDomain
						? "w-10 border-[#fbbf2499] bg-[#f59e0b33] text-amber-100"
						: action.isAglaeaSupremeAction
							? "w-12 border-[#facc1599] bg-[#ca8a0433] text-yellow-100"
							: resolvedValue === "Q" && !isInterrupt
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
	if (action.isEpicTriggeredMemosprite) return null;
	if (action.isCyreneEnhancedQ) return null;
	if (!action.isMemospriteAction || !action.memospriteOwnerId) return null;
	const owner = ctx.charactersById[action.memospriteOwnerId];
	if (!owner) return null;
	if (!hasSkillEffect(owner.name, "Q", "cyreneUltimate")) return null;
	const cyreneRule = getCyreneUltimateRule(owner.name);
	const selection = ctx.odeSelections[action.key];
	const allies = ctx.characters.filter(
		(character) =>
			isAllyTarget(character.kind) &&
			character.id !== owner.id &&
			toPositiveNumber(character.speed, 0) > 0,
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
		<SelectInput
			value={validTargetId}
			options={[{ value: "", label: "攻击" }, ...targetOptions]}
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
	);
}

function CombustionBreakInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	if (!action.isCombustionAction) return null;
	const character = ctx.charactersById[action.characterId];
	const rule = getFireflyCombustionRule(character?.name ?? "");
	// 击破开关，默认 false = 不触发
	const isBreakOn = ctx.fireflyBreakCounters[action.key] === true;
	return (
		<button
			type="button"
			title={
				isBreakOn
					? `${rule.breakLabel}触发中（点击关闭）`
					: `${rule.breakLabel}关闭（点击开启）`
			}
			onMouseDown={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={(event) => {
				event.stopPropagation();
				ctx.setFireflyBreakCounters((prev) => {
					const next = { ...prev };
					if (isBreakOn) {
						delete next[action.key];
					} else {
						next[action.key] = true;
					}
					return next;
				});
			}}
			className={`flex h-7 shrink-0 items-center rounded-md px-2 text-xs font-semibold transition-colors ${
				isBreakOn
					? "border border-orange-500/70 bg-orange-500/20 text-orange-200"
					: "border border-gray-600 bg-gray-700 text-gray-500"
			}`}
		>
			{rule.breakLabel}
		</button>
	);
}

function PolluxKillInline({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	if (!action.isPolluxAction) return null;
	// Only show for dismiss skill (E) actions
	if (action.skill !== "E") return null;
	const isKillOn = ctx.castoriceKillToggles[action.key] === true;
	return (
		<button
			type="button"
			title={
				isKillOn
					? "击杀：E 后死龙不消失且速度翻倍（点击关闭）"
					: "击杀关闭（点击开启：E 后不消失且速度翻倍）"
			}
			onMouseDown={(event) => event.stopPropagation()}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={(event) => {
				event.stopPropagation();
				ctx.setCastoriceKillToggles((prev) => {
					const next = { ...prev };
					if (isKillOn) {
						delete next[action.key];
					} else {
						next[action.key] = true;
					}
					return next;
				});
			}}
			className={`flex h-7 shrink-0 items-center rounded-md px-2 text-xs font-semibold transition-colors ${
				isKillOn
					? "border border-red-500/70 bg-red-500/20 text-red-200"
					: "border border-gray-600 bg-gray-700 text-gray-500"
			}`}
		>
			击杀
		</button>
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
				if (targetId) ctx.setLastMemeTarget(targetId);
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
	const skill =
		action.isDomainFinalAction || action.isCombustionAction
			? action.skill
			: (ctx.skillOverrides[action.key] ?? action.skill);
	const isTargetableSkill = Boolean(
		char &&
			isCharacterTarget(char) &&
			skill.includes("E") &&
			hasTargetableESkill(char.name),
	);

	if (isTargetableSkill && char) {
		const availableMemos = ctx.memospriteTargets.filter((m) =>
			isMemospriteAvailableForAction(ctx, m, action.key),
		);
		const allies = [...ctx.characters, ...availableMemos].filter(
			(c) =>
				canSelectSkillTargetForAction(char, c) &&
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

