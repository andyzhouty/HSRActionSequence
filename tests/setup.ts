import "@testing-library/jest-dom/vitest";

// Mock Tauri invoke
vi.mock("@tauri-apps/api/core", () => ({
	invoke: vi.fn(),
}));

// Mock Tauri dialog
vi.mock("@tauri-apps/plugin-dialog", () => ({
	save: vi.fn(),
	open: vi.fn(),
}));
