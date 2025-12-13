import { useState, useEffect } from "react";
import { useStdout } from "ink";

export default function useTerminalWidth(): number {
	const { stdout } = useStdout();
	const [terminalWidth, setTerminalWidth] = useState(stdout.columns || 80);
	const [, forceUpdate] = useState(0);

	// 直接追踪 stdout.columns 值变化，强制更新确保布局正确
	useEffect(() => {
		setTerminalWidth(stdout.columns || 80);
		forceUpdate((n) => n + 1);
	}, [stdout.columns]);

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