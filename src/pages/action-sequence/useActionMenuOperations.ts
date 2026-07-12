import { type Dispatch, type SetStateAction, useCallback } from "react";
import type {
	CharacterConfig,
	GeneratedAction,
	SpeedAdjustment,
	SpeedChangeMode,
} from "../../utils/actionSequence";
import { toSignedNumber } from "../../utils/actionSequence";
import {
	getAdvanceCeilingValue,
	getOpenedActionSelection,
	shouldToggleActionMenu,
	toggleSelectedAction,
} from "./actionMenuState";
import {
	buildAdvanceOverrides,
	buildSpeedAdjustments,
	hasMissingRelativeBaseSpeed,
} from "./actionOperations";

type UseActionMenuOperationsParams = {
	actions: GeneratedAction[];
	charactersById: Record<string, CharacterConfig>;
	displayedActionLimit: number;
	selectedActionKeys: Set<string>;
	setSelectedActionKeys: Dispatch<SetStateAction<Set<string>>>;
	actionMenuOpen: boolean;
	setActionMenuOpen: Dispatch<SetStateAction<boolean>>;
	actionMenuKey: string | null;
	setActionMenuKey: Dispatch<SetStateAction<string | null>>;
	setActionMenuPos: Dispatch<SetStateAction<number>>;
	actionOperation: "advance" | "speed";
	operationValue: string;
	advanceCeiling: string;
	setAdvanceCeiling: Dispatch<SetStateAction<string>>;
	operationSpeedMode: SpeedChangeMode;
	setOverrides: Dispatch<SetStateAction<Record<string, string>>>;
	setSpeedAdjustments: Dispatch<
		SetStateAction<Record<string, SpeedAdjustment>>
	>;
	setMessage: (message: string) => void;
};

export function useActionMenuOperations({
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
}: UseActionMenuOperationsParams) {
	const closeActionMenu = useCallback(() => {
		setActionMenuOpen(false);
		setActionMenuKey(null);
		setAdvanceCeiling("");
	}, [setActionMenuOpen, setActionMenuKey, setAdvanceCeiling]);

	const selectAction = (actionKey: string, additive: boolean) => {
		setSelectedActionKeys((prev) =>
			toggleSelectedAction(prev, actionKey, additive),
		);
	};

	const openActionMenu = (
		actionKey: string,
		additive: boolean,
		clientY: number,
	) => {
		if (
			shouldToggleActionMenu({
				actionMenuOpen,
				actionMenuKey,
				actionKey,
				additive,
			})
		) {
			closeActionMenu();
			return;
		}
		setSelectedActionKeys((prev) =>
			getOpenedActionSelection({ selectedKeys: prev, actionKey, additive }),
		);
		setActionMenuKey(actionKey);
		setActionMenuPos(clientY);
		setActionMenuOpen(true);
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
			const ceilingAV = getAdvanceCeilingValue({
				actions,
				advanceCeiling,
			});
			setOverrides((prev) =>
				buildAdvanceOverrides({
					actions,
					charactersById,
					displayedActionLimit,
					prevOverrides: prev,
					selectedActions,
					value,
					ceilingAV,
				}),
			);
			setMessage(
				`已调整 ${selectedActions.length} 条行动的行动值，超出显示上限的结果已自动贴边`,
			);
		} else {
			if (
				hasMissingRelativeBaseSpeed({
					charactersById,
					operationSpeedMode,
					selectedActions,
				})
			) {
				setMessage("相对变速需要为选中的目标填写基础速度 v₀");
				return;
			}

			setSpeedAdjustments((prev) =>
				buildSpeedAdjustments({
					operationSpeedMode,
					operationValue,
					prevAdjustments: prev,
					selectedActions,
				}),
			);
			setMessage(`已为 ${selectedActions.length} 条行动设置后续变速`);
		}

		closeActionMenu();
	};

	return {
		selectAction,
		openActionMenu,
		closeActionMenu,
		applyActionOperation,
	};
}
