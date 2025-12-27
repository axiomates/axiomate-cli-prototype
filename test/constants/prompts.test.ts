import { describe, it, expect } from "vitest";
import {
	buildSystemPrompt,
	SYSTEM_PROMPT,
} from "../../source/constants/prompts.js";

describe("prompts", () => {
	describe("SYSTEM_PROMPT", () => {
		it("should export base system prompt", () => {
			expect(typeof SYSTEM_PROMPT).toBe("string");
			expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
		});

		it("should contain AI assistant context", () => {
			expect(SYSTEM_PROMPT).toContain("AI programming assistant");
		});

		it("should contain tool usage guidelines", () => {
			expect(SYSTEM_PROMPT).toContain("Tool Usage");
		});

		it("should contain code guidelines", () => {
			expect(SYSTEM_PROMPT).toContain("Code Guidelines");
		});
	});

	describe("buildSystemPrompt", () => {
		it("should return base prompt when cwd is not provided", () => {
			const result = buildSystemPrompt();
			expect(result).toBe(SYSTEM_PROMPT);
		});

		it("should return base prompt when cwd is undefined", () => {
			const result = buildSystemPrompt(undefined);
			expect(result).toBe(SYSTEM_PROMPT);
		});

		it("should return base prompt when cwd is empty string", () => {
			const result = buildSystemPrompt("");
			expect(result).toBe(SYSTEM_PROMPT);
		});

		it("should include cwd in prompt when provided", () => {
			const result = buildSystemPrompt("/path/to/project");
			expect(result).toContain("/path/to/project");
			expect(result).toContain("Working directory");
		});

		it("should include project type when provided", () => {
			const result = buildSystemPrompt("/path/to/project", "nodejs");
			expect(result).toContain("nodejs");
			expect(result).toContain("Project type");
		});

		it("should show unknown project type when not provided", () => {
			const result = buildSystemPrompt("/path/to/project");
			expect(result).toContain("unknown");
		});

		it("should include Current Environment section", () => {
			const result = buildSystemPrompt("/path/to/project", "python");
			expect(result).toContain("Current Environment");
		});

		it("should append context to base prompt", () => {
			const result = buildSystemPrompt("/path/to/project", "typescript");
			expect(result.startsWith(SYSTEM_PROMPT)).toBe(true);
			expect(result.length).toBeGreaterThan(SYSTEM_PROMPT.length);
		});
	});
});
