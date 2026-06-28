export interface CharacterEntry {
	names: string[];
	effects: Record<string, string>;
	effectRules?: Record<string, unknown>;
	passives?: string[];
	semantics?: string[];
	path?: string;
}

export interface CharacterData {
	characters: CharacterEntry[];
}
