import { useState } from "react";
import ahaIcon from "../../assets/aha/aha.webp";
import fireflyUltIcon from "../../assets/skillIcons/SkillIcon_1310_Ultra.webp";
import souldragonIcon from "../../assets/skillIcons/SkillIcon_1414_BP.webp";
import swPassiveIcon from "../../assets/skillIcons/SkillIcon_1506_Passive.webp";
import swRank2Icon from "../../assets/skillIcons/SkillIcon_1506_Rank2.webp";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import { archerFuaResourceName } from "../../mechanics/archer";
import { gilgameshInterestResourceName } from "../../mechanics/gilgamesh";
import { hasSilverWolfGodmode } from "../../mechanics/silverWolfGodmode";
import type { GeneratedAction } from "../../utils/actionSequence";
import {
	formatActionValue,
	formatEditableNumber,
	hasSkillEffect,
	isEnemyTarget,
	isQFrontCombo,
} from "../../utils/actionSequence";
import {
	CombustionBreakInline,
	MemeInline,
	OdeInline,
	PolluxKillInline,
	SkillTargetInline,
} from "./ActionTargetControls";
import { AttackInline } from "./AttackInline";
import { SkillInput } from "./SkillInput";

export { ActionLimitMarkerRow } from "./ActionLimitMarkerRow";

const exchangeGroupThemes = [
	{
		ring: "ring-cyan-300/70",
		marker: "border-cyan-300/70 bg-cyan-950/80 text-cyan-100",
	},
	{
		ring: "ring-emerald-300/70",
		marker: "border-emerald-300/70 bg-emerald-950/80 text-emerald-100",
	},
	{
		ring: "ring-fuchsia-300/70",
		marker: "border-fuchsia-300/70 bg-fuchsia-950/80 text-fuchsia-100",
	},
	{
		ring: "ring-amber-300/70",
		marker: "border-amber-300/70 bg-amber-950/80 text-amber-100",
	},
] as const;

export type ActionRowDragProps = {
	draggable: boolean;
	groupNumber: number;
	onDragStart: (e: React.DragEvent) => void;
	onDragOver: (e: React.DragEvent) => void;
	onDrop: (e: React.DragEvent) => void;
	onDragEnd: () => void;
};

