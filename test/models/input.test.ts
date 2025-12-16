import { describe, expect, it } from "vitest";
import {
	isMessageInput,
	isCommandInput,
	createMessageInput,
	createCommandInput,
	type MessageInput,
	type CommandInput,
} from "../../source/models/input.js";

describe("models/input", () => {
	describe("isMessageInput", () => {
		it("returns true for message input", () => {
			const input: MessageInput = { type: "message", content: "hello" };
			expect(isMessageInput(input)).toBe(true);
		});

		it("returns false for command input", () => {
			const input: CommandInput = {
				type: "command",
				command: ["help"],
				raw: "/help",
			};
			expect(isMessageInput(input)).toBe(false);
		});
	});

	describe("isCommandInput", () => {
		it("returns true for command input", () => {
			const input: CommandInput = {
				type: "command",
				command: ["help"],
				raw: "/help",
			};
			expect(isCommandInput(input)).toBe(true);
		});

		it("returns false for message input", () => {
			const input: MessageInput = { type: "message", content: "hello" };
			expect(isCommandInput(input)).toBe(false);
		});
	});

	describe("createMessageInput", () => {
		it("creates a message input with content", () => {
			const result = createMessageInput("hello world");
			expect(result).toEqual({
				type: "message",
				content: "hello world",
			});
		});

		it("creates a message input with empty content", () => {
			const result = createMessageInput("");
			expect(result).toEqual({
				type: "message",
				content: "",
			});
		});
	});

	describe("createCommandInput", () => {
		it("creates a command input with single command", () => {
			const result = createCommandInput(["help"], "/help");
			expect(result).toEqual({
				type: "command",
				command: ["help"],
				raw: "/help",
			});
		});

		it("creates a command input with nested command", () => {
			const result = createCommandInput(
				["model", "openai", "gpt-4"],
				"/model openai gpt-4",
			);
			expect(result).toEqual({
				type: "command",
				command: ["model", "openai", "gpt-4"],
				raw: "/model openai gpt-4",
			});
		});
	});

});
