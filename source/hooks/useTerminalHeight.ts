import { useState, useEffect } from "react";
import { useStdout } from "ink";

export default function useTerminalHeight(): number {
	const { stdout } = useStdout();
	const [terminalHeight, setTerminalHeight] = useState(stdout.rows || 24);

	useEffect(() => {
		const handleResize = () => {
			setTerminalHeight(stdout.rows || 24);
		};
		stdout.on("resize", handleResize);
		return () => {
			stdout.off("resize", handleResize);
		};
	}, [stdout]);

	return terminalHeight;
}
