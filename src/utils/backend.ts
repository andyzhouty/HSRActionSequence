// Backend bridge for Wails

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

type DialogFilter = {
	name: string;
	extensions: string[];
};

type OpenDialogOptions = {
	defaultPath?: string;
	filters?: DialogFilter[];
	multiple?: boolean;
	title?: string;
};

type SaveDialogOptions = {
	defaultPath?: string;
	filters?: DialogFilter[];
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

function wailsMethodToName(method: string): string {
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
	const json = options
		? JSON.stringify({
				title: options.title,
				defaultFilename: options.defaultPath
					?.split("/")
					.pop()
					?.split("\\")
					.pop(),
				filters: options.filters?.map((f) => ({
					displayName: f.name,
					pattern: f.extensions.map((e) => `*.${e}`).join(";"),
				})),
			})
		: "";
	return app.SaveFileDialog(json);
}

export async function open(
	options?: OpenDialogOptions,
): Promise<string | null> {
	const app = window?.go?.main?.App;
	if (!app?.OpenFileDialog) return null;
	const json = options
		? JSON.stringify({
				title: options.title,
				filters: options.filters?.map((f) => ({
					displayName: f.name,
					pattern: f.extensions.map((e) => `*.${e}`).join(";"),
				})),
			})
		: "";
	return app.OpenFileDialog(json);
}
