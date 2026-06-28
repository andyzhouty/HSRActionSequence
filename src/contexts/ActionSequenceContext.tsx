import { createContext, useContext } from "react";
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
} from "../utils/actionSequence";

export type ActionSequenceContextType = {
    // State
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
    ultInterrupts: Record<string, UltInterrupt[]>;
    fireflyBreakCounters: Record<string, boolean>;
    resourceValues: Record<string, Record<string, string>>;
    actions: GeneratedAction[];
    setActions: React.Dispatch<React.SetStateAction<GeneratedAction[]>>;
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

    // Computed
    actionLimit: number;
    displayedActionLimit: number;
    characterNames: Record<string, string>;
    characterKinds: Record<string, TargetKind>;
    charactersById: Record<string, CharacterConfig>;

    // Refs
    imageExportRef: React.RefObject<HTMLDivElement | null>;

    // Setters
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
    setSkillTargets: React.Dispatch<
        React.SetStateAction<Record<string, string>>
    >;
    setDefaultSkillTargets: React.Dispatch<
        React.SetStateAction<Record<string, string>>
    >;
    setOdeSelections: React.Dispatch<
        React.SetStateAction<Record<string, OdeSelection>>
    >;
    setMemeSelections: React.Dispatch<
        React.SetStateAction<Record<string, string>>
    >;
    setUltInterrupts: React.Dispatch<
        React.SetStateAction<Record<string, UltInterrupt[]>>
    >;
    setFireflyBreakCounters: React.Dispatch<
        React.SetStateAction<Record<string, boolean>>
    >;
    setResourceValues: React.Dispatch<
        React.SetStateAction<Record<string, Record<string, string>>>
    >;
    setSelectedActionKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
    setActionMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setActionMenuKey: React.Dispatch<React.SetStateAction<string | null>>;
    setActionMenuPos: React.Dispatch<React.SetStateAction<number>>;
    setActionOperation: React.Dispatch<
        React.SetStateAction<"advance" | "speed">
    >;
    setOperationValue: React.Dispatch<React.SetStateAction<string>>;
    setAdvanceCeiling: React.Dispatch<React.SetStateAction<string>>;
    setOperationSpeedMode: React.Dispatch<
        React.SetStateAction<SpeedChangeMode>
    >;
    setImportText: React.Dispatch<React.SetStateAction<string>>;
    setMessage: React.Dispatch<React.SetStateAction<string>>;
    setDraftInterruptCaster: React.Dispatch<React.SetStateAction<string>>;
    setDraftInterruptTiming: React.Dispatch<
        React.SetStateAction<"before" | "after">
    >;

    // Actions
    updateCharacter: (
        id: string,
        updater: (c: CharacterConfig) => CharacterConfig,
    ) => void;
    addTarget: () => void;
    removeTarget: (id: string) => void;
    updateResourceValue: (
        actionKey: string,
        resourceName: string,
        value: string,
    ) => void;
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

export const ActionSequenceCtx =
    createContext<ActionSequenceContextType | null>(null);

export function useActionSequence(): ActionSequenceContextType {
    const ctx = useContext(ActionSequenceCtx);
    if (!ctx)
        throw new Error(
            "useActionSequence must be used within ActionSequenceProvider",
        );
    return ctx;
}
