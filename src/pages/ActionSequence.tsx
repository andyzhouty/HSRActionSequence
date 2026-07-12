import { useCallback, useEffect, useState } from "react";
import ActionPanel from "../components/action-sequence/ActionPanel";
import CharacterPanel from "../components/action-sequence/CharacterPanel";
import { ActionSequenceCtx } from "../contexts/ActionSequenceContext";
import { hasDanHengSouldragon } from "../mechanics/danHengSouldragon";
import {
	type CharacterConfig,
	evernightResourceName,
	type GeneratedAction,
	isLockedResourceNameForCharacters,
	maxResources,
	normalizeResourcesForCharacters,
	type SavedData,
	type SkillCode,
} from "../utils/actionSequence";
import {
	addCharacterTarget,
	addResourceName,
	filterActionKeyedRecord,
	removeCharacterTarget,
	removeResourceFromValues,
	removeResourceName,
	removeTargetFromDefaultSkillTargets,
	removeTargetFromMemeSelections,
	removeTargetFromOdeSelections,
	removeTargetFromSelectionKeys,
	updateCharacterList,
	updateResourceNames,
	updateResourceValueRecord,
} from "./action-sequence/editorState";
import {
	canSelectSkillTarget,
	clearActionSkillTarget,
	getCanceledNovaAssistMessage,
	getCanceledNovaAssistSkill,
	getSavedSkillCode,
	removeActionBooleanOverride,
	shouldRememberTargetForCharacter,
	updateActionSkillTargetRecord,
	updateSkillOverrideRecord,
	validateActionSkillInput,
} from "./action-sequence/skillEditing";
import { useActionImageExport } from "./action-sequence/useActionImageExport";
import { useActionMenuOperations } from "./action-sequence/useActionMenuOperations";
import { useActionSequencePersistence } from "./action-sequence/useActionSequencePersistence";
import { useActionSequenceSavedData } from "./action-sequence/useActionSequenceSavedData";
import { useGeneratedActions } from "./action-sequence/useGeneratedActions";

