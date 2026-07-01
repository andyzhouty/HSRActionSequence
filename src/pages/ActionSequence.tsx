import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { domToPng } from "modern-screenshot";
import { useEffect, useMemo, useRef, useState } from "react";
import ActionPanel from "../components/action-sequence/ActionPanel";
import CharacterPanel from "../components/action-sequence/CharacterPanel";
import { ActionSequenceCtx } from "../contexts/ActionSequenceContext";
import {
	type CharacterConfig,
	canUseSkillCode,
	createTarget,
	defaultCharacters,
	defaultResources,
	ensureFileExtension,
	formatEditableNumber,
	type GeneratedAction,
	getCharacterCid,
	getCounterWDomainRule,
	getCyreneUltimateRule,
	getDefaultSkill,
	getErrorMessage,
	getFireflyCombustionRule,
	getGarmentmakerRule,
	getMemeAdvanceRule,
	getSkillEffectOwnerNames,
	getTargetDefaultName,
	getTimestampedFileName,
	hasSemanticFlag,
	hasSkillEffect,
	isAllyTarget,
	isCharacterTarget,
	limitPresets,
	maxResources,
	type OdeSelection,
	type SavedData,
	type SkillCode,
	type SpeedAdjustment,
	type SpeedChangeMode,
	shouldRememberSkillTarget,
	type TargetKind,
	targetKinds,
	toPositiveNumber,
	toSignedNumber,
	type UltInterrupt,
	withoutCharacterOnlyEffects,
} from "../utils/actionSequence";
import { simulateActions } from "../utils/simulateActions";

function getSavedDisplayedLimitFallback(parsed: Partial<SavedData>) {
	const savedPreset =
		parsed.limitPreset && limitPresets.includes(parsed.limitPreset)
			? parsed.limitPreset
			: "150";
	const savedCustomLimit = String(parsed.customLimit ?? "");
	const savedActionLimit =
		savedPreset === "自定义"
			? toPositiveNumber(savedCustomLimit, 150)
			: toPositiveNumber(savedPreset, 150);
	return formatEditableNumber(savedActionLimit + 100);
}

function getSavedDisplayedActionLimit(parsed: Partial<SavedData>) {
	const fallback = toPositiveNumber(
		getSavedDisplayedLimitFallback(parsed),
		250,
	);
	const savedDisplayedLimit = toPositiveNumber(
		String(parsed.displayedLimit ?? ""),
		fallback,
	);
	return Math.max(fallback - 100, savedDisplayedLimit);
}

function clampOverridesToDisplayedLimit(
	overrides: Record<string, string> | undefined,
	displayedLimit: number,
) {
	if (!overrides) return {};
	return Object.fromEntries(
		Object.entries(overrides).map(([key, value]) => {
			const parsed = Number.parseFloat(value);
			if (!Number.isFinite(parsed)) return [key, value];
			return [key, formatEditableNumber(Math.min(parsed, displayedLimit))];
		}),
	);
}

function pruneRecord<T>(
	record: Record<string, T>,
	shouldPrune: (key: string) => boolean,
) {
	let changed = false;
	const next: Record<string, T> = {};
	for (const [key, value] of Object.entries(record)) {
		if (shouldPrune(key)) {
			changed = true;
			continue;
		}
		next[key] = value;
	}
	return changed ? next : record;
}

