import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock fs module
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
	readdirSync: vi.fn(),
	mkdirSync: vi.fn(),
	renameSync: vi.fn(),
	unlinkSync: vi.fn(),
}));

const mockRandomUUID = vi.fn(() => "test-uuid-1234");
vi.mock("node:crypto", () => ({
	randomUUID: () => mockRandomUUID(),
}));

vi.mock("../../../source/utils/appdata.js", () => ({
	getSessionsPath: vi.fn(() => "/mock/sessions"),
}));

vi.mock("../../../source/utils/config.js", () => ({
	getCurrentModelId: vi.fn(() => "test-model"),
}));

vi.mock("../../../source/utils/logger.js", () => ({
	logger: {
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		error: vi.fn(),
	},
}));

vi.mock("../../../source/services/ai/session.js", () => ({
	createSession: vi.fn(() => ({
		restoreFromState: vi.fn(),
		getInternalState: vi.fn(() => ({
			messages: [],
			systemPrompt: null,
			actualPromptTokens: 0,
			actualCompletionTokens: 0,
		})),
		getStatus: vi.fn(() => ({
			usedTokens: 0,
			messageCount: 0,
		})),
	})),
}));

import * as fs from "node:fs";
import {
	SessionStore,
	getSessionStore,
	initSessionStore,
	resetSessionStore,
} from "../../../source/services/ai/sessionStore.js";

