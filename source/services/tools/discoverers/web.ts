/**
 * Web 工具发现器
 * 提供网页获取功能（内置，不依赖外部命令）
 */

import type { DiscoveredTool } from "../types.js";
import { t } from "../../../i18n/index.js";

/**
 * 创建 Web Fetch 工具
 * 这是一个内置工具，不需要检测外部命令
 */
export async function detectWebFetch(): Promise<DiscoveredTool> {
	return {
		id: "a-c-web",
		name: "Web Fetch",
		description: t("tools.fetchWebDesc"),
		category: "web",
		capabilities: ["execute"],
		executablePath: "builtin",
		version: "1.0.0",
		installed: true,
		actions: [
			{
				name: "fetch",
				description: t("tools.fetchWebActionDesc"),
				commandTemplate: "{{url}}",
				parameters: [
					{
						name: "url",
						description: t("tools.urlParamDesc"),
						type: "string",
						required: true,
					},
				],
			},
		],
	};
}