/** Sub-component: single action row in the table */
export function ActionRow({
	action,
	index,
	isPastOriginalLimit,
	onToggleElationSkills,
	onToggleArcherArrows,
	dragProps,
}: {
	action: GeneratedAction;
	index: number;
	isPastOriginalLimit: boolean;
	onToggleElationSkills?: () => void;
	onToggleArcherArrows?: () => void;
	dragProps?: ActionRowDragProps;
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
	const exchangeGroupTheme = dragProps
		? exchangeGroupThemes[
				(dragProps.groupNumber - 1) % exchangeGroupThemes.length
			]
		: undefined;
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
		if (action.isElationSkill) {
			return isSelected
				? "bg-[#c2410c80] outline outline-1 outline-orange-300"
				: "bg-[#c2410c15] hover:bg-[#c2410c25]";
		}
		if (action.isFuaAction) {
			return isSelected
				? "bg-[#a21caf80] outline outline-1 outline-fuchsia-300"
				: "bg-[#86198f15] hover:bg-[#86198f25]";
		}
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
			data-exchange-group={dragProps?.groupNumber}
			draggable={dragProps?.draggable || undefined}
			onDragStart={dragProps?.draggable ? dragProps.onDragStart : undefined}
			onDragOver={dragProps?.onDragOver}
			onDrop={dragProps?.onDrop}
			onDragEnd={dragProps?.onDragEnd}
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
			className={`${dragProps?.draggable ? `cursor-grab ring-1 ring-inset ${exchangeGroupTheme?.ring}` : "cursor-pointer"} select-none ${rowClass} ${isPastOriginalLimit ? "border-l-2 border-l-cyan-400/70 opacity-80" : ""}`}
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
					<button
						type="button"
						className="flex h-full w-full items-center justify-center"
						title={
							action.hasElationSkills ? "点击折叠/展开欢愉技列表" : "阿哈时刻"
						}
						onClick={(event) => {
							event.stopPropagation();
							onToggleElationSkills?.();
						}}
						onMouseDown={(event) => event.stopPropagation()}
					>
						<img
							src={ahaIcon}
							alt="阿哈时刻"
							className="inline-block h-6 w-6"
						/>
					</button>
				) : action.hasArcherExtraEs ? (
					<button
						type="button"
						className="flex h-full w-full items-center justify-center gap-0.5"
						title="点击折叠/展开红A射箭列表"
						onClick={(event) => {
							event.stopPropagation();
							onToggleArcherArrows?.();
						}}
						onMouseDown={(event) => event.stopPropagation()}
					>
						<span className="font-mono text-xs font-bold text-amber-200">
							E
						</span>
						<span className="text-[10px] text-amber-300">⌄</span>
					</button>
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
				) : action.isFuaAction ? (
					<div className="flex h-full items-center justify-center">
						<span className="text-xs font-bold text-fuchsia-300">Z</span>
					</div>
				) : action.key.includes("-godmode-A") ? (
					<div className="flex h-full items-center justify-center">
						<img src={swRank2Icon} alt="E2" className="inline-block h-6 w-6" />
					</div>
				) : (
					index + 1
				)}
				{action.isRomanceAction && (
					<span className="text-yellow-300" title="浪漫之诗充能">
						⚡
					</span>
				)}
				{dragProps?.draggable && (
					<span
						role="img"
						aria-label={`可交换组 ${dragProps.groupNumber}`}
						className={`ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold ${exchangeGroupTheme?.marker}`}
						title="可与相同颜色的交换标记拖拽互换"
					>
						⇄
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
							{action.isFuaAction
								? "追击"
								: action.isGilgameshTechniqueAction
									? "秘技"
									: action.isArcherExtraE
										? `第 ${action.archerExtraEIndex} 箭`
										: action.isAhaInstant
											? action.isExtraAha
												? "额外"
												: "阿哈"
											: action.isElationSkill
												? "欢愉技"
												: action.isSparxieExtraAction
													? "额外"
													: isDomain
														? `境界 ${action.actionNo}`
														: isAssist
															? "助战"
															: action.isEveySelfDestructAction
																? "额外"
																: action.isMemeAdvanceAction
																	? `第 ${action.actionNo} 动`
																	: action.isMemospriteAction &&
																			action.actionNo > 0
																		? `第 ${action.actionNo} 动`
																		: action.isMemospriteAction
																			? "额外"
																			: action.isOdeExtraAction
																				? "诗篇"
																				: isInterrupt
																					? "插队"
																					: action.isAssistFollowUp
																						? `额外 ${action.actionNo}`
																						: action.key.includes(
																									"-break-extra-",
																								)
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
						!action.isSouldragonAction && <SkillInput action={action} />}
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
			{ctx.resources.map((resource) => {
				const storedValue = ctx.resourceValues[action.key]?.[resource];
				const isArcherFua = resource === archerFuaResourceName;
				const isGilgameshInterest = resource === gilgameshInterestResourceName;
				return (
					<td key={`${action.key}-resource-${resource}`} className="px-2 py-3">
						<input
							type="text"
							inputMode={
								isArcherFua || isGilgameshInterest ? "numeric" : undefined
							}
							value={
								storedValue ??
								(isArcherFua && action.archerFuaCharge !== undefined
									? String(action.archerFuaCharge)
									: isGilgameshInterest &&
											action.gilgameshInterest !== undefined
										? String(action.gilgameshInterest)
										: "")
							}
							onClick={(event) => event.stopPropagation()}
							onContextMenu={(event) => event.stopPropagation()}
							onChange={(event) => {
								const value = event.target.value;
								if (isArcherFua && value !== "" && !/^[0-4]$/.test(value))
									return;
								if (
									isGilgameshInterest &&
									value !== "" &&
									!/^\d*\.?\d*$/.test(value)
								)
									return;
								ctx.updateResourceValue(action.key, resource, value);
							}}
							className="h-10 w-full min-w-0 rounded-lg border border-gray-600 bg-gray-700 px-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
						/>
					</td>
				);
			})}
		</tr>
	);
}
