import * as fs from "node:fs";
import * as path from "node:path";

/**
 * 日志级别
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

/**
 * 日志条目
 */
type LogEntry = {
	time: string;
	level: LogLevel;
	msg: string;
	[key: string]: unknown;
};

/**
 * LogWriter 配置
 */
type LogWriterConfig = {
	basePath: string; // 日志目录
	baseName: string; // 文件基础名 (如 "app")
	maxFileSize: number; // 单文件最大字节数
	maxDays: number; // 最大保留天数
};

const DEFAULT_CONFIG: Omit<LogWriterConfig, "basePath"> = {
	baseName: "axiomate-cli",
	maxFileSize: 10 * 1024 * 1024, // 10MB
	maxDays: 1,
};

/**
 * 异步日志写入器
 *
 * 特性：
 * - 异步队列写入，不阻塞主线程
 * - 每次 appendFile，不占有文件句柄
 * - 支持日期 + 大小双重轮转
 * - 所有错误静默处理
 */
export class LogWriter {
	private config: LogWriterConfig;
	private queue: LogEntry[] = [];
	private processing = false;
	private currentDate = "";
	private currentFileIndex = 0;
	private currentFileSize = 0;
	private initialized = false;

	constructor(basePath: string, options?: Partial<Omit<LogWriterConfig, "basePath">>) {
		this.config = {
			basePath,
			...DEFAULT_CONFIG,
			...options,
		};
	}

	/**
	 * 写入日志
	 */
	write(level: LogLevel, msg: string, data?: object): void {
		const entry: LogEntry = {
			time: new Date().toISOString(),
			level,
			msg,
			...data,
		};

		this.queue.push(entry);
		this.scheduleProcess();
	}

	/**
	 * 调度队列处理
	 */
	private scheduleProcess(): void {
		if (this.processing) return;

		// 使用 setImmediate 异步处理，不阻塞当前调用
		setImmediate(() => {
			this.processQueue().catch(() => {
				// 静默失败
			});
		});
	}

	/**
	 * 处理队列
	 */
	private async processQueue(): Promise<void> {
		if (this.processing || this.queue.length === 0) return;

		this.processing = true;
		try {
			// 确保目录存在（首次写入时）
			if (!this.initialized) {
				await this.ensureDirectory();
				await this.initCurrentFile();
				this.initialized = true;
			}

			// 批量处理队列中的所有条目
			while (this.queue.length > 0) {
				const entry = this.queue.shift()!;
				await this.writeEntry(entry);
			}

			// 清理旧文件（低频执行）
			await this.cleanOldFiles();
		} catch {
			// 静默失败，不影响主程序
		} finally {
			this.processing = false;

			// 如果处理期间有新条目入队，继续处理
			if (this.queue.length > 0) {
				this.scheduleProcess();
			}
		}
	}

	/**
	 * 确保日志目录存在
	 */
	private async ensureDirectory(): Promise<void> {
		try {
			await fs.promises.mkdir(this.config.basePath, { recursive: true });
		} catch {
			// 目录可能已存在，忽略错误
		}
	}

	/**
	 * 初始化当前文件状态
	 */
	private async initCurrentFile(): Promise<void> {
		const today = this.getDateString();
		this.currentDate = today;

		// 查找当天最新的日志文件
		try {
			const files = await fs.promises.readdir(this.config.basePath);
			const todayFiles = files
				.filter((f) => f.startsWith(`${this.config.baseName}.${today}`) && f.endsWith(".log"))
				.sort();

			if (todayFiles.length === 0) {
				// 没有当天的文件
				this.currentFileIndex = 0;
				this.currentFileSize = 0;
			} else {
				// 找到最新的文件
				const latestFile = todayFiles[todayFiles.length - 1]!;
				this.currentFileIndex = this.parseFileIndex(latestFile);

				// 获取文件大小
				const filePath = path.join(this.config.basePath, latestFile);
				const stats = await fs.promises.stat(filePath);
				this.currentFileSize = stats.size;

				// 如果已超过大小限制，切换到下一个文件
				if (this.currentFileSize >= this.config.maxFileSize) {
					this.currentFileIndex++;
					this.currentFileSize = 0;
				}
			}
		} catch {
			// 读取失败，使用默认值
			this.currentFileIndex = 0;
			this.currentFileSize = 0;
		}
	}

	/**
	 * 从文件名解析索引
	 */
	private parseFileIndex(filename: string): number {
		// app.2024-12-20.log -> 0
		// app.2024-12-20.1.log -> 1
		const match = filename.match(/\.(\d+)\.log$/);
		if (match) {
			return parseInt(match[1]!, 10);
		}
		return 0;
	}

	/**
	 * 写入单条日志
	 */
	private async writeEntry(entry: LogEntry): Promise<void> {
		try {
			// 检查是否需要轮转
			await this.checkRotation();

			const line = JSON.stringify(entry) + "\n";
			const filePath = this.getLogFilePath();

			// appendFile: 打开 -> 写入 -> 关闭，不持有 fd
			await fs.promises.appendFile(filePath, line, "utf-8");

			this.currentFileSize += Buffer.byteLength(line, "utf-8");
		} catch {
			// 静默失败
		}
	}

	/**
	 * 检查是否需要轮转
	 */
	private async checkRotation(): Promise<void> {
		const today = this.getDateString();

		// 日期变化：重置索引
		if (today !== this.currentDate) {
			this.currentDate = today;
			this.currentFileIndex = 0;
			this.currentFileSize = 0;
			return;
		}

		// 大小超限：递增索引
		if (this.currentFileSize >= this.config.maxFileSize) {
			this.currentFileIndex++;
			this.currentFileSize = 0;
		}
	}

	/**
	 * 获取当前日志文件路径
	 */
	private getLogFilePath(): string {
		const { basePath, baseName } = this.config;
		if (this.currentFileIndex === 0) {
			// app.2024-12-20.log
			return path.join(basePath, `${baseName}.${this.currentDate}.log`);
		}
		// app.2024-12-20.1.log
		return path.join(basePath, `${baseName}.${this.currentDate}.${this.currentFileIndex}.log`);
	}

	/**
	 * 获取日期字符串 (YYYY-MM-DD)
	 */
	private getDateString(): string {
		const now = new Date();
		const year = now.getFullYear();
		const month = String(now.getMonth() + 1).padStart(2, "0");
		const day = String(now.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}

	/**
	 * 清理过期的日志文件
	 */
	private async cleanOldFiles(): Promise<void> {
		try {
			const cutoffDate = new Date();
			cutoffDate.setDate(cutoffDate.getDate() - this.config.maxDays);
			const cutoffStr = this.formatDate(cutoffDate);

			const files = await fs.promises.readdir(this.config.basePath);
			const logFiles = files.filter(
				(f) => f.startsWith(this.config.baseName + ".") && f.endsWith(".log"),
			);

			for (const file of logFiles) {
				const dateMatch = file.match(/\.(\d{4}-\d{2}-\d{2})/);
				if (dateMatch && dateMatch[1]! < cutoffStr) {
					const filePath = path.join(this.config.basePath, file);
					await fs.promises.unlink(filePath);
				}
			}
		} catch {
			// 清理失败不影响日志写入
		}
	}

	/**
	 * 格式化日期为 YYYY-MM-DD
	 */
	private formatDate(date: Date): string {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	}
}
