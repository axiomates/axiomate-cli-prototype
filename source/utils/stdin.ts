/**
 * stdin 输入控制
 *
 * 应用启动时暂停 stdin，防止 Splash 阶段接受输入
 * 等 Welcome/App 组件准备好后再恢复
 */

let isPaused = false;

/**
 * 暂停 stdin 输入
 * 在应用启动时调用，Splash 阶段不接受任何输入
 */
export function pauseInput(): void {
	if (!isPaused) {
		process.stdin.pause();
		isPaused = true;
	}
}

/**
 * 恢复 stdin 输入
 * 在 Welcome/App 组件准备好后调用
 */
export function resumeInput(): void {
	if (isPaused) {
		process.stdin.resume();
		isPaused = false;
	}
}
