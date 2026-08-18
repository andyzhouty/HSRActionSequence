export type ActionTargetKind =
	| "角色"
	| "忆灵"
	| "非忆灵"
	| "倒计时"
	| "敌人"
	| "阿哈";

/** 模拟器产生的最小行动意图，不包含 UI 标记或角色机制内部字段。 */
export type ActionIntent = {
	key: string;
	characterId: string;
	actionNo: number;
	actionValue: number;
	skill: string;
	speed: number;
};

export type ActionEvent = {
	type: string;
	sourceKey: string;
	data?: Record<string, unknown>;
};

/** 一次行动结算的领域结果。 */
export type ActionResult = {
	intent: ActionIntent;
	events: ActionEvent[];
	stateVersion: number;
};

/** 表格和时间线使用的展示模型。 */
export type ActionViewModel = ActionIntent & {
	displayName?: string;
	targetKind?: ActionTargetKind;
	tags: readonly string[];
};

/** 可长期保存的行动字段；机制临时标记不得写入此模型。 */
export type PersistedAction = Pick<
	ActionIntent,
	"key" | "characterId" | "actionNo" | "skill"
> & {
	manualActionValue?: string;
};

export function toActionViewModel(
	action: ActionIntent & {
		displayName?: string;
		targetKind?: ActionTargetKind;
	},
): ActionViewModel {
	const tags: string[] = [];
	if (action.targetKind) tags.push(action.targetKind);
	return { ...action, tags };
}

export function toPersistedAction(action: ActionIntent): PersistedAction {
	return {
		key: action.key,
		characterId: action.characterId,
		actionNo: action.actionNo,
		skill: action.skill,
	};
}
