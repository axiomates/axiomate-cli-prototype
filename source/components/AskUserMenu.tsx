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
	/** Callback when custom input mode changes */
	onCustomInputModeChange?: (isCustomInput: boolean) => void;
};

export function AskUserMenu({
	question,
	options,
	onSelect,
	onCancel,
	columns,
	onCustomInputModeChange,
}: AskUserMenuProps) {
	// Limit to max 3 options + custom input
	const limitedOptions = options.slice(0, 3);
	const customInputLabel = t("askUser.customInput");
	const allOptions = limitedOptions.length > 0
		? [...limitedOptions, customInputLabel]
		: [customInputLabel];

	const [selectedIndex, setSelectedIndex] = useState(0);
	const [isCustomInputMode, setIsCustomInputMode] = useState(false);
	const [customInputValue, setCustomInputValue] = useState("");

	// Handle option selection
	const handleSelect = useCallback(() => {
		if (selectedIndex === allOptions.length - 1) {
			// User selected "Custom input..."
			setIsCustomInputMode(true);
			onCustomInputModeChange?.(true);
		} else {
			// User selected a predefined option
			onSelect(limitedOptions[selectedIndex] ?? "");
		}
	}, [selectedIndex, allOptions.length, limitedOptions, onSelect, onCustomInputModeChange]);

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
		onCustomInputModeChange?.(false);
	}, [onCustomInputModeChange]);

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
				/* Options list (max 4: 3 options + custom input) */
				<>
					{allOptions.map((option, index) => {
						const isSelected = index === selectedIndex;
						const isCustomOption = index === allOptions.length - 1;

						return (
							<Box key={index}>
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