describe("SessionStore", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		resetSessionStore();
		mockRandomUUID.mockReturnValue("test-uuid-1234");
		vi.mocked(fs.existsSync).mockReturnValue(false);
		vi.mocked(fs.readdirSync).mockReturnValue([]);
	});

	afterEach(() => {
		resetSessionStore();
	});

	describe("constructor", () => {
		it("should create store with context window", () => {
			const store = new SessionStore(4096);
			expect(store.getContextWindow()).toBe(4096);
		});
	});

	describe("initialize", () => {
		it("should create initial session if none exists", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const sessions = store.listSessions();
			expect(sessions).toHaveLength(1);
			expect(store.getActiveSessionId()).toBe("test-uuid-1234");
		});

		it("should load existing sessions from index", async () => {
			const mockIndex = {
				version: 1,
				activeSessionId: "existing-id",
				sessions: [
					{
						id: "existing-id",
						name: "Existing Session",
						createdAt: 1000,
						updatedAt: 2000,
						tokenUsage: 100,
						messageCount: 5,
						modelId: "test-model",
						isActive: true,
					},
				],
			};

			vi.mocked(fs.existsSync).mockImplementation((p) => {
				return typeof p === "string" && p.includes("index.json");
			});
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockIndex));

			const store = new SessionStore(4096);
			await store.initialize();

			const sessions = store.listSessions();
			expect(sessions).toHaveLength(1);
			expect(sessions[0]!.id).toBe("existing-id");
			expect(store.getActiveSessionId()).toBe("existing-id");
		});

		it("should handle corrupted index by rebuilding", async () => {
			vi.mocked(fs.existsSync).mockImplementation((p) => {
				return typeof p === "string" && p.includes("index.json");
			});
			vi.mocked(fs.readFileSync).mockImplementation(() => {
				throw new Error("JSON parse error");
			});
			vi.mocked(fs.readdirSync).mockReturnValue([]);

			const store = new SessionStore(4096);
			await store.initialize();

			// Should create new session after rebuild
			const sessions = store.listSessions();
			expect(sessions).toHaveLength(1);
		});

		it("should not re-initialize if already initialized", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();
			await store.initialize(); // Second call

			// Should still have only one session
			expect(store.listSessions()).toHaveLength(1);
		});
	});

	describe("createSession", () => {
		it("should create new session with default name", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const session = store.createSession();
			expect(session.name).toBe("New Session");
		});

		it("should create session with custom name", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const session = store.createSession("My Custom Session");
			expect(session.name).toBe("My Custom Session");
		});
	});

	describe("getActiveSession", () => {
		it("should return active session", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const active = store.getActiveSession();
			expect(active).not.toBeNull();
			expect(active!.id).toBe("test-uuid-1234");
		});

		it("should return null when no active session", () => {
			const store = new SessionStore(4096);
			expect(store.getActiveSession()).toBeNull();
		});
	});

	describe("getSessionById", () => {
		it("should return session by id", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const session = store.getSessionById("test-uuid-1234");
			expect(session).not.toBeNull();
		});

		it("should return null for non-existent id", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const session = store.getSessionById("non-existent");
			expect(session).toBeNull();
		});
	});

	describe("updateSessionName", () => {
		it("should update session name", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const result = store.updateSessionName("test-uuid-1234", "Updated Name");
			expect(result).toBe(true);

			const session = store.getSessionById("test-uuid-1234");
			expect(session!.name).toBe("Updated Name");
		});

		it("should return false for non-existent session", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const result = store.updateSessionName("non-existent", "New Name");
			expect(result).toBe(false);
		});
	});

	describe("loadSession", () => {
		it("should return null for non-existent session", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const session = await store.loadSession("non-existent");
			expect(session).toBeNull();
		});

		it("should load session from file", async () => {
			const mockSessionData = {
				info: {
					id: "test-uuid-1234",
					name: "Test",
					createdAt: 1000,
					updatedAt: 2000,
					tokenUsage: 0,
					messageCount: 0,
					modelId: "test-model",
					isActive: true,
				},
				messages: [],
				systemPrompt: null,
				tokenState: {
					actualPromptTokens: 0,
					actualCompletionTokens: 0,
				},
			};

			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.readFileSync).mockReturnValue(
				JSON.stringify(mockSessionData),
			);

			const store = new SessionStore(4096);
			// Manually set up the session in store
			store["sessions"].set("test-uuid-1234", mockSessionData.info);

			const session = await store.loadSession("test-uuid-1234");
			expect(session).not.toBeNull();
		});
	});

	describe("deleteSession", () => {
		it("should not delete active session", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const result = store.deleteSession("test-uuid-1234");
			expect(result).toBe(false);
		});

		it("should delete non-active session", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			// Create second session
			mockRandomUUID.mockReturnValue("second-session-id");
			store.createSession("Second Session");

			vi.mocked(fs.existsSync).mockReturnValue(true);
			const result = store.deleteSession("second-session-id");
			expect(result).toBe(true);
		});

		it("should return false for non-existent session", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const result = store.deleteSession("non-existent");
			expect(result).toBe(false);
		});
	});

	describe("setActiveSessionId", () => {
		it("should set active session", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			// Create second session
			mockRandomUUID.mockReturnValue("second-session-id");
			store.createSession("Second Session");

			store.setActiveSessionId("second-session-id");
			expect(store.getActiveSessionId()).toBe("second-session-id");
		});

		it("should not set non-existent session as active", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			store.setActiveSessionId("non-existent");
			expect(store.getActiveSessionId()).toBe("test-uuid-1234");
		});
	});

	describe("updateContextWindow", () => {
		it("should update context window", () => {
			const store = new SessionStore(4096);
			store.updateContextWindow(8192);
			expect(store.getContextWindow()).toBe(8192);
		});
	});

	describe("clearAllSessions", () => {
		it("should clear all sessions and create new one", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			// Create additional sessions
			mockRandomUUID.mockReturnValue("second-session-id");
			store.createSession("Second");

			mockRandomUUID.mockReturnValue("new-session-after-clear");
			vi.mocked(fs.existsSync).mockReturnValue(true);

			const newSession = store.clearAllSessions();

			expect(store.listSessions()).toHaveLength(1);
			expect(newSession.id).toBe("new-session-after-clear");
			expect(store.getActiveSessionId()).toBe("new-session-after-clear");
		});
	});

	describe("generateTitleFromMessage", () => {
		it("should generate title from simple message", () => {
			const title = SessionStore.generateTitleFromMessage("Hello world");
			expect(title).toBe("Hello world");
		});

		it("should take only first line", () => {
			const title = SessionStore.generateTitleFromMessage("First line\nSecond line");
			expect(title).toBe("First line");
		});

		it("should remove file references", () => {
			const title = SessionStore.generateTitleFromMessage("Check @src/app.tsx please");
			expect(title).toBe("Check  please");
		});

		it("should truncate long messages", () => {
			const longMessage = "A".repeat(60);
			const title = SessionStore.generateTitleFromMessage(longMessage);
			expect(title.length).toBeLessThanOrEqual(50);
			expect(title).toContain("...");
		});

		it("should return default for empty result", () => {
			const title = SessionStore.generateTitleFromMessage("@file.txt");
			expect(title).toBe("New Session");
		});
	});

	describe("saveSession", () => {
		it("should save session with info object", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const info = store.getSessionById("test-uuid-1234");
			const mockSession = {
				getInternalState: vi.fn(() => ({
					messages: [{ role: "user", content: "hello" }],
					systemPrompt: null,
					actualPromptTokens: 10,
					actualCompletionTokens: 20,
				})),
				getStatus: vi.fn(() => ({
					usedTokens: 30,
					messageCount: 1,
				})),
			};

			store.saveSession(mockSession as any, info!);

			expect(fs.writeFileSync).toHaveBeenCalled();
		});

		it("should save session with id string", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const mockSession = {
				getInternalState: vi.fn(() => ({
					messages: [],
					systemPrompt: null,
					actualPromptTokens: 0,
					actualCompletionTokens: 0,
				})),
				getStatus: vi.fn(() => ({
					usedTokens: 0,
					messageCount: 0,
				})),
			};

			store.saveSession(mockSession as any, "test-uuid-1234");

			expect(fs.writeFileSync).toHaveBeenCalled();
		});

		it("should not save if session id not found", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const mockSession = {
				getInternalState: vi.fn(),
				getStatus: vi.fn(),
			};

			vi.mocked(fs.writeFileSync).mockClear();
			store.saveSession(mockSession as any, "non-existent");

			// Should not call writeFileSync for session data (only index)
			expect(mockSession.getInternalState).not.toHaveBeenCalled();
		});
	});

	describe("initialize with existing sessions and no active", () => {
		it("should select most recent session as active", async () => {
			const mockIndex = {
				version: 1,
				activeSessionId: null,
				sessions: [
					{
						id: "old-session",
						name: "Old",
						createdAt: 1000,
						updatedAt: 1000,
						tokenUsage: 100,
						messageCount: 5,
						isActive: false,
					},
					{
						id: "recent-session",
						name: "Recent",
						createdAt: 2000,
						updatedAt: 3000,
						tokenUsage: 200,
						messageCount: 10,
						isActive: false,
					},
				],
			};

			vi.mocked(fs.existsSync).mockImplementation((p) => {
				return typeof p === "string" && p.includes("index.json");
			});
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockIndex));

			const store = new SessionStore(4096);
			await store.initialize();

			// Should select most recent session (sorted by updatedAt desc)
			expect(store.getActiveSessionId()).toBe("recent-session");
		});

		it("should handle active session that no longer exists", async () => {
			const mockIndex = {
				version: 1,
				activeSessionId: "deleted-session",
				sessions: [
					{
						id: "existing-session",
						name: "Existing",
						createdAt: 1000,
						updatedAt: 2000,
						tokenUsage: 100,
						messageCount: 5,
						isActive: false,
					},
				],
			};

			vi.mocked(fs.existsSync).mockImplementation((p) => {
				return typeof p === "string" && p.includes("index.json");
			});
			vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(mockIndex));

			const store = new SessionStore(4096);
			await store.initialize();

			// Should select existing session since deleted-session doesn't exist
			expect(store.getActiveSessionId()).toBe("existing-session");
		});
	});

	describe("rebuildIndexFromFiles", () => {
		it("should rebuild from session files", async () => {
			vi.mocked(fs.existsSync).mockImplementation((p) => {
				return typeof p === "string" && p.includes("index.json");
			});
			vi.mocked(fs.readFileSync).mockImplementation((p) => {
				if (typeof p === "string" && p.includes("index.json")) {
					throw new Error("Corrupted");
				}
				// Session file
				return JSON.stringify({
					info: {
						id: "rebuilt-session",
						name: "Rebuilt",
						createdAt: 1000,
						updatedAt: 2000,
						tokenUsage: 50,
						messageCount: 3,
						modelId: "test-model",
						isActive: false,
					},
					messages: [],
					tokenState: {
						actualPromptTokens: 0,
						actualCompletionTokens: 0,
					},
				});
			});
			vi.mocked(fs.readdirSync).mockReturnValue([
				"session1.json" as any,
			]);

			const store = new SessionStore(4096);
			await store.initialize();

			// Should have rebuilt from session file plus created new session
			const sessions = store.listSessions();
			expect(sessions.some((s) => s.id === "rebuilt-session")).toBe(true);
		});
	});

	describe("error handling in deleteSession", () => {
		it("should continue if file deletion fails", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			// Create second session
			mockRandomUUID.mockReturnValue("second-session-id");
			store.createSession("Second");

			// Mock file exists but deletion fails
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.unlinkSync).mockImplementation(() => {
				throw new Error("Permission denied");
			});

			const result = store.deleteSession("second-session-id");
			expect(result).toBe(true); // Should still return true

			// Session should be removed from list
			expect(store.getSessionById("second-session-id")).toBeNull();
		});
	});

	describe("singleton functions", () => {
		it("getSessionStore should return null before init", () => {
			expect(getSessionStore()).toBeNull();
		});

		it("initSessionStore should create and return store", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = await initSessionStore(4096);
			expect(store).toBeInstanceOf(SessionStore);
			expect(getSessionStore()).toBe(store);
		});

		it("initSessionStore should return same instance", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store1 = await initSessionStore(4096);
			const store2 = await initSessionStore(8192);
			expect(store1).toBe(store2);
		});

		it("resetSessionStore should clear instance", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			await initSessionStore(4096);
			resetSessionStore();
			expect(getSessionStore()).toBeNull();
		});
	});

	describe("error handling in saveSession", () => {
		it("should handle write error gracefully", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			const mockSession = {
				getInternalState: vi.fn(() => ({
					messages: [{ role: "user", content: "hello" }],
					systemPrompt: null,
					actualPromptTokens: 10,
					actualCompletionTokens: 20,
				})),
				getStatus: vi.fn(() => ({
					usedTokens: 30,
					messageCount: 1,
				})),
			};

			// Mock writeFileSync to throw error
			vi.mocked(fs.writeFileSync).mockImplementation(() => {
				throw new Error("Disk full");
			});

			// Should not throw
			expect(() => {
				store.saveSession(mockSession as any, "test-uuid-1234");
			}).not.toThrow();
		});
	});

	describe("error handling in clearAllSessions", () => {
		it("should handle file deletion error gracefully", async () => {
			vi.mocked(fs.existsSync).mockReturnValue(false);

			const store = new SessionStore(4096);
			await store.initialize();

			// Create second session
			mockRandomUUID.mockReturnValue("second-session-id");
			store.createSession("Second");

			// Mock file exists and deletion fails
			vi.mocked(fs.existsSync).mockReturnValue(true);
			vi.mocked(fs.unlinkSync).mockImplementation(() => {
				throw new Error("Permission denied");
			});

			// Should not throw
			expect(() => {
				store.clearAllSessions();
			}).not.toThrow();

			// Should have created new session
			const sessions = store.listSessions();
			expect(sessions.length).toBe(1);
		});
	});
});
