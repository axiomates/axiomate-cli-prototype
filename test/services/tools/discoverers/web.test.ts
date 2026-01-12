import { describe, it, expect } from "vitest";
import { detectWebFetch } from "../../../../source/services/tools/discoverers/web.js";

describe("web discoverer", () => {
	describe("detectWebFetch", () => {
		it("should return builtin web fetch tool", async () => {
			const tool = await detectWebFetch();

			expect(tool.id).toBe("a-c-web");
			expect(tool.name).toBe("Web Fetch");
			expect(tool.installed).toBe(true);
			expect(tool.executablePath).toBe("builtin");
			expect(tool.version).toBe("1.0.0");
		});

		it("should have fetch action with url parameter", async () => {
			const tool = await detectWebFetch();

			expect(tool.actions).toHaveLength(1);
			expect(tool.actions[0].name).toBe("fetch");
			expect(tool.actions[0].parameters).toHaveLength(1);
			expect(tool.actions[0].parameters[0].name).toBe("url");
			expect(tool.actions[0].parameters[0].required).toBe(true);
		});

		it("should have web category and execute capability", async () => {
			const tool = await detectWebFetch();

			expect(tool.category).toBe("web");
			expect(tool.capabilities).toContain("execute");
		});
	});
});