export default function ActionSequence() {
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
	const [operationSpeedMode, setOperationSpeedMode] = useState<
		"absolute" | "relative"
	>("absolute");
	const [lastMemeTarget, setLastMemeTarget] = useState<string>("");
	const [draftInterruptCaster, setDraftInterruptCaster] = useState("");
	const [draftInterruptTiming, setDraftInterruptTiming] = useState<
		"before" | "after"
	>("before");
	const [message, setMessage] = useState("");
	const {
		savedData,
		updateSavedData,
		actionLimit,
		displayedActionLimit,
		exportData,
		normalizeAndSetSavedData,
		resetSavedData,
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
		ultInterrupts,
		setUltInterrupts,
		resourceValues,
		setResourceValues,
		fireflyBreakCounters,
		setFireflyBreakCounters,
		godmodeExtraActions,
		setGodmodeExtraActions,
		castoriceKillToggles,
		setCastoriceKillToggles,
		icaKillToggles,
		setIcaKillToggles,
		memeKillToggles,
		setMemeKillToggles,
		evernightSelfDestructToggles,
		setEvernightSelfDestructToggles,
		evernightThresholdBurstToggles,
		setEvernightThresholdBurstToggles,
		fuaToggles,
		setFuaToggles,
		sameAVOrder,
		setSameAVOrder,
		hyacineE2Active,
		setHyacineE2Active,
		meritTarget,
		setMeritTarget,
		dancePartner,
		setDancePartner,
		bondmateTarget,
		setBondmateTarget,
		attackDisabled,
		setAttackDisabled,
	} = useActionSequenceSavedData();

	// 长夜月在队伍时自动锁死"忆质"资源列
	useEffect(() => {
		setResources((prev) => normalizeResourcesForCharacters(prev, characters));
	}, [characters, setResources]);

	// 盾丹自动默认同袍：有盾丹且用户未手动设置时，自动选第一个非盾丹角色（或盾丹自身）
	// undefined = 未初始化（触发自动选择）；"" = 用户显式选择"无初始同袍"
	useEffect(() => {
		const dhpt = characters.find(
			(c) => c.kind === "角色" && hasDanHengSouldragon(c.name),
		);
		if (!dhpt || bondmateTarget !== undefined) return;
		const otherChar = characters.find(
			(c) => c.kind === "角色" && c.id !== dhpt.id,
		);
		setBondmateTarget(otherChar?.id ?? dhpt.id);
	}, [characters, bondmateTarget, setBondmateTarget]);

	const applySavedData = useCallback(
		(
			parsed: Partial<SavedData>,
			options?: {
				message?: string;
				resetSelection?: boolean;
				closeMenu?: boolean;
			},
		) => {
			normalizeAndSetSavedData(parsed);
			if (options?.resetSelection) {
				setSelectedActionKeys(new Set());
			}
			if (options?.closeMenu) {
				setActionMenuOpen(false);
				setActionMenuKey(null);
				setAdvanceCeiling("");
			}
			if (options?.message) {
				setMessage(options.message);
			}
		},
		[normalizeAndSetSavedData],
	);

	const {
		actions,
		characterNames,
		memospriteTargets,
		characterKinds,
		charactersById,
	} = useGeneratedActions({
		savedData,
		displayedActionLimit,
		setMessage,
		updateSavedData,
		setSelectedActionKeys,
	});

	const {
		importText,
		setImportText,
		exportJson: exportJsonInternal,
		importJson: importJsonInternal,
		importFromFile: importFromFileInternal,
		clearAutosaveFile,
	} = useActionSequencePersistence({
		exportData,
		applyImportedData: applySavedData,
	});

	const {
		selectAction,
		openActionMenu,
		closeActionMenu,
		applyActionOperation,
	} = useActionMenuOperations({
		actions,
		charactersById,
		displayedActionLimit,
		selectedActionKeys,
		setSelectedActionKeys,
		actionMenuOpen,
		setActionMenuOpen,
		actionMenuKey,
		setActionMenuKey,
		setActionMenuPos,
		actionOperation,
		operationValue,
		advanceCeiling,
		setAdvanceCeiling,
		operationSpeedMode,
		setOverrides,
		setSpeedAdjustments,
		setMessage,
	});

	const { imageExportRef, isExportingImage, setIsExportingImage, exportImage } =
		useActionImageExport({
			actionCount: actions.length,
			resources,
			setMessage,
		});

	const updateCharacter = (
		id: string,
		updater: (character: CharacterConfig) => CharacterConfig,
	) => {
		setCharacters((prev) => updateCharacterList(prev, id, updater));
	};

	const addTarget = () => {
		setCharacters((prev) => addCharacterTarget(prev));
	};

	const removeTarget = (id: string) => {
		if (characters.length <= 1) return;
		setCharacters((prev) => removeCharacterTarget(prev, id));
		setOverrides((prev) => filterActionKeyedRecord(prev, id));
		setUltOverrides((prev) => filterActionKeyedRecord(prev, id));
		setSkillOverrides((prev) => filterActionKeyedRecord(prev, id));
		setDomainEndOverrides((prev) => filterActionKeyedRecord(prev, id));
		setSpeedAdjustments((prev) => filterActionKeyedRecord(prev, id));
		setSkillTargets((prev) => filterActionKeyedRecord(prev, id));
		setDefaultSkillTargets((prev) =>
			removeTargetFromDefaultSkillTargets(prev, id),
		);
		setOdeSelections((prev) => removeTargetFromOdeSelections(prev, id));
		setMemeSelections((prev) => removeTargetFromMemeSelections(prev, id));
		setUltInterrupts((prev) => filterActionKeyedRecord(prev, id));
		setResourceValues((prev) => filterActionKeyedRecord(prev, id));
		setSelectedActionKeys((prev) => removeTargetFromSelectionKeys(prev, id));
		if (meritTarget === id) setMeritTarget(undefined);
		if (dancePartner === id) setDancePartner(undefined);
		if (bondmateTarget === id) setBondmateTarget(undefined);
		closeActionMenu();
	};

	const updateResourceValue = (
		actionKey: string,
		resourceName: string,
		value: string,
	) => {
		setResourceValues((prev) =>
			updateResourceValueRecord(prev, actionKey, resourceName, value),
		);
	};

	const cancelHimekoNovaAssist = (action: GeneratedAction) => {
		const sourceKey = action.assistSourceKey ?? action.key;
		const assistIndex = action.assistIndex ?? 1;
		setSkillOverrides((prev) => {
			const restoredSkill = getCanceledNovaAssistSkill(
				prev[sourceKey] ?? "",
				assistIndex,
			);
			if (restoredSkill === null) return prev;
			const next = { ...prev };
			if (restoredSkill === "") delete next[sourceKey];
			else next[sourceKey] = restoredSkill;
			return next;
		});
		setMessage(getCanceledNovaAssistMessage(assistIndex));
	};
	const updateSkillTarget = (action: GeneratedAction, targetId: string) => {
		const character = charactersById[action.characterId];
		const target = targetId ? charactersById[targetId] : undefined;
		const canSelect = canSelectSkillTarget({ character, target });
		setSkillTargets((prev) =>
			updateActionSkillTargetRecord({
				actionKey: action.key,
				canSelect,
				record: prev,
				targetId,
			}),
		);
		if (!character || !shouldRememberTargetForCharacter(character.name)) return;
		setDefaultSkillTargets((prev) =>
			updateActionSkillTargetRecord({
				actionKey: action.characterId,
				canSelect,
				record: prev,
				targetId,
			}),
		);
	};
	const updateActionSkill = (action: GeneratedAction, value: string) => {
		const character = charactersById[action.characterId];
		if (!character) return;
		const nextSkill = value.trim().toUpperCase() as SkillCode;
		const validationMessage = validateActionSkillInput({
			action,
			character,
			characters,
			nextSkill,
		});
		if (validationMessage === "__IGNORE__") return;
		if (validationMessage) {
			setMessage(validationMessage);
			return;
		}

		const savedSkill = getSavedSkillCode(action, nextSkill);
		setSkillOverrides((prev) =>
			updateSkillOverrideRecord({
				action,
				character,
				nextSkill,
				record: prev,
				savedSkill,
			}),
		);
		setUltOverrides((prev) => removeActionBooleanOverride(prev, action.key));
		if (!nextSkill.includes("E")) {
			setSkillTargets((prev) => clearActionSkillTarget(prev, action.key));
		}
	};
	const addResource = () => {
		if (resources.length >= maxResources) return;
		setResources((prev) => addResourceName(prev));
	};

	const updateResource = (index: number, value: string) => {
		if (isLockedResourceNameForCharacters(resources[index] ?? "", characters))
			return;
		if (
			value.trim() === evernightResourceName &&
			!isLockedResourceNameForCharacters(resources[index] ?? "", characters)
		) {
			return;
		}
		setResources((prev) => updateResourceNames(prev, index, value));
	};

	const removeResource = (index: number) => {
		const removedName = resources[index];
		if (isLockedResourceNameForCharacters(removedName ?? "", characters))
			return;
		setResources((prev) => removeResourceName(prev, index));
		setResourceValues((prev) => removeResourceFromValues(prev, removedName));
	};

	const buildExportData = (): SavedData => exportData;

	const exportJson = async () => exportJsonInternal(setMessage);

	const importJson = (rawText = importText) =>
		importJsonInternal(setMessage, rawText);

	const importFromFile = async () => importFromFileInternal(setMessage);

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
				memeKillToggles,
				setMemeKillToggles,
				evernightSelfDestructToggles,
				setEvernightSelfDestructToggles,
				evernightThresholdBurstToggles,
				setEvernightThresholdBurstToggles,
				fuaToggles: fuaToggles ?? {},
				setFuaToggles,
				sameAVOrder: sameAVOrder ?? {},
				setSameAVOrder,
				hyacineE2Active,
				setHyacineE2Active,
				meritTarget,
				setMeritTarget,
				dancePartner,
				setDancePartner,
				bondmateTarget,
				setBondmateTarget,
				attackDisabled,
				setAttackDisabled,
				resourceValues,
				setResourceValues,
				actions,
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
				resetSavedData,
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
