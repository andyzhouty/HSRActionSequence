export function toggleSelectedAction(
	selectedKeys: Set<string>,
	actionKey: string,
	additive: boolean,
) {
	if (!additive) {
		if (selectedKeys.size === 1 && selectedKeys.has(actionKey)) {
			return new Set<string>();
		}
		return new Set([actionKey]);
	}
	const next = new Set(selectedKeys);
	if (next.has(actionKey)) {
		next.delete(actionKey);
	} else {
		next.add(actionKey);
	}
	return next;
}

export function getOpenedActionSelection(params: {
	selectedKeys: Set<string>;
	actionKey: string;
	additive: boolean;
}) {
	const { selectedKeys, actionKey, additive } = params;
	if (selectedKeys.has(actionKey) && !additive) return selectedKeys;
	if (!additive) return new Set([actionKey]);
	const next = new Set(selectedKeys);
	next.add(actionKey);
	return next;
}

export function shouldToggleActionMenu(params: {
	actionMenuOpen: boolean;
	actionMenuKey: string | null;
	actionKey: string;
	additive: boolean;
}) {
	const { actionMenuOpen, actionMenuKey, actionKey, additive } = params;
	return actionMenuOpen && actionMenuKey === actionKey && !additive;
}

export function getAdvanceCeilingValue(params: {
	actions: Array<{ actionValue: number }>;
	advanceCeiling: string;
}) {
	const { actions, advanceCeiling } = params;
	const ceilingIndex = Number.parseInt(advanceCeiling, 10);
	return advanceCeiling !== "" && Number.isFinite(ceilingIndex) && ceilingIndex >= 1
		? (actions[ceilingIndex - 1]?.actionValue ?? 0)
		: 0;
}
