import { useState, useEffect } from "react";
import { useStdout } from "ink";

export default function useTerminalWidth(): number {
	const { stdout } = useStdout();
	const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 80);

	useEffect(() => {
		const handleResize = () => {
			setTerminalWidth(stdout.columns || 80);
		};

		stdout.on("resize", handleResize);
		return () => {
			stdout.off("resize", handleResize);
		};
	}, [stdout]);

	return terminalWidth;
}