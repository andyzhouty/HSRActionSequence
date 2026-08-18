export interface CharacterEntry {
	cid: string;
	names: string[];
	effects: Record<string, string>;
	baseSpeed: number;
	effectRules?: Record<string, unknown>;
	passives?: string[];
	semantics?: string[];
	path?: string;
}

export interface CharacterData {
	characters: CharacterEntry[];
	_defaults?: Record<string, unknown>;
}
