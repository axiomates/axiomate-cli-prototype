import { describe, it, expect, beforeAll } from "vitest";
import {
	groupMessages,
	countGroupLines,
	generateGroupHeaderParts,
	canCollapse,
	type MessageGroup,
} from "../../source/models/messageGroup.js";
import type { Message } from "../../source/components/MessageOutput.js";
import { initI18n, setLocale } from "../../source/i18n/index.js";

beforeAll(() => {
	initI18n();
	setLocale("zh-CN");
});

describe("messageGroup", () => {
	// =============================================================================
	// groupMessages
	// =============================================================================
	describe("groupMessages", () => {
		describe("空消息和基础情况", () => {
			it("应返回空数组当输入为空", () => {
				const groups = groupMessages([]);
				expect(groups).toEqual([]);
			});

			it("应为单个用户消息创建一个组", () => {
				const messages: Message[] = [{ content: "Hello", type: "user" }];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.id).toBe("group-0");
				expect(groups[0]!.userMessage?.content).toBe("Hello");
				expect(groups[0]!.responses).toHaveLength(0);
				expect(groups[0]!.isLast).toBe(true);
				expect(groups[0]!.hasStreaming).toBe(false);
				expect(groups[0]!.startIndex).toBe(0);
				expect(groups[0]!.endIndex).toBe(1);
			});
		});

		describe("用户消息和响应分组", () => {
			it("应将用户消息与后续响应分组", () => {
				const messages: Message[] = [
					{ content: "Hello", type: "user" },
					{ content: "Hi there!" },
					{ content: "How can I help?", type: "system" },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.userMessage?.content).toBe("Hello");
				expect(groups[0]!.responses).toHaveLength(2);
				expect(groups[0]!.responses[0]!.content).toBe("Hi there!");
				expect(groups[0]!.responses[1]!.content).toBe("How can I help?");
				expect(groups[0]!.endIndex).toBe(3);
			});

			it("应为多个用户消息创建多个组", () => {
				const messages: Message[] = [
					{ content: "First question", type: "user" },
					{ content: "First answer" },
					{ content: "Second question", type: "user" },
					{ content: "Second answer" },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(2);
				// 第一组
				expect(groups[0]!.id).toBe("group-0");
				expect(groups[0]!.userMessage?.content).toBe("First question");
				expect(groups[0]!.responses[0]!.content).toBe("First answer");
				expect(groups[0]!.isLast).toBe(false);
				expect(groups[0]!.startIndex).toBe(0);
				expect(groups[0]!.endIndex).toBe(2);

				// 第二组
				expect(groups[1]!.id).toBe("group-2");
				expect(groups[1]!.userMessage?.content).toBe("Second question");
				expect(groups[1]!.responses[0]!.content).toBe("Second answer");
				expect(groups[1]!.isLast).toBe(true);
				expect(groups[1]!.startIndex).toBe(2);
				expect(groups[1]!.endIndex).toBe(4);
			});

			it("应正确处理三个连续用户消息", () => {
				const messages: Message[] = [
					{ content: "Q1", type: "user" },
					{ content: "Q2", type: "user" },
					{ content: "Q3", type: "user" },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(3);
				expect(groups[0]!.userMessage?.content).toBe("Q1");
				expect(groups[0]!.responses).toHaveLength(0);
				expect(groups[1]!.userMessage?.content).toBe("Q2");
				expect(groups[1]!.responses).toHaveLength(0);
				expect(groups[2]!.userMessage?.content).toBe("Q3");
				expect(groups[2]!.responses).toHaveLength(0);
				expect(groups[2]!.isLast).toBe(true);
			});

			it("应处理多个连续响应", () => {
				const messages: Message[] = [
					{ content: "Question", type: "user" },
					{ content: "Part 1" },
					{ content: "Part 2" },
					{ content: "Part 3" },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.responses).toHaveLength(3);
				expect(groups[0]!.endIndex).toBe(4);
			});
		});

		describe("系统消息处理", () => {
			it("应处理没有用户消息的系统消息", () => {
				const messages: Message[] = [
					{ content: "Welcome!", type: "system" },
					{ content: "Question", type: "user" },
					{ content: "Answer" },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(2);
				// 第一组：无用户消息的系统消息
				expect(groups[0]!.id).toBe("group-0");
				expect(groups[0]!.userMessage).toBeNull();
				expect(groups[0]!.responses).toHaveLength(1);
				expect(groups[0]!.responses[0]!.content).toBe("Welcome!");
				expect(groups[0]!.startIndex).toBe(0);
				expect(groups[0]!.endIndex).toBe(1);

				// 第二组：用户 + 回答
				expect(groups[1]!.userMessage?.content).toBe("Question");
			});

			it("应处理单独的系统消息", () => {
				const messages: Message[] = [{ content: "System info", type: "system" }];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.userMessage).toBeNull();
				expect(groups[0]!.responses).toHaveLength(1);
				expect(groups[0]!.isLast).toBe(true);
			});

			it("应处理多个系统消息后跟用户消息", () => {
				const messages: Message[] = [
					{ content: "System 1", type: "system" },
					{ content: "System 2", type: "system" },
					{ content: "Question", type: "user" },
					{ content: "Answer" },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(2);
				// 第一组包含两个系统消息
				expect(groups[0]!.userMessage).toBeNull();
				expect(groups[0]!.responses).toHaveLength(2);
				expect(groups[0]!.responses[0]!.content).toBe("System 1");
				expect(groups[0]!.responses[1]!.content).toBe("System 2");
				expect(groups[0]!.endIndex).toBe(2);

				// 第二组
				expect(groups[1]!.userMessage?.content).toBe("Question");
			});
		});

		describe("流式消息处理", () => {
			it("应跟踪组中的流式状态", () => {
				const messages: Message[] = [
					{ content: "Question", type: "user" },
					{ content: "Answering...", streaming: true },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.hasStreaming).toBe(true);
			});

			it("应处理无用户消息时的流式响应", () => {
				const messages: Message[] = [
					{ content: "Streaming system...", type: "system", streaming: true },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.userMessage).toBeNull();
				expect(groups[0]!.hasStreaming).toBe(true);
			});

			it("应处理非流式响应后跟流式响应", () => {
				const messages: Message[] = [
					{ content: "Question", type: "user" },
					{ content: "Part 1", streaming: false },
					{ content: "Part 2", streaming: true },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.hasStreaming).toBe(true);
			});

			it("应处理显式 streaming: false 的响应", () => {
				const messages: Message[] = [
					{ content: "Question", type: "user" },
					{ content: "Answer", streaming: false },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.hasStreaming).toBe(false);
			});
		});

		describe("索引跟踪", () => {
			it("应设置正确的 startIndex 和 endIndex", () => {
				const messages: Message[] = [
					{ content: "Q1", type: "user" },
					{ content: "A1" },
					{ content: "Q2", type: "user" },
					{ content: "A2" },
					{ content: "A2 continued" },
				];
				const groups = groupMessages(messages);

				expect(groups[0]!.startIndex).toBe(0);
				expect(groups[0]!.endIndex).toBe(2);

				expect(groups[1]!.startIndex).toBe(2);
				expect(groups[1]!.endIndex).toBe(5);
			});

			it("应为用户消息后没有响应正确设置 endIndex", () => {
				const messages: Message[] = [{ content: "Q", type: "user" }];
				const groups = groupMessages(messages);

				expect(groups[0]!.startIndex).toBe(0);
				expect(groups[0]!.endIndex).toBe(1);
			});
		});

		describe("边界情况", () => {
			it("应处理空内容消息", () => {
				const messages: Message[] = [
					{ content: "", type: "user" },
					{ content: "" },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.userMessage?.content).toBe("");
				expect(groups[0]!.responses[0]!.content).toBe("");
			});

			it("应处理只有非用户消息（无类型）的情况", () => {
				const messages: Message[] = [
					{ content: "Response 1" },
					{ content: "Response 2" },
				];
				const groups = groupMessages(messages);

				expect(groups).toHaveLength(1);
				expect(groups[0]!.userMessage).toBeNull();
				expect(groups[0]!.responses).toHaveLength(2);
			});
		});
	});

	// =============================================================================
	// countGroupLines
	// =============================================================================
	describe("countGroupLines", () => {
		it("应计算组中的行数", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 2,
				userMessage: { content: "Line 1\nLine 2", type: "user" },
				responses: [{ content: "Line 3\nLine 4\nLine 5" }],
				isLast: false,
				hasStreaming: false,
			};

			expect(countGroupLines(group)).toBe(5);
		});

		it("应处理没有用户消息的组", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: null,
				responses: [{ content: "Single line" }],
				isLast: false,
				hasStreaming: false,
			};

			expect(countGroupLines(group)).toBe(1);
		});

		it("应处理多个响应", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 3,
				userMessage: { content: "Q", type: "user" },
				responses: [{ content: "A1\nA1-2" }, { content: "A2" }],
				isLast: false,
				hasStreaming: false,
			};

			// Q (1) + A1\nA1-2 (2) + A2 (1) = 4 lines
			// 但实际是连接后计算: "Q\nA1\nA1-2\nA2" = 4 行
			expect(countGroupLines(group)).toBe(4);
		});

		it("应处理空响应数组", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: { content: "Question", type: "user" },
				responses: [],
				isLast: false,
				hasStreaming: false,
			};

			expect(countGroupLines(group)).toBe(1);
		});

		it("应处理无用户消息且无响应的组", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 0,
				userMessage: null,
				responses: [],
				isLast: false,
				hasStreaming: false,
			};

			// 空数组 join 后是空字符串，split("\n") 得到 [""]，长度为 1
			expect(countGroupLines(group)).toBe(1);
		});

		it("应正确处理多行内容", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 2,
				userMessage: { content: "Line1\nLine2\nLine3", type: "user" },
				responses: [{ content: "R1\nR2" }],
				isLast: false,
				hasStreaming: false,
			};

			// 3 + 2 = 5
			expect(countGroupLines(group)).toBe(5);
		});
	});

	// =============================================================================
	// generateGroupHeaderParts - 通过此函数间接测试 truncateText
	// =============================================================================
	describe("generateGroupHeaderParts", () => {
		describe("箭头状态", () => {
			it("应在折叠时显示 ▶ 箭头", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "Question", type: "user" },
					responses: [{ content: "Answer" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.arrow).toBe("▶");
			});

			it("应在展开时显示 ▼ 箭头", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "Question", type: "user" },
					responses: [{ content: "Answer" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, false);
				expect(parts.arrow).toBe("▼");
			});
		});

		describe("用户预览", () => {
			it("应为系统消息组显示 (系统)", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 1,
					userMessage: null,
					responses: [{ content: "System notification" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toBe("(系统)");
			});

			it("应显示用户消息内容", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "What is TypeScript?", type: "user" },
					responses: [{ content: "TypeScript is a language." }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toContain("TypeScript");
			});
		});

		describe("文本截断 (truncateText)", () => {
			it("应截断过长文本并添加省略号", () => {
				const longText = "A".repeat(200);
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: longText, type: "user" },
					responses: [{ content: longText }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview.length).toBeLessThan(50);
				expect(parts.userPreview.endsWith("...")).toBe(true);
			});

			it("应只取第一行（移除换行）", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "First line\nSecond line", type: "user" },
					responses: [{ content: "Response" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toBe("First line");
				expect(parts.userPreview).not.toContain("Second");
			});

			it("应移除 Markdown 标题符号", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "# Heading Title", type: "user" },
					responses: [{ content: "Response" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toBe("Heading Title");
				expect(parts.userPreview).not.toContain("#");
			});

			it("应移除多级 Markdown 标题符号", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "### Level 3 Heading", type: "user" },
					responses: [{ content: "Response" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toBe("Level 3 Heading");
			});

			it("应移除 Markdown 加粗格式", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "This is **bold** text", type: "user" },
					responses: [{ content: "Response" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toBe("This is bold text");
			});

			it("应移除 Markdown 斜体格式", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "This is *italic* text", type: "user" },
					responses: [{ content: "Response" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toBe("This is italic text");
			});

			it("应移除 Markdown 代码格式", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "Use `code` here", type: "user" },
					responses: [{ content: "Response" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toBe("Use code here");
			});

			it("应处理空第一行的情况", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "\nSecond line", type: "user" },
					responses: [{ content: "Response" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toBe("");
			});

			it("应处理短文本不截断", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "Short", type: "user" },
					responses: [{ content: "Answer" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.userPreview).toBe("Short");
				expect(parts.userPreview.endsWith("...")).toBe(false);
			});
		});

		describe("响应预览", () => {
			it("应显示响应内容预览", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "Question", type: "user" },
					responses: [{ content: "This is the answer" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.responsePreview).toContain("answer");
			});

			it("应为空响应返回空字符串", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 1,
					userMessage: { content: "Question", type: "user" },
					responses: [],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.responsePreview).toBe("");
			});

			it("应只使用第一个响应的内容", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 3,
					userMessage: { content: "Question", type: "user" },
					responses: [
						{ content: "First response" },
						{ content: "Second response" },
					],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.responsePreview).toContain("First");
				expect(parts.responsePreview).not.toContain("Second");
			});
		});

		describe("分隔符", () => {
			it("应返回正确的分隔符", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "Q", type: "user" },
					responses: [{ content: "A" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.separator).toBe("→");
			});
		});

		describe("行数统计", () => {
			it("应返回正确的行数格式", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "Line1\nLine2", type: "user" },
					responses: [{ content: "Response" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.lineCount).toBe("(3 行)");
			});

			it("应正确处理单行", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 1,
					userMessage: { content: "Single", type: "user" },
					responses: [],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 80, true);
				expect(parts.lineCount).toBe("(1 行)");
			});
		});

		describe("宽度处理", () => {
			it("应处理非常小的宽度", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "This is a question", type: "user" },
					responses: [{ content: "This is an answer" }],
					isLast: false,
					hasStreaming: false,
				};

				// 最小宽度被限制为 20
				const parts = generateGroupHeaderParts(group, 10, true);
				expect(parts.arrow).toBe("▶");
				expect(parts.separator).toBe("→");
			});

			it("应处理非常大的宽度", () => {
				const group: MessageGroup = {
					id: "test",
					startIndex: 0,
					endIndex: 2,
					userMessage: { content: "Short question", type: "user" },
					responses: [{ content: "Short answer" }],
					isLast: false,
					hasStreaming: false,
				};

				const parts = generateGroupHeaderParts(group, 200, true);
				expect(parts.userPreview).toBe("Short question");
				expect(parts.responsePreview).toBe("Short answer");
			});
		});
	});

	// =============================================================================
	// canCollapse
	// =============================================================================
	describe("canCollapse", () => {
		it("应返回 true 对于非流式最后一组", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: { content: "Test", type: "user" },
				responses: [{ content: "Answer" }],
				isLast: true,
				hasStreaming: false,
			};

			expect(canCollapse(group)).toBe(true);
		});

		it("应返回 false 对于流式组", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: { content: "Test", type: "user" },
				responses: [{ content: "...", streaming: true }],
				isLast: false,
				hasStreaming: true,
			};

			expect(canCollapse(group)).toBe(false);
		});

		it("应返回 false 对于流式的最后一组", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: { content: "Test", type: "user" },
				responses: [{ content: "...", streaming: true }],
				isLast: true,
				hasStreaming: true,
			};

			expect(canCollapse(group)).toBe(false);
		});

		it("应返回 true 对于普通非流式组", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 2,
				userMessage: { content: "Test", type: "user" },
				responses: [{ content: "Answer" }],
				isLast: false,
				hasStreaming: false,
			};

			expect(canCollapse(group)).toBe(true);
		});

		it("应返回 true 对于没有用户消息的非流式组", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: null,
				responses: [{ content: "System message" }],
				isLast: false,
				hasStreaming: false,
			};

			expect(canCollapse(group)).toBe(true);
		});

		it("应返回 false 对于没有用户消息的流式组", () => {
			const group: MessageGroup = {
				id: "test",
				startIndex: 0,
				endIndex: 1,
				userMessage: null,
				responses: [{ content: "...", streaming: true }],
				isLast: false,
				hasStreaming: true,
			};

			expect(canCollapse(group)).toBe(false);
		});
	});
});
