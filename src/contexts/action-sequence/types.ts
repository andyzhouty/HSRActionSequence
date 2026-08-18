import type React from "react";
import type {
	CharacterConfig,
	GeneratedAction,
	OdeSelection,
	SavedData,
	SkillCode,
	SpeedAdjustment,
	SpeedChangeMode,
	TargetKind,
	UltInterrupt,
} from "../../utils/action-sequence";

/** 保存数据状态和其更新器。 */
export type SavedDataContext = {
	characters: CharacterConfig[];
	limitPreset: string;
	customLimit: string;
	displayedLimit: string;
	resources: string[];
	overrides: Record<string, string>;
	ultOverrides: Record<string, boolean>;
	skillOverrides: Record<string, SkillCode>;
	domainEndOverrides: Record<string, boolean>;
	speedAdjustments: Record<string, SpeedAdjustment>;
	skillTargets: Record<string, string>;
	defaultSkillTargets: Record<string, string>;
	odeSelections: Record<string, OdeSelection>;
	memeSelections: Record<string, string>;
	lastMemeTarget: string;
	ultInterrupts: Record<string, UltInterrupt[]>;
	fireflyBreakCounters: Record<string, boolean>;
	godmodeExtraActions: Record<string, boolean>;
	castoriceKillToggles: Record<string, boolean>;
	icaKillToggles: Record<string, boolean>;
	memeKillToggles: Record<string, boolean>;
	evernightSelfDestructToggles: Record<string, boolean>;
	evernightThresholdBurstToggles: Record<string, boolean>;
	evanesciaFuaToggles: Record<string, boolean>;
	ashveilFuaToggles: Record<string, boolean>;
	kafkaFuaToggles: Record<string, boolean>;
	spBladeExtraTurnToggles: Record<string, boolean>;
	mydeiVendettaToggles: Record<string, boolean>;
	mydeiGodslayerToggles: Record<string, boolean>;
	spRobinFeverToggles: Record<string, boolean>;
	sameAVOrder: Record<string, number>;
	hyacineE2Active: boolean;
	meritTarget?: string;
	dancePartner?: string;
	bondmateTarget?: string;
	attackDisabled: Record<string, boolean>;
	saberAdvanceToggles: Record<string, boolean>;
	resourceValues: Record<string, Record<string, string>>;
};

export type SavedDataSetters = {
	setCharacters: React.Dispatch<React.SetStateAction<CharacterConfig[]>>;
	setLimitPreset: React.Dispatch<React.SetStateAction<string>>;
	setCustomLimit: React.Dispatch<React.SetStateAction<string>>;
	setDisplayedLimit: React.Dispatch<React.SetStateAction<string>>;
	setResources: React.Dispatch<React.SetStateAction<string[]>>;
	setOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
	setUltOverrides: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setSkillOverrides: React.Dispatch<
		React.SetStateAction<Record<string, SkillCode>>
	>;
	setDomainEndOverrides: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setSpeedAdjustments: React.Dispatch<
		React.SetStateAction<Record<string, SpeedAdjustment>>
	>;
	setSkillTargets: React.Dispatch<React.SetStateAction<Record<string, string>>>;
	setDefaultSkillTargets: React.Dispatch<
		React.SetStateAction<Record<string, string>>
	>;
	setOdeSelections: React.Dispatch<
		React.SetStateAction<Record<string, OdeSelection>>
	>;
	setMemeSelections: React.Dispatch<
		React.SetStateAction<Record<string, string>>
	>;
	setLastMemeTarget: React.Dispatch<React.SetStateAction<string>>;
	setUltInterrupts: React.Dispatch<
		React.SetStateAction<Record<string, UltInterrupt[]>>
	>;
	setFireflyBreakCounters: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setGodmodeExtraActions: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setCastoriceKillToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setIcaKillToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setMemeKillToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setEvernightSelfDestructToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setEvernightThresholdBurstToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setEvanesciaFuaToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setAshveilFuaToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setKafkaFuaToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setSpBladeExtraTurnToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setMydeiVendettaToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setMydeiGodslayerToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setSpRobinFeverToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setSameAVOrder: React.Dispatch<React.SetStateAction<Record<string, number>>>;
	setHyacineE2Active: React.Dispatch<React.SetStateAction<boolean>>;
	setMeritTarget: React.Dispatch<React.SetStateAction<string | undefined>>;
	setDancePartner: React.Dispatch<React.SetStateAction<string | undefined>>;
	setBondmateTarget: React.Dispatch<React.SetStateAction<string | undefined>>;
	setAttackDisabled: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setSaberAdvanceToggles: React.Dispatch<
		React.SetStateAction<Record<string, boolean>>
	>;
	setResourceValues: React.Dispatch<
		React.SetStateAction<Record<string, Record<string, string>>>
	>;
};

