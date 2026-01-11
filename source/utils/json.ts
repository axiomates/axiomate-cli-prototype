/**
 * 稳定的 JSON 序列化工具
 * 确保对象键按字母顺序排序，保证相同数据产生相同的 JSON 字符串
 * 这对于 KV 缓存命中率至关重要
 */

/**
 * 递归排序对象的键
 */
function sortKeys(value: unknown): unknown {
	if (value === null || typeof value !== "object") {
		return value;
	}

	if (Array.isArray(value)) {
		return value.map(sortKeys);
	}

	const sorted: Record<string, unknown> = {};
	const keys = Object.keys(value as Record<string, unknown>).sort();
	for (const key of keys) {
		sorted[key] = sortKeys((value as Record<string, unknown>)[key]);
	}
	return sorted;
}

/**
 * 稳定的 JSON.stringify
 * 确保对象键按字母顺序排序，产生确定性的输出
 *
 * @param value 要序列化的值
 * @param space 缩进空格数（可选）
 * @returns JSON 字符串
 *
 * @example
 * // 普通 JSON.stringify 可能因键顺序不同产生不同结果
 * JSON.stringify({ b: 1, a: 2 }) // '{"b":1,"a":2}' 或 '{"a":2,"b":1}'
 *
 * // stableStringify 总是产生相同结果
 * stableStringify({ b: 1, a: 2 }) // '{"a":2,"b":1}'
 */
export function stableStringify(
	value: unknown,
	space?: number | string,
): string {
	return JSON.stringify(sortKeys(value), null, space);
}
