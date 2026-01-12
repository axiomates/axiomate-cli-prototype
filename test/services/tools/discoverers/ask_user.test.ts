import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectAskUser } from "../../../../source/services/tools/discoverers/ask_user.js";

// Mock base module
vi.mock("../../../../source/services/tools/discoverers/base.js", () => ({
	createInstalledTool: vi.fn((def, path, version) => ({
		...def,
		executablePath: path,
		version,
		installed: true,
	})),
}));

import { createInstalledTool } from "../../../../source/services/tools/discoverers/base.js";

describe("ask_user discoverer", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("detectAskUser", () => {
		it("should return an installed tool (always available)", async () => {
			const result = await detectAskUser();

			expect(result.installed).toBe(true);
			expect(result.id).toBe("a-c-askuser");
		});

		it("should have correct tool properties", async () => {
			const result = await detectAskUser();

			expect(result.name).toBe("Ask User");
			expect(result.category).toBe("utility");
			expect(result.capabilities).toContain("execute");
		});

		it("should have ask action with required parameters", async () => {
			const result = await detectAskUser();

			expect(result.actions).toBeDefined();
			expect(result.actions?.length).toBe(1);

			const askAction = result.actions?.[0];
			expect(askAction?.name).toBe("ask");
			expect(askAction?.parameters?.length).toBe(2);

			// Check question parameter
			const questionParam = askAction?.parameters?.find(
				(p) => p.name === "question",
			);
			expect(questionParam).toBeDefined();
			expect(questionParam?.type).toBe("string");
			expect(questionParam?.required).toBe(true);

			// Check options parameter
			const optionsParam = askAction?.parameters?.find(
				(p) => p.name === "options",
			);
			expect(optionsParam).toBeDefined();
			expect(optionsParam?.type).toBe("string");
			expect(optionsParam?.required).toBe(true);
		});

		it("should call createInstalledTool with correct arguments", async () => {
			await detectAskUser();

			expect(createInstalledTool).toHaveBeenCalledWith(
				expect.objectContaining({
					id: "a-c-askuser",
					name: "Ask User",
					category: "utility",
				}),
				"builtin",
				"1.0.0",
			);
		});

		it("should have __ASK_USER__ as command template", async () => {
			const result = await detectAskUser();

			const askAction = result.actions?.[0];
			expect(askAction?.commandTemplate).toBe("__ASK_USER__");
		});
	});
});
