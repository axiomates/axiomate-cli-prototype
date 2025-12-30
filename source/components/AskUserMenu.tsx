/**
 * AskUserMenu component
 * Displays a question with predefined options and custom input option
 * Used when AI invokes the ask_user tool
 *
 * 参考 SlashMenu 的实现方式，使用纯展示 + 独立键盘处理
 */

import { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { t } from "../i18n/index.js";

type AskUserMenuProps = {
	/** The question to display */
	question: string;
	/** Predefined options */
	options: string[];
	/** Callback when user selects an option or enters custom input */
	onSelect: (answer: string) => void;
	/** Callback when user cancels (Escape) */
	onCancel?: () => void;
	/** Terminal width */
	columns: number;
};

export function AskUserMenu({
	question,
	options,
	onSelect,
	onCancel,
	columns,
}: AskUserMenuProps) {
	// Add custom input option at the end
	const customInputLabel = t("askUser.customInput");
	const allOptions = options.length > 0
		? [...options, customInputLabel]
		: [customInputLabel];

	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isCustomInputMode, setIsCustomInputMode] = useState(false);
	const [customInputValue, setCustomInputValue] = useState("");

	// Handle option selection
	const handleSelect = useCallback(() => {
		if (selectedIndex === allOptions.length - 1) {
			// User selected "Custom input..."
			setIsCustomInputMode(true);
		} else {
			// User selected a predefined option
			onSelect(options[selectedIndex] ?? "");
		}
	}, [selectedIndex, allOptions.length, options, onSelect]);

	// Handle custom input submit
	const handleCustomInputSubmit = useCallback(() => {
		if (customInputValue.trim()) {
			onSelect(customInputValue.trim());
		}
	}, [customInputValue, onSelect]);

	// Handle custom input cancel (back to options)
	const handleCustomInputCancel = useCallback(() => {
		setIsCustomInputMode(false);
		setCustomInputValue("");
	}, []);

	// Keyboard input handling
	useInput(
		(input, key) => {
			if (isCustomInputMode) {
				// In custom input mode
				if (key.escape) {
					handleCustomInputCancel();
				} else if (key.return) {
					handleCustomInputSubmit();
				} else if (key.backspace || key.delete) {
					setCustomInputValue((v) => v.slice(0, -1));
				} else if (input && !key.ctrl && !key.meta) {
					// Regular character input
					setCustomInputValue((v) => v + input);
				}
				return;
			}

			// Navigation in options list
			if (key.upArrow) {
				setSelectedIndex((i) =>
					i === 0 ? allOptions.length - 1 : i - 1,
				);
			} else if (key.downArrow) {
				setSelectedIndex((i) =>
					i === allOptions.length - 1 ? 0 : i + 1,
				);
			} else if (key.return) {
				handleSelect();
			} else if (key.escape) {
				onCancel?.();
			}
		},
		{ isActive: true },
	);

	// Window logic: show at most 9 options
	const maxVisible = 9;
	let startIndex = 0;
	if (selectedIndex >= maxVisible) {
		startIndex = selectedIndex - maxVisible + 1;
	}
	const endIndex = Math.min(allOptions.length, startIndex + maxVisible);
	const visibleOptions = allOptions.slice(startIndex, endIndex);
	const hasMoreBefore = startIndex > 0;
	const hasMoreAfter = endIndex < allOptions.length;

	return (
		<Box flexDirection="column">
			{/* Divider */}
			<Text color="gray">{"─".repeat(columns)}</Text>

			{/* Question */}
			<Box>
				<Text color="cyan" bold>? {question}</Text>
			</Box>

			{isCustomInputMode ? (
				/* Custom input mode */
				<Box>
					<Text color="gray">{"  > "}</Text>
					<Text>{customInputValue}</Text>
					<Text color="gray">█</Text>
				</Box>
			) : (
				/* Options list - following SlashMenu pattern */
				<>
					{/* More before indicator */}
					{hasMoreBefore && (
						<Box>
							<Text dimColor>{"  "}↑ {startIndex} more</Text>
						</Box>
					)}

					{/* Options */}
					{visibleOptions.map((option, visibleIndex) => {
						const actualIndex = startIndex + visibleIndex;
						const isSelected = actualIndex === selectedIndex;
						const isCustomOption = actualIndex === allOptions.length - 1;

						return (
							<Box key={actualIndex}>
								<Text
									backgroundColor={isSelected ? "blue" : undefined}
									color={isSelected ? "white" : isCustomOption ? "gray" : undefined}
								>
									{"  "}
									{isSelected ? "▸ " : "  "}
									{option}
								</Text>
							</Box>
						);
					})}

					{/* More after indicator */}
					{hasMoreAfter && (
						<Box>
							<Text dimColor>{"  "}↓ {allOptions.length - endIndex} more</Text>
						</Box>
					)}
				</>
			)}

			{/* Hints */}
			<Box>
				<Text dimColor>
					{isCustomInputMode
						? t("askUser.customInputHint")
						: t("askUser.navigationHint")}
				</Text>
			</Box>
		</Box>
	);
}
