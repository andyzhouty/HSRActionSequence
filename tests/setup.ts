import "@testing-library/jest-dom/vitest";

// Mock backend bridge
vi.mock("../src/utils/backend", () => ({
	invoke: vi.fn(),
	save: vi.fn(),
	open: vi.fn(),
}));
