import { type BackendPort, unavailableBackendPort } from "./port";

/** 创建不接触 Wails 全局对象的测试后端。 */
export function createFakeBackend(
	overrides: Partial<BackendPort> = {},
): BackendPort {
	return { ...unavailableBackendPort, ...overrides };
}
