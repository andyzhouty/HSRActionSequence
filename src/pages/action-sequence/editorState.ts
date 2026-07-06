import {
	createTarget,
	type CharacterConfig,
	type OdeSelection,
} from "../../utils/actionSequence";

export function updateCharacterList(
	characters: CharacterConfig[],
	id: string,
	updater: (character: CharacterConfig) => CharacterConfig,
) {
	return characters.map((character) =>
		character.id === id ? updater(character) : character,
	);
}

export function addCharacterTarget(characters: CharacterConfig[]) {
	return [...characters, createTarget(`target-${Date.now()}`, characters.length)];
}

export function removeCharacterTarget(
	characters: CharacterConfig[],
	id: string,
) {
	if (characters.length <= 1) return characters;
	return characters.filter((character) => character.id !== id);
}

export function filterActionKeyedRecord<T>(
	record: Record<string, T>,
	id: string,
) {
	return Object.fromEntries(
		Object.entries(record).filter(([actionKey]) => !actionKey.startsWith(`${id}-`)),
	);
}

export function removeTargetFromDefaultSkillTargets(
	record: Record<string, string>,
	id: string,
) {
	const next = { ...record };
	delete next[id];
	for (const [casterId, targetId] of Object.entries(next)) {
		if (targetId === id) delete next[casterId];
	}
	return next;
}

export function removeTargetFromOdeSelections(
	record: Record<string, OdeSelection>,
	id: string,
) {
	return Object.fromEntries(
		Object.entries(record).filter(
			([actionKey, selection]) =>
				!actionKey.startsWith(`${id}-`) && selection.targetId !== id,
		),
	);
}

export function removeTargetFromMemeSelections(
	record: Record<string, string>,
	id: string,
) {
	return Object.fromEntries(
		Object.entries(record).filter(
			([actionKey, targetId]) => !actionKey.startsWith(`${id}-`) && targetId !== id,
		),
	);
}

export function removeTargetFromSelectionKeys(
	selectedKeys: Set<string>,
	id: string,
) {
	return new Set([...selectedKeys].filter((actionKey) => !actionKey.startsWith(`${id}-`)));
}

export function updateResourceValueRecord(
	record: Record<string, Record<string, string>>,
	actionKey: string,
	resourceName: string,
	value: string,
) {
	return {
		...record,
		[actionKey]: {
			...(record[actionKey] ?? {}),
			[resourceName]: value,
		},
	};
}

export function addResourceName(resources: string[]) {
	return [...resources, `资源 ${resources.length + 1}`];
}

export function updateResourceNames(
	resources: string[],
	index: number,
	value: string,
) {
	return resources.map((resource, resourceIndex) =>
		resourceIndex === index ? value : resource,
	);
}

export function removeResourceName(
	resources: string[],
	index: number,
) {
	return resources.filter((_, resourceIndex) => resourceIndex !== index);
}

export function removeResourceFromValues(
	record: Record<string, Record<string, string>>,
	resourceName: string,
) {
	const next = { ...record };
	for (const actionKey of Object.keys(next)) {
		const values = { ...next[actionKey] };
		delete values[resourceName];
		next[actionKey] = values;
	}
	return next;
}