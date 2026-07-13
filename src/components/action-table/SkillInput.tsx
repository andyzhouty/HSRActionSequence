import { useState } from "react";
import ahaIcon from "../../assets/aha/aha.webp";
import { useActionSequence } from "../../contexts/ActionSequenceContext";
import type { GeneratedAction } from "../../utils/actionSequence";
import {
	getCounterWDomainRule,
	hasSemanticFlag,
} from "../../utils/actionSequence";

export function SkillInput({ action }: { action: GeneratedAction }) {
	const ctx = useActionSequence();
	const char = ctx.charactersById[action.characterId];
	const rawDisplaySkill =
		action.isDomainFinalAction ||
		action.isAssistFollowUp ||
		action.isCombustionAction
			? action.skill
			: (ctx.skillOverrides[action.key] ?? action.skill);
	const rawOverride = ctx.skillOverrides[action.key];
	const isComboOverride =
		!action.isDomainAction &&
		!action.isAssistFollowUp &&
		rawOverride &&
		/^(?:[AE]Q|Q[AE])$/.test(rawOverride);
	const displaySkill = isComboOverride
		? rawOverride.replace(/Q/g, "") || ""
		: rawDisplaySkill;
	const isDomain = action.isDomainAction;
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
				? `境界内可填写 ${getCounterWDomainRule(char.name).allowedSkills.filter(Boolean).join("、")}`
				: "境界内可填写 " +
					getCounterWDomainRule(char.name)
						.allowedSkills.filter((skill) => skill !== "EA" && skill !== "EW")
						.join("、");
	const skillTitle = action.isEpicTriggeredMemosprite
		? "记忆主史诗触发的德谬歌额外攻击"
		: action.isCyreneEnhancedQ
			? "昔涟强化Q触发的德谬歌额外回合"
			: isDomain
				? domainSkillTitle
				: action.isAglaeaSupremeAction
					? "至高之姿下可填写 A、AQ、Q"
					: nonDomainSkillTitle;
	const [draft, setDraft] = useState<string | null>(null);
	const commitDraftSkill = (rawSkill: string) => {
		const normalizedSkill = rawSkill.trim().toUpperCase();
		window.setTimeout(() => {
			if (normalizedSkill !== displaySkill || isComboOverride) {
				ctx.updateActionSkill(action, normalizedSkill);
			}
		}, 0);
	};

	if (action.isAhaInstant) {
		return (
			<div className="flex h-10 w-10 shrink-0 items-center justify-center">
				<img src={ahaIcon} alt="阿哈时刻" className="inline-block h-8 w-8" />
			</div>
		);
	}
	if (action.isDomainFinalAction) {
		return (
			<span
				title="境界最后一动，固定显示为 Q，不视为白厄再次释放大招"
				className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-lg border border-[#fbbf2499] bg-[#f59e0b33] font-mono text-sm font-black text-amber-100"
			>
				Q
			</span>
		);
	}
	const resolvedValue = draft ?? displaySkill;
	return (
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
			className={`h-10 shrink-0 select-text rounded-lg border px-1 text-center font-mono text-sm font-bold uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-45 ${isDomain ? "w-10 border-[#fbbf2499] bg-[#f59e0b33] text-amber-100" : action.isAglaeaSupremeAction ? "w-12 border-[#facc1599] bg-[#ca8a0433] text-yellow-100" : resolvedValue === "Q" && !isInterrupt ? "w-12 border-[#fbbf2499] bg-[#f59e0b33] text-amber-100" : "w-12 border-gray-600 bg-gray-700 text-gray-300"}`}
		/>
	);
}
