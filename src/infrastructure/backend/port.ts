export type BackendDialogFilter = {
	name: string;
	extensions: string[];
};

export type BackendOpenOptions = {
	defaultPath?: string;
	filters?: BackendDialogFilter[];
	multiple?: boolean;
	title?: string;
};

export type BackendSaveOptions = {
	defaultPath?: string;
	filters?: BackendDialogFilter[];
	title?: string;
};

/** 前端依赖的最小后端能力；Wails 只是该端口的一种实现。 */
export type BackendPort = {
	invoke<T = string>(
		method: string,
		args?: Record<string, unknown>,
	): Promise<T>;
	save(options?: BackendSaveOptions): Promise<string | null>;
	open(options?: BackendOpenOptions): Promise<string | null>;
};

/** 在纯浏览器和单元测试中使用的不可用实现。 */
export const unavailableBackendPort: BackendPort = {
	async invoke() {
		throw new Error("后端运行时不可用");
	},
	async save() {
		return null;
	},
	async open() {
		return null;
	},
};
