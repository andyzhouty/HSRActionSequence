import "@testing-library/jest-dom/vitest";

// 模式校验：角色数据异常时立即失败。
import { validateCharacterSchema } from "../src/data/characterSchema";

validateCharacterSchema();

// 模拟后端桥接。
vi.mock("../src/utils/backend", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../src/utils/backend")>();
	const invoke = vi.fn();
	const save = vi.fn();
	const open = vi.fn();
	return {
		...actual,
		invoke,
		save,
		open,
		getBackendPort: () => ({ invoke, save, open }),
	};
});
