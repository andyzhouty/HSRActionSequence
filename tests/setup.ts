import "@testing-library/jest-dom/vitest";

// Schema validation: fails fast on bad character data
import { validateCharacterSchema } from "../src/data/characterSchema";

validateCharacterSchema();

// Mock backend bridge
vi.mock("../src/utils/backend", () => ({
	invoke: vi.fn(),
	save: vi.fn(),
	open: vi.fn(),
}));
