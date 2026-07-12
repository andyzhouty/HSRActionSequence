import type { GeneratedAction } from "./actionSequence";

const DISPLAY_ACTION_VALUE_STEP = 0.0001;

export function getActionValueBucket(actionValue: number): number {
	return Math.round(actionValue / DISPLAY_ACTION_VALUE_STEP);
}

function getOriginalActionParentKey(sourceKey: string): string {
	let key = sourceKey;
	for (const suffix of ["-sparxie-extra", "-godmode-A", "-extra-aha", "-fua"]) {
		if (key.endsWith(suffix)) {
			key = key.slice(0, -suffix.length);
			break;
		}
	}
	if (key !== sourceKey) return getOriginalActionParentKey(key);
	if (key.endsWith("-q")) return key.slice(0, -2);
	const interruptMatch = key.match(/^(.*)-interrupt-\d+$/);
	if (interruptMatch) return interruptMatch[1];
	const breakExtraMatch = key.match(/^(.*)-break-extra-\d+$/);
	return breakExtraMatch
		? getOriginalActionParentKey(breakExtraMatch[1])
		: sourceKey;
}

export function getExtraAhaSourceKey(action: GeneratedAction): string | null {
	if (!action.isExtraAha || !action.key.endsWith("-extra-aha")) return null;
	return action.key.slice(0, -10);
}

/** 具有明确触发源的额外行动不能越过该触发源。 */
export function canExchangeActionOrder(
	left: GeneratedAction,
	right: GeneratedAction,
): boolean {
	return (
		getRequiredPredecessorKey(left) !== right.key &&
		getRequiredPredecessorKey(right) !== left.key
	);
}

function getDisplayExtraAhaSourceKey(action: GeneratedAction): string | null {
	const directSource = getExtraAhaSourceKey(action);
	if (directSource) return directSource;
	if (!action.isElationSkill || !action.elationSkillParentKey) return null;
	return action.elationSkillParentKey.match(/^(.*)-extra-aha$/)?.[1] ?? null;
}

/** 返回可独立排序的派生额外回合所依附的源行动。 */
function getDerivedExtraTurnSourceKey(action: GeneratedAction): string | null {
	if (action.isFuaAction && action.key.endsWith("-fua")) {
		return action.key.slice(0, -"-fua".length);
	}
	if (action.key.endsWith("-godmode-A")) {
		return action.key.slice(0, -"-godmode-A".length);
	}
	if (action.isSparxieExtraAction && action.key.endsWith("-sparxie-extra")) {
		return action.key.slice(0, -"-sparxie-extra".length);
	}
	const breakExtraMatch = action.key.match(/^(.*)-break-extra-\d+$/);
	if (breakExtraMatch) return breakExtraMatch[1];
	if (action.isOdeExtraAction) {
		const odeExtraMatch = action.key.match(/^(.*)-memosprite-Q-ode-.+$/);
		if (odeExtraMatch) return odeExtraMatch[1];
	}
	return null;
}

function getRequiredPredecessorKey(action: GeneratedAction): string | null {
	const extraAhaSourceKey = getExtraAhaSourceKey(action);
	if (extraAhaSourceKey) return extraAhaSourceKey;
	return action.isSparxieExtraAction
		? getDerivedExtraTurnSourceKey(action)
		: null;
}

function getDisplayRequiredPredecessorKey(
	action: GeneratedAction,
): string | null {
	const directSource = getRequiredPredecessorKey(action);
	if (directSource) return directSource;
	return getDisplayExtraAhaSourceKey(action);
}

/** 仅同父级的额外回合可参与拖拽排序。 */
export function getExtraTurnParentKey(action: GeneratedAction): string | null {
	// 阿哈本体是一个可移动的复合单元，内部欢愉技随它整体移动。
	if (action.isAhaInstant && action.hasElationSkills && !action.isExtraAha) {
		return action.key;
	}
	const derivedSourceKey = getDerivedExtraTurnSourceKey(action);
	if (derivedSourceKey) return getOriginalActionParentKey(derivedSourceKey);
	if (action.actionNo !== 0) return null;
	if (
		action.isMemospriteAction ||
		action.isDomainAction ||
		action.isEveyAction ||
		action.isPolluxAction ||
		action.isAglaeaGarmentmakerAction ||
		action.isSouldragonAction ||
		action.isAssistAction
	) {
		return null;
	}
	if (action.key.endsWith("-q") && action.skill === "Q") {
		return action.key.slice(0, -2);
	}
	if (action.interruptTiming === "after") {
		const match = action.key.match(/^(.*)-interrupt-\d+$/);
		if (match) return match[1];
	}
	if (action.isElationSkill && action.elationSkillParentKey) {
		return getOriginalActionParentKey(action.elationSkillParentKey);
	}
	if (action.isExtraAha && action.key.endsWith("-extra-aha")) {
		return getOriginalActionParentKey(
			getExtraAhaSourceKey(action) ?? action.key,
		);
	}
	return null;
}

