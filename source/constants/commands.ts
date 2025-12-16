import type { SlashCommand } from "../components/AutocompleteInput.js";

// 斜杠命令列表
export const SLASH_COMMANDS: SlashCommand[] = [
	{ name: "help", description: "Show available commands" },
	{ name: "clear", description: "Clear the screen" },
	{ name: "exit", description: "Exit the application" },
	{ name: "version", description: "Show version information" },
	{ name: "config", description: "Show configuration" },
	{ name: "status", description: "Show current status" },
	{
		name: "model",
		description: "Select AI model",
		children: [
			{
				name: "openai",
				description: "OpenAI models",
				children: [
					{ name: "gpt-4o", description: "GPT-4o (recommended)" },
					{ name: "gpt-4", description: "GPT-4" },
					{ name: "gpt-4-turbo", description: "GPT-4 Turbo" },
					{ name: "gpt-3.5-turbo", description: "GPT-3.5 Turbo" },
				],
			},
			{
				name: "qwen",
				description: "Qwen models",
				children: [
					{ name: "qwen-72b", description: "Qwen 72B" },
					{ name: "qwen-14b", description: "Qwen 14B" },
					{ name: "qwen-7b", description: "Qwen 7B" },
				],
			},
			{
				name: "claude",
				description: "Anthropic Claude models",
				children: [
					{ name: "claude-3-opus", description: "Claude 3 Opus" },
					{ name: "claude-3-sonnet", description: "Claude 3 Sonnet" },
					{ name: "claude-3-haiku", description: "Claude 3 Haiku" },
				],
			},
			{ name: "deepseek-v3", description: "DeepSeek V3" },
			{ name: "llama-3.3-70b", description: "Llama 3.3 70B" },
		],
	},
];