/** 表格选择、右键菜单和导出状态。 */
export type ActionSequenceUiContext = {
	actions: GeneratedAction[];
	setIsExportingImage: React.Dispatch<React.SetStateAction<boolean>>;
	importText: string;
	message: string;
	isExportingImage: boolean;
	selectedActionKeys: Set<string>;
	actionMenuOpen: boolean;
	actionMenuKey: string | null;
	actionMenuPos: number;
	actionOperation: "advance" | "speed";
	operationValue: string;
	advanceCeiling: string;
	operationSpeedMode: SpeedChangeMode;
	draftInterruptCaster: string;
	draftInterruptTiming: "before" | "after";
	imageExportRef: React.RefObject<HTMLDivElement | null>;
};

export type ActionSequenceUiSetters = {
	setSelectedActionKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
	setActionMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
	setActionMenuKey: React.Dispatch<React.SetStateAction<string | null>>;
	setActionMenuPos: React.Dispatch<React.SetStateAction<number>>;
	setActionOperation: React.Dispatch<React.SetStateAction<"advance" | "speed">>;
	setOperationValue: React.Dispatch<React.SetStateAction<string>>;
	setAdvanceCeiling: React.Dispatch<React.SetStateAction<string>>;
	setOperationSpeedMode: React.Dispatch<React.SetStateAction<SpeedChangeMode>>;
	setImportText: React.Dispatch<React.SetStateAction<string>>;
	setMessage: React.Dispatch<React.SetStateAction<string>>;
	setDraftInterruptCaster: React.Dispatch<React.SetStateAction<string>>;
	setDraftInterruptTiming: React.Dispatch<
		React.SetStateAction<"before" | "after">
	>;
};

/** 根据保存数据生成的只读查询结果。 */
export type ActionSequenceDerivedState = {
	actionLimit: number;
	displayedActionLimit: number;
	characterNames: Record<string, string>;
	characterKinds: Record<string, TargetKind>;
	charactersById: Record<string, CharacterConfig>;
	memospriteTargets: CharacterConfig[];
};

/** 跨组件复用的业务命令。 */
export type ActionSequenceCommands = {
	updateCharacter: (
		id: string,
		updater: (character: CharacterConfig) => CharacterConfig,
	) => void;
	addTarget: () => void;
	removeTarget: (id: string) => void;
	updateResourceValue: (
		actionKey: string,
		resourceName: string,
		value: string,
	) => void;
	resetSavedData: () => void;
	clearAutosaveFile: () => void;
	cancelHimekoNovaAssist: (action: GeneratedAction) => void;
	updateSkillTarget: (action: GeneratedAction, targetId: string) => void;
	updateActionSkill: (action: GeneratedAction, value: string) => void;
	selectAction: (actionKey: string, additive: boolean) => void;
	openActionMenu: (
		actionKey: string,
		additive: boolean,
		clientY: number,
	) => void;
	closeActionMenu: () => void;
	applyActionOperation: () => void;
	addResource: () => void;
	updateResource: (index: number, value: string) => void;
	removeResource: (index: number) => void;
	exportJson: () => Promise<void>;
	exportImage: () => Promise<void>;
	importJson: (rawText?: string) => void;
	importFromFile: () => Promise<void>;
	buildExportData: () => SavedData;
};

export type ActionSequenceContextType = SavedDataContext &
	SavedDataSetters &
	ActionSequenceUiContext &
	ActionSequenceUiSetters &
	ActionSequenceDerivedState &
	ActionSequenceCommands;

export type SavedDataContextValue = SavedDataContext & SavedDataSetters;
export type ActionSequenceUiContextValue = ActionSequenceUiContext &
	ActionSequenceUiSetters;
export type ActionSequenceCommandsContextValue = ActionSequenceCommands;
