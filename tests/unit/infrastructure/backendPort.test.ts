import { describe, expect, it } from "vitest";
import {
	type BackendPort,
	createFakeBackend,
} from "../../../src/infrastructure/backend/testPort";

describe("后端端口", () => {
	it("允许 UI 使用可替换的内存实现", async () => {
		const calls: string[] = [];
		const backend: BackendPort = createFakeBackend({
			invoke: async (method) => {
				calls.push(method);
				return "ok";
			},
		});
		expect(await backend.invoke("read_text_file")).toBe("ok");
		expect(await backend.save()).toBeNull();
		expect(calls).toEqual(["read_text_file"]);
	});
});