export default function ActionSequence() {
	const [characters, setCharacters] =
		useState<CharacterConfig[]>(defaultCharacters);
	const [limitPreset, setLimitPreset] = useState("150");
	const [customLimit, setCustomLimit] = useState("");
	const [displayedLimit, setDisplayedLimit] = useState("250");
	const [resources, setResources] = useState<string[]>(defaultResources);
	const [overrides, setOverrides] = useState<Record<string, string>>({});
	const [ultOverrides, setUltOverrides] = useState<Record<string, boolean>>({});
	const [skillOverrides, setSkillOverrides] = useState<
		Record<string, SkillCode>
	>({});
	const [domainEndOverrides, setDomainEndOverrides] = useState<
		Record<string, boolean>
	>({});
	const [speedAdjustments, setSpeedAdjustments] = useState<
		Record<string, SpeedAdjustment>
	>({});
	const [selectedActionKeys, setSelectedActionKeys] = useState<Set<string>>(
		() => new Set(),
	);
	const [actionMenuOpen, setActionMenuOpen] = useState(false);
	const [actionMenuKey, setActionMenuKey] = useState<string | null>(null);
	const [actionMenuPos, setActionMenuPos] = useState<number>(0);
	const [actionOperation, setActionOperation] = useState<"advance" | "speed">(
		"advance",
	);
	const [operationValue, setOperationValue] = useState("");
	const [advanceCeiling, setAdvanceCeiling] = useState("");
	const [operationSpeedMode, setOperationSpeedMode] =
		useState<SpeedChangeMode>("absolute");
	const [resourceValues, setResourceValues] = useState<
		Record<string, Record<string, string>>
	>({});
	const [skillTargets, setSkillTargets] = useState<Record<string, string>>({});
	const [defaultSkillTargets, setDefaultSkillTargets] = useState<
		Record<string, string>
	>({});
	const [odeSelections, setOdeSelections] = useState<
		Record<string, OdeSelection>
	>({});
	const [memeSelections, setMemeSelections] = useState<Record<string, string>>(
		{},
	);
	const [lastMemeTarget, setLastMemeTarget] = useState<string>("");
	const [fireflyBreakCounters, setFireflyBreakCounters] = useState<
		Record<string, boolean>
	>({});
	const [godmodeExtraActions, setGodmodeExtraActions] = useState<
		Record<string, boolean>
	>({});
	const [castoriceKillToggles, setCastoriceKillToggles] = useState<
		Record<string, boolean>
	>({});
	const [icaKillToggles, setIcaKillToggles] = useState<
		Record<string, boolean>
	>({});
	const [hyacineE2Active, setHyacineE2Active] = useState(true);
	const [meritTarget, setMeritTarget] = useState<string | undefined>();
	const [dancePartner, setDancePartner] = useState<string | undefined>();
	const [ultInterrupts, setUltInterrupts] = useState<
		Record<string, UltInterrupt[]>
	>({});
	const [draftInterruptCaster, setDraftInterruptCaster] = useState("");
	const [draftInterruptTiming, setDraftInterruptTiming] = useState<
		"before" | "after"
	>("before");
	const [actions, setActions] = useState<GeneratedAction[]>([]);
	const [importText, setImportText] = useState("");
	const [message, setMessage] = useState("");
	const [isExportingImage, setIsExportingImage] = useState(false);
	const imageExportRef = useRef<HTMLDivElement>(null);
	const autosavePathRef = useRef<string | null>(null);
	const autosaveTimerRef = useRef<number | null>(null);
	const seenBreakExtraKeysRef = useRef<Set<string>>(new Set());

	const actionLimit = useMemo(() => {
		if (limitPreset === "自定义") {
			return toPositiveNumber(customLimit, 150);
		}
		return toPositiveNumber(limitPreset, 150);
	}, [customLimit, limitPreset]);
	const displayedLimitDefault = actionLimit + 100;
	const displayedActionLimit = Math.max(
		actionLimit,
		toPositiveNumber(displayedLimit, displayedLimitDefault),
	);
	const previousActionLimitRef = useRef(actionLimit);

	useEffect(() => {
		const previousDefault = previousActionLimitRef.current + 100;
		previousActionLimitRef.current = actionLimit;
		setDisplayedLimit((prev) => {
			const parsed = toPositiveNumber(prev, Number.NaN);
			if (prev === "" || parsed === previousDefault) {
				return formatEditableNumber(displayedLimitDefault);
			}
			return prev;
		});
	}, [actionLimit, displayedLimitDefault]);

	useEffect(() => {
		setOverrides((prev) => {
			let changed = false;
			const next = Object.fromEntries(
				Object.entries(prev).map(([key, value]) => {
					const parsed = Number.parseFloat(value);
					if (!Number.isFinite(parsed) || parsed <= displayedActionLimit) {
						return [key, value];
					}
					changed = true;
					return [key, formatEditableNumber(displayedActionLimit)];
				}),
			);
			return changed ? next : prev;
		});
	}, [displayedActionLimit]);

	useEffect(() => {
		const counterWCharacter = characters.find((character) =>
			hasSkillEffect(character.name, "W", "counterW"),
		);
		const cyreneCharacter = characters.find((character) =>
			hasSkillEffect(character.name, "Q", "cyreneUltimate"),
		);
		const silverWolfCharacter = characters.find((character) =>
			hasSkillEffect(character.name, "Q", "selfAdvance100"),
		);
		const isUsingDefaultResources =
			resources.length === defaultResources.length &&
			resources.every(
				(resource, index) => resource === defaultResources[index],
			);
		const cyreneDefaultResources = cyreneCharacter
			? getCyreneUltimateRule(cyreneCharacter.name).defaultResources
			: [];
		const counterWDefaultResources = counterWCharacter
			? getCounterWDomainRule(counterWCharacter.name).defaultResources
			: [];
		const silverWolfResources = silverWolfCharacter ? ["隐藏分"] : [];
		const nextResources = isUsingDefaultResources
			? Array.from(
					new Set([
						...silverWolfResources,
						...cyreneDefaultResources,
						...counterWDefaultResources,
					]),
				)
			: [...resources];
		if (isUsingDefaultResources && nextResources.length === 0) return;
		if (silverWolfCharacter) {
			for (const resource of silverWolfResources) {
				if (
					nextResources.length < maxResources &&
					!nextResources.includes(resource)
				) {
					nextResources.push(resource);
				}
			}
		}
		if (cyreneCharacter) {
			for (const resource of cyreneDefaultResources) {
				if (
					nextResources.length < maxResources &&
					!nextResources.includes(resource)
				) {
					nextResources.push(resource);
				}
			}
		}
		if (
			nextResources.length === resources.length &&
			nextResources.every((resource, index) => resource === resources[index])
		) {
			return;
		}
		setResources(nextResources);
	}, [characters, resources]);

	// 启动时自动加载上次保存的状态
	useEffect(() => {
		let cancelled = false;

		void (async () => {
			try {
				const autosavePath = await invoke<string>("get_autosave_path");
				autosavePathRef.current = autosavePath;

				const text = await invoke<string>("read_text_file", {
					path: autosavePath,
				});
				if (cancelled) return;
				if (!text.trim()) return;

				const parsed = JSON.parse(text) as Partial<SavedData>;
				if (!Array.isArray(parsed.characters)) return;
				if (parsed.characters.length === 0) return;
				const savedDisplayedActionLimit = getSavedDisplayedActionLimit(parsed);

				// 导入状态
				setCharacters(
					parsed.characters.map((character, index) =>
						withoutCharacterOnlyEffects({
							...createTarget(
								String(character.id ?? `autoload-${index + 1}`),
								index,
								(targetKinds.includes(character.kind as TargetKind)
									? character.kind
									: "角色") as TargetKind,
							),
							...character,
							id: String(character.id ?? `autoload-${index + 1}`),
							kind: (targetKinds.includes(character.kind as TargetKind)
								? character.kind
								: "角色") as TargetKind,
							name: String(character.name ?? ""),
							speed: String(character.speed ?? ""),
							baseSpeed: String(character.baseSpeed ?? ""),
						}),
					),
				);
				setLimitPreset(
					parsed.limitPreset && limitPresets.includes(parsed.limitPreset)
						? parsed.limitPreset
						: "150",
				);
				setCustomLimit(String(parsed.customLimit ?? ""));
				setDisplayedLimit(
					String(
						parsed.displayedLimit ?? getSavedDisplayedLimitFallback(parsed),
					),
				);
				setResources(
					Array.isArray(parsed.resources)
						? parsed.resources.slice(0, maxResources).map(String)
						: [],
				);
				setOverrides(
					clampOverridesToDisplayedLimit(
						parsed.overrides,
						savedDisplayedActionLimit,
					),
				);
				setUltOverrides(parsed.ultOverrides ?? {});
				setSkillOverrides(parsed.skillOverrides ?? {});
				setDomainEndOverrides(parsed.domainEndOverrides ?? {});
				setSkillTargets(parsed.skillTargets ?? {});
				setDefaultSkillTargets(parsed.defaultSkillTargets ?? {});
				setOdeSelections(parsed.odeSelections ?? {});
				setMemeSelections(parsed.memeSelections ?? {});
				setUltInterrupts(parsed.ultInterrupts ?? {});
				setSpeedAdjustments(parsed.speedAdjustments ?? {});
				setResourceValues(parsed.resourceValues ?? {});
				setFireflyBreakCounters(parsed.fireflyBreakCounters ?? {});
				setGodmodeExtraActions(parsed.godmodeExtraActions ?? {});
				setCastoriceKillToggles(parsed.castoriceKillToggles ?? {});
				setMeritTarget(parsed.meritTarget || undefined);
				setDancePartner(parsed.dancePartner || undefined);
				setMessage("已自动恢复上次的排轴数据");
			} catch {
				// 首次使用或无上次保存数据，静默忽略
			}
		})();

		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		try {
			const nextActions = simulateActions({
				characters,
				limit: displayedActionLimit,
				overrides,
				skillOverrides,
				domainEndOverrides,
				legacyUltOverrides: ultOverrides,
				speedAdjustments,
				skillTargets,
				defaultSkillTargets,
				odeSelections,
				memeSelections,
				ultInterrupts,
				fireflyBreakCounters,
				godmodeExtraActions,
				castoriceKillToggles,
				icaKillToggles,
				hyacineE2Active,
				meritTarget,
				dancePartner,
			});
			setActions(nextActions);
		} catch (error) {
			setActions([]);
			setMessage(`行动轴计算失败：${getErrorMessage(error)}`);
		}
	}, [
		characters,
		displayedActionLimit,
		overrides,
		skillOverrides,
		domainEndOverrides,
		ultOverrides,
		speedAdjustments,
		skillTargets,
		defaultSkillTargets,
		odeSelections,
		memeSelections,
		ultInterrupts,
		fireflyBreakCounters,
		godmodeExtraActions,
		castoriceKillToggles,
		icaKillToggles,
		hyacineE2Active,
		meritTarget,
		dancePartner,
	]);

	useEffect(() => {
		const actionKeys = new Set(actions.map((action) => action.key));
		const isStaleAglaeaCountdownKey = (key: string) =>
			key.includes("-aglaea-countdown-") && !actionKeys.has(key);

		setOverrides((prev) => pruneRecord(prev, isStaleAglaeaCountdownKey));
		setSpeedAdjustments((prev) => pruneRecord(prev, isStaleAglaeaCountdownKey));
		setResourceValues((prev) => pruneRecord(prev, isStaleAglaeaCountdownKey));
		setSelectedActionKeys((prev) => {
			let changed = false;
			const next = new Set<string>();
			for (const key of prev) {
				if (isStaleAglaeaCountdownKey(key)) {
					changed = true;
					continue;
				}
				next.add(key);
			}
			return changed ? next : prev;
		});
		// 流萤 E2：额外回合的击破开关默认 ON（延后倒计时）
		// seenBreakExtraKeysRef 记录"曾被自动设 ON"的 key，用户关 OFF 后不再自动恢复
		setFireflyBreakCounters((prev) => {
			let changed = false;
			const next = { ...prev };
			// 清理已不存在的行动 key
			for (const key of Object.keys(next)) {
				if (!actionKeys.has(key)) {
					delete next[key];
					changed = true;
				}
			}
			// 额外回合（-break-extra-N，末尾为数字）默认 ON
			for (const key of actionKeys) {
				if (
					/break-extra-\d+$/.test(key) &&
					!(key in next) &&
					!seenBreakExtraKeysRef.current.has(key)
				) {
					next[key] = true;
					changed = true;
				}
			}
			// 同步 ref：记录所有已存在的相关 key（含从存档恢复的）
			for (const key of Object.keys(next)) {
				if (key.includes("-break-extra-")) {
					seenBreakExtraKeysRef.current.add(key);
				}
			}
			// 只保留当前存在的 key
			for (const key of seenBreakExtraKeysRef.current) {
				if (!actionKeys.has(key)) {
					seenBreakExtraKeysRef.current.delete(key);
				}
			}
			return changed ? next : prev;
		});
		// 清理已不存在的 kill toggle key
		setCastoriceKillToggles((prev) => {
			let changed = false;
			const next = { ...prev };
			for (const key of Object.keys(next)) {
				if (!actionKeys.has(key)) {
					delete next[key];
					changed = true;
				}
			}
			return changed ? next : prev;
		});
	}, [actions]);

	// 状态变化时自动保存（防抖 800ms）
	useEffect(() => {
		if (autosaveTimerRef.current !== null) {
			window.clearTimeout(autosaveTimerRef.current);
		}
		if (autosavePathRef.current === null) return;

		autosaveTimerRef.current = window.setTimeout(() => {
			const path = autosavePathRef.current;
			if (!path) return;

			const data: SavedData = {
				limitPreset,
				customLimit,
				displayedLimit,
				characters: characters.map(withoutCharacterOnlyEffects),
				resources,
				overrides,
				skillOverrides,
				domainEndOverrides,
				speedAdjustments,
				skillTargets,
				defaultSkillTargets,
				odeSelections,
				memeSelections,
				ultInterrupts,
				resourceValues,
				fireflyBreakCounters,
				godmodeExtraActions,
				castoriceKillToggles,
				meritTarget,
				dancePartner,
			};

			invoke("write_text_file", {
				path,
				contents: JSON.stringify(data, null, 2),
			}).catch(() => {
				// 自动保存失败不影响用户操作
			});
		}, 800);

		return () => {
			if (autosaveTimerRef.current !== null) {
				window.clearTimeout(autosaveTimerRef.current);
			}
		};
	}, [
		characters,
		limitPreset,
		customLimit,
		displayedLimit,
		resources,
		overrides,
		skillOverrides,
		domainEndOverrides,
		speedAdjustments,
		skillTargets,
		defaultSkillTargets,
		odeSelections,
		memeSelections,
		ultInterrupts,
		resourceValues,
		fireflyBreakCounters,
		godmodeExtraActions,
		castoriceKillToggles,
	]);

	const characterNames = useMemo(
		() =>
			Object.fromEntries(
				characters.map((character, index) => [
					character.id,
					character.name.trim() || getTargetDefaultName(character.kind, index),
				]),
			),
		[characters],
	);
	const memospriteTargets = useMemo(
		() =>
			characters.flatMap((c) => {
				const memos: CharacterConfig[] = [];
				if (hasSkillEffect(c.name, "E", "summonGarmentmaker")) {
					const rule = getGarmentmakerRule(c.name);
					memos.push({
						...c,
						id: `${c.id}-garmentmaker`,
						kind: "忆灵",
						name: rule.memospriteName,
						speed: String(rule.memospriteSpeed),
						baseSpeed: String(rule.memospriteSpeed),
						hasVonwacq: false,
						hasWindSet: false,
						hasDance: false,
						eidolon: 0,
						superimpose: 1,
						lc_id: 0,
					});
				}
				if (hasSkillEffect(c.name, "E", "summonMeme")) {
					const rule = getMemeAdvanceRule(c.name);
					memos.push({
						...c,
						id: `${c.id}-meme`,
						kind: "忆灵",
						name: rule.memospriteName,
						speed: String(rule.memospriteSpeed),
						baseSpeed: String(rule.memospriteSpeed),
						hasVonwacq: false,
						hasWindSet: false,
						hasDance: false,
						eidolon: 0,
						superimpose: 1,
						lc_id: 0,
					});
				}
				if (hasSkillEffect(c.name, "Q", "cyreneUltimate")) {
					const rule = getCyreneUltimateRule(c.name);
					memos.push({
						...c,
						id: `${c.id}-memosprite`,
						kind: "忆灵",
						name: rule.memospriteName,
						speed: "0",
						baseSpeed: "0",
						hasVonwacq: false,
						hasWindSet: false,
						hasDance: false,
						eidolon: 0,
						superimpose: 1,
						lc_id: 0,
					});
				}
				if (hasSkillEffect(c.name, "E", "summonIca")) {
					memos.push({
						...c,
						id: `${c.id}-ica`,
						kind: "忆灵",
						name: "小伊卡",
						speed: "0",
						baseSpeed: "0",
						hasVonwacq: false,
						hasWindSet: false,
						hasDance: false,
						eidolon: 0,
						superimpose: 1,
						lc_id: 0,
					});
				}
				return memos;
			}),
		[characters],
	);

	const characterKinds = useMemo(
		() =>
			Object.fromEntries([
				...characters.map((character) => [character.id, character.kind] as const),
				...memospriteTargets.map((m) => [m.id, m.kind] as const),
			]),
		[characters, memospriteTargets],
	);

	const charactersById = useMemo(
		() =>
			Object.fromEntries(
				characters.map((character) => [character.id, character]),
			),
		[characters],
	);

	const updateCharacter = (
		id: string,
		updater: (character: CharacterConfig) => CharacterConfig,
	) => {
		setCharacters((prev) =>
			prev.map((character) =>
				character.id === id ? updater(character) : character,
			),
		);
	};

	const addTarget = () => {
		setCharacters((prev) => [
			...prev,
			createTarget(`target-${Date.now()}`, prev.length),
		]);
	};

	const removeTarget = (id: string) => {
		if (characters.length <= 1) return;
		setCharacters((prev) =>
			prev.length <= 1 ? prev : prev.filter((character) => character.id !== id),
		);
		setOverrides((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setUltOverrides((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setSkillOverrides((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setDomainEndOverrides((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setSpeedAdjustments((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setSkillTargets((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setDefaultSkillTargets((prev) => {
			const next = { ...prev };
			delete next[id];
			for (const [casterId, targetId] of Object.entries(next)) {
				if (targetId === id) delete next[casterId];
			}
			return next;
		});
		setOdeSelections((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey, selection]) =>
						!actionKey.startsWith(`${id}-`) && selection.targetId !== id,
				),
			),
		);
		setMemeSelections((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey, targetId]) =>
						!actionKey.startsWith(`${id}-`) && targetId !== id,
				),
			),
		);
		setUltInterrupts((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setResourceValues((prev) =>
			Object.fromEntries(
				Object.entries(prev).filter(
					([actionKey]) => !actionKey.startsWith(`${id}-`),
				),
			),
		);
		setSelectedActionKeys((prev) => {
			const next = new Set(
				[...prev].filter((actionKey) => !actionKey.startsWith(`${id}-`)),
			);
			return next;
		});
		if (meritTarget === id) setMeritTarget(undefined);
		if (dancePartner === id) setDancePartner(undefined);
		closeActionMenu();
	};

	const updateResourceValue = (
		actionKey: string,
		resourceName: string,
		value: string,
	) => {
		setResourceValues((prev) => ({
			...prev,
			[actionKey]: {
				...(prev[actionKey] ?? {}),
				[resourceName]: value,
			},
		}));
	};

	const cancelHimekoNovaAssist = (action: GeneratedAction) => {
		const sourceKey = action.assistSourceKey ?? action.key;
		const assistIndex = action.assistIndex ?? 1;
		setSkillOverrides((prev) => {
			const currentSkill = prev[sourceKey] ?? "";
			if (!currentSkill.includes("F")) return prev;
			const next = { ...prev };
			const baseSkill = currentSkill.replace(/F/g, "");
			const restoredSkill =
				assistIndex >= 2 ? (`F${baseSkill}` as SkillCode) : baseSkill;
			if (restoredSkill === "") delete next[sourceKey];
			else next[sourceKey] = restoredSkill;
			return next;
		});
		setMessage(
			assistIndex >= 2
				? "已取消第二个姬子·启行助战技，恢复额外回合"
				: "已取消姬子·启行助战技，恢复原回合",
		);
	};

	const updateSkillTarget = (action: GeneratedAction, targetId: string) => {
		const character = charactersById[action.characterId];
		setSkillTargets((prev) => {
			const next = { ...prev };
			if (targetId === "") delete next[action.key];
			else next[action.key] = targetId;
			return next;
		});
		if (!character || !shouldRememberSkillTarget(character.name)) return;
		setDefaultSkillTargets((prev) => {
			const next = { ...prev };
			if (targetId === "") delete next[action.characterId];
			else next[action.characterId] = targetId;
			return next;
		});
	};

	const updateActionSkill = (action: GeneratedAction, value: string) => {
		const character = charactersById[action.characterId];
		if (!character) return;
		const nextSkill = value.trim().toUpperCase() as SkillCode;
		// 完全燃烧状态下允许单个 A/E 或 EE（EE 自动拆分为两动 E）
		if (action.isCombustionAction) {
			const chars = nextSkill.replace(/F/g, "");
			const combustionRule = getFireflyCombustionRule(character.name);
			const allowed = new Set(combustionRule.allowedSkills);
			if (![...chars].every((c) => allowed.has(c))) {
				setMessage(
					`完全燃烧状态下只能填写 ${combustionRule.allowedSkills
						.filter(Boolean)
						.join("、")}`,
				);
				return;
			}
		}

		if (action.isDomainFinalAction) return;
		const savedSkill = action.isAssistFollowUp
			? ((nextSkill.includes("F")
					? "FF"
					: `F${nextSkill.replace(/F/g, "")}`) as SkillCode)
			: nextSkill;
		const domainRule = getCounterWDomainRule(character.name);
		const allowedDomainSkills = new Set(domainRule.allowedSkills);
		if (action.isAglaeaSupremeAction && nextSkill === "Q") {
			setMessage("Q 不能单独使用，请配合 A/E 使用（如 AQ、EQ）");
			return;
		}
		if (action.isDomainAction && !allowedDomainSkills.has(nextSkill)) {
			setMessage(
				`白厄境界内只能填写 ${domainRule.allowedSkills
					.filter(Boolean)
					.join("、")}`,
			);
			return;
		}
		if (
			action.isDomainAction &&
			character.eidolon < 2 &&
			(nextSkill === "EA" || nextSkill === "EW")
		) {
			setMessage(
				"白厄 2 魂解锁 EA（强化普攻）和 EW（强化反击），当前未勾选 2 魂",
			);
			return;
		}
		if (
			!action.isDomainAction &&
			!action.isAssistFollowUp &&
			nextSkill.includes("F")
		) {
			const hasHimekoNovaAssist = characters.some((c) =>
				hasSkillEffect(c.name, "F", "himekoNovaAssist"),
			);
			if (!hasHimekoNovaAssist) {
				const ownerNames =
					getSkillEffectOwnerNames("F", "himekoNovaAssist").join("、") ||
					"对应角色";
				setMessage(`队伍中需要有 ${ownerNames} 才能填写 F`);
				return;
			}
			if (hasSkillEffect(character.name, "F", "himekoNovaAssist")) {
				setMessage("F 只能在姬子·启行以外的队友回合填写");
				return;
			}
			if (!isAllyTarget(character.kind)) {
				setMessage("F 只能在我方队友回合填写");
				return;
			}
			// E0/E1 sp姬子：非白名单角色不可用 FF 连招
			const novaChar = characters.find((c) =>
				hasSkillEffect(c.name, "F", "himekoNovaAssist"),
			);
			if (novaChar && novaChar.eidolon < 2) {
				const novaFFCidWhitelist = new Set([
					"1002", "1414", // 丹恒, 丹恒·腾荒
					"1001", "1224", // 三月七, 三月七·巡猎
					"1413", // 长夜月
					"1004", // 瓦尔特
					"8002", "8004", "8006", "8008", "8010", // 开拓者
					"1313", // 星期日
					"1003", // 姬子
				]);
				const characterCid = getCharacterCid(character.name);
				const isNovaFFWhitelisted =
					characterCid !== undefined && novaFFCidWhitelist.has(characterCid);
				if (
					!isNovaFFWhitelisted &&
					(nextSkill.match(/F/g)?.length ?? 0) >= 2
				) {
					setMessage("当前 sp 姬子未达 2 魂，此角色不可使用 FF 连招");
					return;
				}
			}
		}
		if (!action.isDomainAction && !canUseSkillCode(character, nextSkill)) {
			if (nextSkill.includes("A") && nextSkill.includes("E")) {
				setMessage("A（普攻）和 E（战技）不能组合");
			} else if (
				nextSkill.includes("W") &&
				hasSkillEffect(character.name, "W", "counterW") &&
				hasSemanticFlag(character.name, "wOnlyInDomain")
			) {
				setMessage("W 只能在境界内填写");
			} else if (
				nextSkill.includes("W") &&
				!hasSkillEffect(character.name, "W", "counterW")
			) {
				const ownerNames =
					getSkillEffectOwnerNames("W", "counterW").join("、") || "对应角色";
				setMessage(`只有 ${ownerNames} 可以填写 W`);
			} else if (!isCharacterTarget(character)) {
				setMessage("只有角色可以填写技能");
			}
			return;
		}

		setSkillOverrides((prev) => {
			const next = { ...prev };
			const defaultSkill = action.isDomainAction
				? ""
				: getDefaultSkill(character, action.actionNo);
			if (!action.isAssistFollowUp && nextSkill === defaultSkill) {
				delete next[action.key];
			} else {
				next[action.key] = savedSkill;
			}
			return next;
		});
		setUltOverrides((prev) => {
			const next = { ...prev };
			delete next[action.key];
			return next;
		});
		// 技能不再是 E 时，清理技能目标
		if (!nextSkill.includes("E")) {
			setSkillTargets((prev) => {
				const next = { ...prev };
				delete next[action.key];
				return next;
			});
		}
	};

	const selectAction = (actionKey: string, additive: boolean) => {
		setSelectedActionKeys((prev) => {
			if (!additive) {
				if (prev.size === 1 && prev.has(actionKey)) return new Set();
				return new Set([actionKey]);
			}
			const next = new Set(prev);
			if (next.has(actionKey)) {
				next.delete(actionKey);
			} else {
				next.add(actionKey);
			}
			return next;
		});
	};

	const openActionMenu = (
		actionKey: string,
		additive: boolean,
		clientY: number,
	) => {
		if (actionMenuOpen && actionMenuKey === actionKey && !additive) {
			closeActionMenu();
			return;
		}
		setSelectedActionKeys((prev) => {
			if (prev.has(actionKey) && !additive) return prev;
			if (!additive) return new Set([actionKey]);
			const next = new Set(prev);
			next.add(actionKey);
			return next;
		});
		setActionMenuKey(actionKey);
		setActionMenuPos(clientY);
		setActionMenuOpen(true);
	};

	const closeActionMenu = () => {
		setActionMenuOpen(false);
		setActionMenuKey(null);
		setAdvanceCeiling("");
	};

	const getPhainonDomainEquivalentSpeed = (action: GeneratedAction) => {
		const character = charactersById[action.characterId];
		if (!character) return action.speed;
		const domainRule = getCounterWDomainRule(character.name);
		const baseSpeed =
			toPositiveNumber(character.baseSpeed, 0) > 0
				? toPositiveNumber(character.baseSpeed, action.speed)
				: domainRule.defaultBaseSpeed;
		const coeff =
			character.eidolon >= 1
				? domainRule.eidolon1EquivalentSpeedCoefficient
				: domainRule.normalEquivalentSpeedCoefficient;
		return baseSpeed * coeff;
	};

	const getPreviousDomainActionValue = (action: GeneratedAction) => {
		const match = action.key.match(/^(.*-domain-)(\d+)$/);
		if (!match) return action.actionValue;
		const previousIndex = Number.parseInt(match[2], 10) - 1;
		if (!Number.isFinite(previousIndex) || previousIndex < 0) {
			return action.actionValue;
		}
		const previousAction = actions.find(
			(candidate) => candidate.key === `${match[1]}${previousIndex}`,
		);
		return previousAction?.actionValue ?? action.actionValue;
	};

	const getAdvancedActionValue = (
		action: GeneratedAction,
		value: number,
		actionSpeed: number,
	) => {
		if (action.isDomainAction && value > 0) {
			const lowerBound = getPreviousDomainActionValue(action);
			const remainingActionValue = Math.max(0, action.actionValue - lowerBound);
			const shifted =
				action.actionValue -
				(remainingActionValue * Math.min(value, 100)) / 100;
			return Math.max(lowerBound, shifted);
		}
		if (value > 0) {
			return action.actionValue * (1 - value / 100);
		}
		return action.actionValue - (value * 100) / actionSpeed;
	};

	const applyActionOperation = () => {
		const selectedActions = actions.filter((action) =>
			selectedActionKeys.has(action.key),
		);
		if (selectedActions.length === 0) {
			setMessage("请先选中至少一条行动");
			return;
		}

		const value = toSignedNumber(operationValue, Number.NaN);
		if (!Number.isFinite(value)) {
			setMessage("请输入有效数值");
			return;
		}

		if (actionOperation === "advance") {
			// 计算上限 AV：若用户填写了序号上限，取其行动值作为提前上限
			const ceilingIndex = Number.parseInt(advanceCeiling, 10);
			const ceilingAV =
				advanceCeiling !== "" &&
				Number.isFinite(ceilingIndex) &&
				ceilingIndex >= 1
					? (actions[ceilingIndex - 1]?.actionValue ?? 0)
					: 0;

			setOverrides((prev) => {
				const next = { ...prev };
				for (const action of selectedActions) {
					if (action.isDomainAction && value <= 0) continue;
					const actionSpeed = action.isDomainAction
						? getPhainonDomainEquivalentSpeed(action)
						: action.speed;
					next[action.key] = formatEditableNumber(
						Math.min(
							displayedActionLimit,
							Math.max(
								ceilingAV,
								getAdvancedActionValue(action, value, actionSpeed),
							),
						),
					);
				}
				return next;
			});
			setMessage(
				`已调整 ${selectedActions.length} 条行动的行动值，超出显示上限的结果已自动贴边`,
			);
		} else {
			const missingBaseSpeed = selectedActions.some((action) => {
				const character = charactersById[action.characterId];
				return (
					operationSpeedMode === "relative" &&
					character !== undefined &&
					toPositiveNumber(character.baseSpeed) <= 0
				);
			});
			if (missingBaseSpeed) {
				setMessage("相对变速需要为选中的目标填写基础速度 v₀");
				return;
			}

			setSpeedAdjustments((prev) => {
				const next = { ...prev };
				for (const action of selectedActions) {
					next[action.key] = {
						value: operationValue,
						mode: operationSpeedMode,
					};
				}
				return next;
			});
			setMessage(`已为 ${selectedActions.length} 条行动设置后续变速`);
		}

		closeActionMenu();
	};

	const addResource = () => {
		if (resources.length >= maxResources) return;
		setResources((prev) => [...prev, `资源 ${prev.length + 1}`]);
	};

	const updateResource = (index: number, value: string) => {
		setResources((prev) =>
			prev.map((resource, resourceIndex) =>
				resourceIndex === index ? value : resource,
			),
		);
	};

	const removeResource = (index: number) => {
		const removedName = resources[index];
		setResources((prev) =>
			prev.filter((_, resourceIndex) => resourceIndex !== index),
		);
		setResourceValues((prev) => {
			const next = { ...prev };
			for (const actionKey of Object.keys(next)) {
				const values = { ...next[actionKey] };
				delete values[removedName];
				next[actionKey] = values;
			}
			return next;
		});
	};

	const buildExportData = (): SavedData => ({
		limitPreset,
		customLimit,
		displayedLimit,
		characters: characters.map(withoutCharacterOnlyEffects),
		resources,
		overrides,
		skillOverrides,
		domainEndOverrides,
		speedAdjustments,
		skillTargets,
		defaultSkillTargets,
		odeSelections,
		memeSelections,
		ultInterrupts,
		resourceValues,
		fireflyBreakCounters,
		godmodeExtraActions,
		castoriceKillToggles,
		meritTarget,
		dancePartner,
	});

	const exportJson = async () => {
		const json = JSON.stringify(buildExportData(), null, 2);

		try {
			const selectedPath = await save({
				title: "导出 JSON",
				defaultPath: getTimestampedFileName("action-sequence", ".json"),
				filters: [
					{
						name: "JSON",
						extensions: ["json"],
					},
				],
			});
			if (!selectedPath) {
				setMessage("已取消导出 JSON");
				return;
			}

			const filePath = ensureFileExtension(selectedPath, ".json");
			await invoke("write_text_file", {
				path: filePath,
				contents: json,
			});
			setImportText(json);
			setMessage(`已导出 JSON 文件：${filePath}`);
		} catch (error) {
			setMessage(`JSON 导出失败：${getErrorMessage(error)}`);
		}
	};

	const exportImage = async () => {
		if (!imageExportRef.current) return;
		if (actions.length > 100) {
			setMessage("当前行动数超过 100，已锁定图片导出以避免图片过大");
			return;
		}

		try {
			setIsExportingImage(true);
			setMessage("正在生成行动序列图片...");

			const target = imageExportRef.current;
			const exportPadding = 32;
			// 清理 oklab/oklch 的正则，避免 modern-screenshot 解析失败
			const cleanColor = (css: string) =>
				css.replace(/oklch\([^)]*\)|oklab\([^)]*\)/gi, "rgba(0,0,0,0)");
			// 计算紧凑的导出宽度：固定列 + 资源列均分
			const fixedColWidth = 48 + 100 + 112 + 112; // 序号(48) + 角色(100) + 行动值(112) + 技能(112)
			const resourceColWidth =
				resources.length > 0
					? Math.min(Math.floor(640 / resources.length), 100)
					: 0;
			const compactWidth = fixedColWidth + resourceColWidth * resources.length;
			const dataUrl = await domToPng(target, {
				backgroundColor: "#1f2937",
				scale: Math.min(window.devicePixelRatio || 1, 2),
				width: Math.min(target.scrollWidth, compactWidth),
				height: target.scrollHeight + exportPadding,
				style: {
					boxSizing: "border-box",
					paddingBottom: `${exportPadding}px`,
					overflowX: "hidden",
				},
				onCloneNode: (cloned) => {
					if (!(cloned instanceof HTMLElement)) return;
					// 隐藏滚动条
					cloned.style.overflowX = "hidden";
					// 清理 <style> 标签中的 oklab/oklch
					cloned.querySelectorAll("style").forEach((style) => {
						style.textContent = cleanColor(style.textContent);
					});
					// 替换 <input> 为 <div>，确保文字正确渲染
					cloned.querySelectorAll("input").forEach((input) => {
						const inputElement = input as HTMLInputElement;
						const replacement = document.createElement("div");
						const isSkillInput = inputElement.classList.contains("font-bold");
						const isActionValue =
							inputElement.classList.contains("font-mono") && !isSkillInput;
						const isDomainSkill =
							inputElement.dataset.exportKind === "domain-skill";
						const parentTd = inputElement.closest("td");
						const isResourceInput =
							!isActionValue &&
							!isDomainSkill &&
							!isSkillInput &&
							parentTd?.cellIndex !== undefined &&
							parentTd.cellIndex >= 4;
						replacement.textContent = inputElement.value;
						replacement.style.alignItems = "center";
						replacement.style.backgroundColor = isDomainSkill
							? "#78350f"
							: "#374151";
						replacement.style.border = isDomainSkill
							? "1px solid #fbbf24"
							: "1px solid #4b5563";
						replacement.style.borderRadius = "0.5rem";
						replacement.style.boxSizing = "border-box";
						replacement.style.color = isDomainSkill ? "#fef3c7" : "#ffffff";
						replacement.style.display = "flex";
						replacement.style.fontSize = isSkillInput ? "0.875rem" : "inherit";
						replacement.style.fontWeight = isDomainSkill
							? "700"
							: isSkillInput
								? "700"
								: "400";
						replacement.style.justifyContent =
							isDomainSkill || isSkillInput ? "center" : "flex-start";
						replacement.style.fontFamily =
							isActionValue || isSkillInput
								? '"Inconsolata Nerd Font", monospace'
								: "inherit";
						replacement.style.height = "32px";
						replacement.style.lineHeight = "1";
						replacement.style.padding = isDomainSkill
							? "0 4px"
							: isSkillInput
								? "0 4px"
								: "0 8px";
						replacement.style.whiteSpace = "nowrap";
						replacement.style.width = isDomainSkill
							? "32px"
							: isSkillInput
								? "40px"
								: isActionValue
									? "72px"
									: isResourceInput
										? `${resourceColWidth}px`
										: "80px";
						if (isResourceInput) {
							replacement.style.flexShrink = "0";
						}
						inputElement.replaceWith(replacement);
					});
					// 清理 .truncate 元素：移除省略号，允许文本完整显示
					cloned.querySelectorAll(".truncate").forEach((element) => {
						const exportText = element as HTMLElement;
						exportText.style.overflow = "visible";
						exportText.style.textOverflow = "clip";
						exportText.style.whiteSpace = "nowrap";
						exportText.style.maxWidth = "none";
					});
				},
			});

			const selectedPath = await save({
				title: "导出行动序列图片",
				defaultPath: getTimestampedFileName("action-sequence", ".png"),
				filters: [
					{
						name: "PNG 图片",
						extensions: ["png"],
					},
				],
			});
			if (!selectedPath) {
				setMessage("已取消导出图片");
				return;
			}

			const filePath = ensureFileExtension(selectedPath, ".png");
			await invoke("write_png_file", {
				path: filePath,
				dataUrl,
			});
			setMessage(`已导出行动序列图片：${filePath}`);
		} catch (error) {
			setMessage(`图片导出失败：${getErrorMessage(error)}`);
		} finally {
			setIsExportingImage(false);
		}
	};

	const importJson = (rawText = importText) => {
		try {
			const parsed = JSON.parse(rawText) as Partial<SavedData>;
			if (!Array.isArray(parsed.characters)) {
				throw new Error("characters 缺失");
			}
			const savedDisplayedActionLimit = getSavedDisplayedActionLimit(parsed);

			setCharacters(
				parsed.characters.map((character, index) =>
					withoutCharacterOnlyEffects({
						...createTarget(
							String(character.id ?? `target-${index + 1}`),
							index,
							(targetKinds.includes(character.kind as TargetKind)
								? character.kind
								: "角色") as TargetKind,
						),
						...character,
						id: String(character.id ?? `target-${index + 1}`),
						kind: (targetKinds.includes(character.kind as TargetKind)
							? character.kind
							: "角色") as TargetKind,
						name: String(character.name ?? ""),
						speed: String(character.speed ?? ""),
						baseSpeed: String(character.baseSpeed ?? ""),
					}),
				),
			);
			setLimitPreset(
				parsed.limitPreset && limitPresets.includes(parsed.limitPreset)
					? parsed.limitPreset
					: "150",
			);
			setCustomLimit(String(parsed.customLimit ?? ""));
			setDisplayedLimit(
				String(parsed.displayedLimit ?? getSavedDisplayedLimitFallback(parsed)),
			);
			setResources(
				Array.isArray(parsed.resources)
					? parsed.resources.slice(0, maxResources).map(String)
					: [],
			);
			setOverrides(
				clampOverridesToDisplayedLimit(
					parsed.overrides,
					savedDisplayedActionLimit,
				),
			);
			setUltOverrides(parsed.ultOverrides ?? {});
			setSkillOverrides(parsed.skillOverrides ?? {});
			setDomainEndOverrides(parsed.domainEndOverrides ?? {});
			setSpeedAdjustments(parsed.speedAdjustments ?? {});
			setSkillTargets(parsed.skillTargets ?? {});
			setDefaultSkillTargets(parsed.defaultSkillTargets ?? {});
			setOdeSelections(parsed.odeSelections ?? {});
			setMemeSelections(parsed.memeSelections ?? {});
			setUltInterrupts(parsed.ultInterrupts ?? {});
			setResourceValues(parsed.resourceValues ?? {});
			setFireflyBreakCounters(parsed.fireflyBreakCounters ?? {});
			setGodmodeExtraActions(parsed.godmodeExtraActions ?? {});
			setCastoriceKillToggles(parsed.castoriceKillToggles ?? {});
			setMeritTarget(parsed.meritTarget || undefined);
			setDancePartner(parsed.dancePartner || undefined);
			setSelectedActionKeys(new Set());
			closeActionMenu();
			setMessage("导入成功");
		} catch {
			setMessage("导入失败，请检查 JSON 格式");
		}
	};

	const importFromFile = async () => {
		try {
			const selectedPath = await open({
				title: "导入 JSON",
				multiple: false,
				filters: [
					{
						name: "JSON",
						extensions: ["json"],
					},
				],
			});
			if (!selectedPath || Array.isArray(selectedPath)) {
				setMessage("已取消从文件导入");
				return;
			}

			const text = await invoke<string>("read_text_file", {
				path: selectedPath,
			});
			setImportText(text);
			importJson(text);
		} catch (error) {
			setMessage(`从文件导入失败：${getErrorMessage(error)}`);
		}
	};

	const clearAutosaveFile = () => {
		const path = autosavePathRef.current;
		if (!path) return;
		invoke("write_text_file", {
			path,
			contents: "{}",
		}).catch(() => {
			// 清空失败不影响用户操作
		});
	};

	return (
		<ActionSequenceCtx.Provider
			value={{
				characters,
				setCharacters,
				limitPreset,
				setLimitPreset,
				customLimit,
				setCustomLimit,
				displayedLimit,
				setDisplayedLimit,
				resources,
				setResources,
				overrides,
				setOverrides,
				ultOverrides,
				setUltOverrides,
				skillOverrides,
				setSkillOverrides,
				domainEndOverrides,
				setDomainEndOverrides,
				speedAdjustments,
				setSpeedAdjustments,
				skillTargets,
				setSkillTargets,
				defaultSkillTargets,
				setDefaultSkillTargets,
				odeSelections,
				setOdeSelections,
				memeSelections,
				setMemeSelections,
				lastMemeTarget,
				setLastMemeTarget,
				ultInterrupts,
				setUltInterrupts,
				fireflyBreakCounters,
				setFireflyBreakCounters,
				godmodeExtraActions,
				setGodmodeExtraActions,
				castoriceKillToggles,
				setCastoriceKillToggles,
				icaKillToggles,
				setIcaKillToggles,
				hyacineE2Active,
				setHyacineE2Active,
				meritTarget,
				setMeritTarget,
				dancePartner,
				setDancePartner,
				resourceValues,
				setResourceValues,
				actions,
				setActions,
				importText,
				setImportText,
				message,
				setMessage,
				isExportingImage,
				setIsExportingImage,
				selectedActionKeys,
				setSelectedActionKeys,
				actionMenuOpen,
				setActionMenuOpen,
				actionMenuKey,
				setActionMenuKey,
				actionMenuPos,
				setActionMenuPos,
				actionOperation,
				setActionOperation,
				operationValue,
				setOperationValue,
				advanceCeiling,
				setAdvanceCeiling,
				operationSpeedMode,
				setOperationSpeedMode,
				draftInterruptCaster,
				setDraftInterruptCaster,
				draftInterruptTiming,
				setDraftInterruptTiming,
				actionLimit,
				displayedActionLimit,
				characterNames,
				characterKinds,
				charactersById,
				memospriteTargets,
				imageExportRef,
				updateCharacter,
				addTarget,
				removeTarget,
				updateResourceValue,
				cancelHimekoNovaAssist,
				updateSkillTarget,
				updateActionSkill,
				selectAction,
				openActionMenu,
				closeActionMenu,
				applyActionOperation,
				addResource,
				updateResource,
				removeResource,
				buildExportData,
				exportJson,
				exportImage,
				importJson,
				importFromFile,
				clearAutosaveFile,
			}}
		>
			<div className="mx-auto max-w-7xl px-1 py-2">
				<div className="mb-4 rounded-2xl bg-gray-800 p-4 shadow">
					<h2 className="mb-2 text-2xl font-bold text-white">行动排轴器</h2>
					<p className="text-gray-300">
						星穹铁道行动值序列工具，支持翁瓦克、风套、舞舞舞、手动行动值和资源备注。
					</p>
				</div>
				<div className="grid grid-cols-1 gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
					<CharacterPanel />
					<ActionPanel />
				</div>
			</div>
		</ActionSequenceCtx.Provider>
	);
}
