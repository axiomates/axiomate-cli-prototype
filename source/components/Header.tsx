import { Box, Text } from "ink";

export default function Header() {
	return (
		<Box flexShrink={0}>
			<Text color="magenta" bold>
				axiomate-cli
			</Text>
			<Text color="gray"> - Type </Text>
			<Text color="yellow">help</Text>
			<Text color="gray"> for commands, </Text>
			<Text color="yellow">Tab</Text>
			<Text color="gray"> to autocomplete, </Text>
			<Text color="yellow">?</Text>
			<Text color="gray"> for shortcuts</Text>
		</Box>
	);
}
