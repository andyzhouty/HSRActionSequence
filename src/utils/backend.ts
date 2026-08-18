// Wails 后端桥接。

import type {
	BackendDialogFilter,
	BackendOpenOptions,
	BackendPort,
	BackendSaveOptions,
} from "../infrastructure/backend/port";

export type {
	BackendDialogFilter,
	BackendOpenOptions,
	BackendPort,
	BackendSaveOptions,
} from "../infrastructure/backend/port";

declare global {
	interface Window {
		go?: {
			main?: {
				App?: {
					Greet(name: string): Promise<string>;
					ReadTextFile(path: string): Promise<string>;
					WriteTextFile(path: string, contents: string): Promise<void>;
					WritePngFile(path: string, dataUrl: string): Promise<void>;
					WriteBase64File(path: string, dataBase64: string): Promise<void>;
					GetAutosavePath(): Promise<string>;
					SaveFileDialog(optionsJSON: string): Promise<string>;
					OpenFileDialog(optionsJSON: string): Promise<string>;
				};
			};
		};
	}
}

type OpenDialogOptions = {
	defaultPath?: string;
	filters?: BackendDialogFilter[];
	multiple?: boolean;
	title?: string;
};

type SaveDialogOptions = {
	defaultPath?: string;
	filters?: BackendDialogFilter[];
	title?: string;
};

type InvokeArgs = Record<string, unknown>;
type WailsMethod = (...args: unknown[]) => unknown;

async function wailsInvoke(
	method: string,
	args?: InvokeArgs,
): Promise<unknown> {
	const app = window?.go?.main?.App;
	if (!app) throw new Error("Wails runtime not available");
	const fn = (app as unknown as Record<string, WailsMethod>)[method];
	if (!fn) throw new Error(`Method ${method} not found`);
	if (args) {
		const argNames: Record<string, string[]> = {
			Greet: ["name"],
			ReadTextFile: ["path"],
			WriteTextFile: ["path", "contents"],
			WritePngFile: ["path", "dataUrl"],
			WriteBase64File: ["path", "dataBase64"],
			GetAutosavePath: [],
		};
		const names = argNames[method] ?? [];
		const positional = names.map((n) => args[n]);
		return fn(...positional);
	}
	return fn();
}

export function wailsMethodToName(method: string): string {
	const map: Record<string, string> = {
		greet: "Greet",
		read_text_file: "ReadTextFile",
		write_text_file: "WriteTextFile",
		write_png_file: "WritePngFile",
		write_base64_file: "WriteBase64File",
		get_autosave_path: "GetAutosavePath",
	};
	return map[method] ?? method;
}

export function serializeSaveDialogOptions(
	options?: SaveDialogOptions,
): string {
	if (!options) return "";
	return JSON.stringify({
		title: options.title,
		defaultFilename: options.defaultPath?.split("/").pop()?.split("\\").pop(),
		filters: options.filters?.map((filter) => ({
			displayName: filter.name,
			pattern: filter.extensions.map((extension) => `*.${extension}`).join(";"),
		})),
	});
}

export function serializeOpenDialogOptions(
	options?: OpenDialogOptions,
): string {
	if (!options) return "";
	return JSON.stringify({
		title: options.title,
		filters: options.filters?.map((filter) => ({
			displayName: filter.name,
			pattern: filter.extensions.map((extension) => `*.${extension}`).join(";"),
		})),
	});
}

export async function invoke<T = string>(
	method: string,
	args?: InvokeArgs,
): Promise<T> {
	return wailsInvoke(wailsMethodToName(method), args) as Promise<T>;
}

export async function save(
	options?: SaveDialogOptions,
): Promise<string | null> {
	const app = window?.go?.main?.App;
	if (!app?.SaveFileDialog) return null;
	return app.SaveFileDialog(serializeSaveDialogOptions(options));
}

export async function open(
	options?: OpenDialogOptions,
): Promise<string | null> {
	const app = window?.go?.main?.App;
	if (!app?.OpenFileDialog) return null;
	return app.OpenFileDialog(serializeOpenDialogOptions(options));
}

/** 返回 Wails 适配器，调用方可以在测试中替换为 BackendPort fake。 */
export function getBackendPort(): BackendPort {
	return {
		invoke,
		save: save as (options?: BackendSaveOptions) => Promise<string | null>,
		open: open as (options?: BackendOpenOptions) => Promise<string | null>,
	};
}
