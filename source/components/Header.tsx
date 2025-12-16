import { Box, Text } from "ink";

export default function Header() {
	return (
		<Box flexShrink={0}>
			<Text>
				<Text color="#ff69b4" bold>
					axiomate-cli
				</Text>
				<Text color="gray"> - Type </Text>
				<Text color="#ffff00">help</Text>
				<Text color="gray"> for commands, </Text>
				<Text color="#ffff00">Tab</Text>
				<Text color="gray"> to autocomplete, </Text>
				<Text color="#ffff00">?</Text>
				<Text color="gray"> for shortcuts</Text>
			</Text>
		</Box>
	);
}
