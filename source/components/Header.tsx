import { Box, Text } from "ink";

export default function Header() {
	return (
		<Box flexShrink={0}>
			<Text color="#FF69B4" bold>
				axiomate-cli
			</Text>
			<Text color="gray"> - Type </Text>
			<Text color="#FFFF00">help</Text>
			<Text color="gray"> for commands, </Text>
			<Text color="#FFFF00">Tab</Text>
			<Text color="gray"> to autocomplete, </Text>
			<Text color="#FFFF00">?</Text>
			<Text color="gray"> for shortcuts</Text>
		</Box>
	);
}
