import { describe, expect, it } from "vitest";
import {
	serializeOpenDialogOptions,
	serializeSaveDialogOptions,
	wailsMethodToName,
} from "../../../src/utils/backend";

describe("Wails 后端桥接适配器", () => {
	it.each([
		["greet", "Greet"],
		["read_text_file", "ReadTextFile"],
		["write_text_file", "WriteTextFile"],
		["write_png_file", "WritePngFile"],
		["write_base64_file", "WriteBase64File"],
		["get_autosave_path", "GetAutosavePath"],
	])("将 %s 映射为 %s", (method, expected) => {
		expect(wailsMethodToName(method)).toBe(expected);
	});

	it("未知方法和空方法名保持原样", () => {
		expect(wailsMethodToName("unknown_method")).toBe("unknown_method");
		expect(wailsMethodToName("")).toBe("");
	});

	it("序列化保存对话框参数", () => {
		expect(serializeSaveDialogOptions()).toBe("");
		expect(JSON.parse(serializeSaveDialogOptions({}))).toEqual({});
		expect(
			JSON.parse(
				serializeSaveDialogOptions({
					title: "保存文件",
					defaultPath: "C:\\Users\\test\\file.json",
					filters: [
						{ name: "JSON", extensions: ["json"] },
						{ name: "图片", extensions: ["png", "jpg"] },
					],
				}),
			),
		).toEqual({
			title: "保存文件",
			defaultFilename: "file.json",
			filters: [
				{ displayName: "JSON", pattern: "*.json" },
				{ displayName: "图片", pattern: "*.png;*.jpg" },
			],
		});
	});

	it("序列化打开对话框参数", () => {
		expect(serializeOpenDialogOptions()).toBe("");
		expect(
			JSON.parse(
				serializeOpenDialogOptions({
					title: "打开文件",
					filters: [{ name: "文本", extensions: ["json", "txt"] }],
				}),
			),
		).toEqual({
			title: "打开文件",
			filters: [{ displayName: "文本", pattern: "*.json;*.txt" }],
		});
	});
});