function getDisplayOrderGroupKey(action: GeneratedAction): string | null {
	return getExtraTurnParentKey(action);
}

function getDisplayOrderItemKey(action: GeneratedAction): string {
	return action.key;
}

export function getDisplayOrderedActions(
	actions: readonly GeneratedAction[],
	sameAVOrder?: Record<string, number>,
): GeneratedAction[] {
	const groupItemIndexes = new Map<string, Map<string, number>>();
	const entries = actions.map((action, index) => {
		const bucket = getActionValueBucket(action.actionValue);
		const parentKey = getDisplayOrderGroupKey(action);
		const groupKey = parentKey ? `${bucket}:${parentKey}` : undefined;
		const itemKey = getDisplayOrderItemKey(action);
		const groupItems = groupKey
			? (groupItemIndexes.get(groupKey) ?? new Map<string, number>())
			: undefined;
		if (groupKey && groupItems) groupItemIndexes.set(groupKey, groupItems);
		const defaultOrder = groupItems?.get(itemKey) ?? groupItems?.size;
		if (groupItems && defaultOrder !== undefined) {
			groupItems.set(itemKey, defaultOrder);
		}
		return {
			action,
			index,
			bucket,
			parentKey,
			itemKey,
			defaultOrder,
		};
	});
	const groupItems = new Map<string, Map<string, (typeof entries)[number]>>();
	for (const entry of entries) {
		if (!entry.parentKey) continue;
		const key = `${entry.bucket}:${entry.parentKey}`;
		const items = groupItems.get(key) ?? new Map();
		if (!items.has(entry.itemKey)) items.set(entry.itemKey, entry);
		groupItems.set(key, items);
	}
	const resolvedOrders = new Map<string, number>();
	for (const [groupKey, items] of groupItems) {
		for (const [itemKey, entry] of items) {
			resolvedOrders.set(
				`${groupKey}:${itemKey}`,
				sameAVOrder?.[itemKey] ?? entry.defaultOrder ?? 0,
			);
		}
		for (const [itemKey, entry] of items) {
			const sourceKey = getDisplayRequiredPredecessorKey(entry.action);
			if (!sourceKey) continue;
			const sourceEntry = [...items.values()].find(
				(candidate) => candidate.action.key === sourceKey,
			);
			if (!sourceEntry) continue;
			const sourceOrder =
				resolvedOrders.get(`${groupKey}:${sourceEntry.itemKey}`) ?? 0;
			const itemOrder = resolvedOrders.get(`${groupKey}:${itemKey}`) ?? 0;
			if (itemOrder <= sourceOrder) {
				resolvedOrders.set(`${groupKey}:${itemKey}`, sourceOrder + 0.5);
			}
		}
	}
	return entries
		.sort((left, right) => {
			if (left.bucket !== right.bucket) {
				return left.bucket - right.bucket;
			}
			if (left.action.actionValue !== right.action.actionValue) {
				return left.action.actionValue - right.action.actionValue;
			}
			if (
				left.parentKey &&
				left.parentKey === right.parentKey &&
				left.defaultOrder !== undefined &&
				right.defaultOrder !== undefined
			) {
				const groupKey = `${left.bucket}:${left.parentKey}`;
				const leftOrder =
					resolvedOrders.get(`${groupKey}:${left.itemKey}`) ??
					left.defaultOrder;
				const rightOrder =
					resolvedOrders.get(`${groupKey}:${right.itemKey}`) ??
					right.defaultOrder;
				if (leftOrder !== rightOrder) return leftOrder - rightOrder;
			}
			return left.index - right.index;
		})
		.map(({ action }) => action);
}
