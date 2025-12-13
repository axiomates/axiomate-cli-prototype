import type { SlashCommand } from "../components/AutocompleteInput.js";

// 斜杠命令列表
export const SLASH_COMMANDS: SlashCommand[] = [
	{ name: "help", description: "Show available commands" },
	{ name: "clear", description: "Clear the screen" },
	{ name: "exit", description: "Exit the application" },
	{ name: "version", description: "Show version information" },
	{ name: "config", description: "Show configuration" },
	{ name: "status", description: "Show current status" },
];
