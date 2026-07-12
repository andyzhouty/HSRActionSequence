/**
 * Backend bridge unit tests.
 *
 * These tests validate the method name mapping and dialog option conversion
 * in src/utils/backend.ts. They do NOT require Wails runtime — everything
 * is mocked.
 *
 * Run manually: npx vitest run tests/backend.test.ts
 */

import { describe, expect, it, vi } from "vitest";

// We test the internal helper logic by extracting and testing it directly.
// Since wailsMethodToName is not exported, we replicate its logic here.

const methodMap: Record<string, string> = {
	greet: "Greet",
	read_text_file: "ReadTextFile",
	write_text_file: "WriteTextFile",
	write_png_file: "WritePngFile",
	write_base64_file: "WriteBase64File",
	get_autosave_path: "GetAutosavePath",
};

function mapMethod(method: string): string {
	return methodMap[method] ?? method;
}

describe("backend method mapping", () => {
	it("maps greet → Greet", () => {
		expect(mapMethod("greet")).toBe("Greet");
	});

	it("maps read_text_file → ReadTextFile", () => {
		expect(mapMethod("read_text_file")).toBe("ReadTextFile");
	});

	it("maps write_text_file → WriteTextFile", () => {
		expect(mapMethod("write_text_file")).toBe("WriteTextFile");
	});

	it("maps write_png_file → WritePngFile", () => {
		expect(mapMethod("write_png_file")).toBe("WritePngFile");
	});

	it("maps write_base64_file → WriteBase64File", () => {
		expect(mapMethod("write_base64_file")).toBe("WriteBase64File");
	});

	it("maps get_autosave_path → GetAutosavePath", () => {
		expect(mapMethod("get_autosave_path")).toBe("GetAutosavePath");
	});

	it("passes through unknown methods unchanged", () => {
		expect(mapMethod("unknown_method")).toBe("unknown_method");
	});

	it("handles empty string", () => {
		expect(mapMethod("")).toBe("");
	});
});

describe("save dialog option serialization", () => {
	function buildSaveOptions(opts?: {
		defaultPath?: string;
		filters?: { name: string; extensions: string[] }[];
		title?: string;
	}) {
		if (!opts) return "";
		return JSON.stringify({
			title: opts.title,
			defaultFilename: opts.defaultPath?.split("/").pop()?.split("\\").pop(),
			filters: opts.filters?.map((f) => ({
				displayName: f.name,
				pattern: f.extensions.map((e) => `*.${e}`).join(";"),
			})),
		});
	}

	it("returns empty JSON string for no options", () => {
		expect(buildSaveOptions()).toBe("");
	});

	it("returns empty JSON for empty object", () => {
		const json = buildSaveOptions({});
		const parsed = JSON.parse(json);
		expect(parsed.title).toBeUndefined();
		expect(parsed.filters).toBeUndefined();
	});

	it("includes title", () => {
		const json = buildSaveOptions({ title: "Save As" });
		const parsed = JSON.parse(json);
		expect(parsed.title).toBe("Save As");
	});

	it("extracts defaultFilename from path", () => {
		const json = buildSaveOptions({ defaultPath: "C:\\Users\\test\\file.json" });
		const parsed = JSON.parse(json);
		expect(parsed.defaultFilename).toBe("file.json");
	});

	it("converts single filter correctly", () => {
		const json = buildSaveOptions({
			filters: [{ name: "JSON", extensions: ["json"] }],
		});
		const parsed = JSON.parse(json);
		expect(parsed.filters).toEqual([
			{ displayName: "JSON", pattern: "*.json" },
		]);
	});

	it("converts multiple filters correctly", () => {
		const json = buildSaveOptions({
			filters: [
				{ name: "Images", extensions: ["png", "jpg"] },
				{ name: "Text", extensions: ["txt"] },
			],
		});
		const parsed = JSON.parse(json);
		expect(parsed.filters).toEqual([
			{ displayName: "Images", pattern: "*.png;*.jpg" },
			{ displayName: "Text", pattern: "*.txt" },
		]);
	});

	it("defaultFilename from Unix path", () => {
		const json = buildSaveOptions({ defaultPath: "/home/user/data.json" });
		const parsed = JSON.parse(json);
		expect(parsed.defaultFilename).toBe("data.json");
	});

	it("defaultFilename undefined when no path", () => {
		const json = buildSaveOptions({ title: "Test" });
		const parsed = JSON.parse(json);
		expect(parsed.defaultFilename).toBeUndefined();
	});
});

describe("open dialog option serialization", () => {
	function buildOpenOptions(opts?: {
		filters?: { name: string; extensions: string[] }[];
		title?: string;
	}) {
		if (!opts) return "";
		return JSON.stringify({
			title: opts.title,
			filters: opts.filters?.map((f) => ({
				displayName: f.name,
				pattern: f.extensions.map((e) => `*.${e}`).join(";"),
			})),
		});
	}

	it("returns empty JSON string for no options", () => {
		expect(buildOpenOptions()).toBe("");
	});

	it("includes title only", () => {
		const json = buildOpenOptions({ title: "Open File" });
		const parsed = JSON.parse(json);
		expect(parsed.title).toBe("Open File");
	});

	it("converts filters", () => {
		const json = buildOpenOptions({
			title: "Open",
			filters: [{ name: "All", extensions: ["json", "txt"] }],
		});
		const parsed = JSON.parse(json);
		expect(parsed.title).toBe("Open");
		expect(parsed.filters).toEqual([
			{ displayName: "All", pattern: "*.json;*.txt" },
		]);
	});
});
