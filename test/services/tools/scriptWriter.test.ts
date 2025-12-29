import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
	getScriptsDir,
	ensureScriptsDir,
	generateScriptFilename,
	writeScript,
	buildScriptCommand,
} from "../../../source/services/tools/scriptWriter.js";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { platform } from "node:os";

// Mock node:fs
vi.mock("node:fs", () => ({
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	writeFileSync: vi.fn(),
}));

// Mock node:os
vi.mock("node:os", () => ({
	platform: vi.fn(() => "win32"),
}));

describe("scriptWriter", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getScriptsDir", () => {
		it("should return correct scripts directory path", () => {
			const result = getScriptsDir("/project");
			expect(result).toContain(".axiomate");
			expect(result).toContain("scripts");
		});

		it("should handle Windows paths", () => {
			const result = getScriptsDir("C:\\Users\\test\\project");
			expect(result).toContain(".axiomate");
			expect(result).toContain("scripts");
		});
	});

	describe("ensureScriptsDir", () => {
		it("should create directory if it does not exist", () => {
			vi.mocked(existsSync).mockReturnValue(false);

			const result = ensureScriptsDir("/project");

			expect(mkdirSync).toHaveBeenCalledWith(expect.any(String), {
				recursive: true,
			});
			expect(result).toContain("scripts");
		});

		it("should not create directory if it already exists", () => {
			vi.mocked(existsSync).mockReturnValue(true);

			const result = ensureScriptsDir("/project");

			expect(mkdirSync).not.toHaveBeenCalled();
			expect(result).toContain("scripts");
		});
	});

	describe("generateScriptFilename", () => {
		it("should generate PowerShell filename with .ps1 extension", () => {
			const result = generateScriptFilename("powershell");
			expect(result).toMatch(/^script_\d+_[a-z0-9]+\.ps1$/);
		});

		it("should generate pwsh filename with .ps1 extension", () => {
			const result = generateScriptFilename("pwsh");
			expect(result).toMatch(/^script_\d+_[a-z0-9]+\.ps1$/);
		});

		it("should generate Python filename with .py extension", () => {
			const result = generateScriptFilename("python");
			expect(result).toMatch(/^script_\d+_[a-z0-9]+\.py$/);
		});

		it("should generate CMD filename with .bat extension", () => {
			const result = generateScriptFilename("cmd");
			expect(result).toMatch(/^script_\d+_[a-z0-9]+\.bat$/);
		});

		it("should generate Bash filename with .sh extension", () => {
			const result = generateScriptFilename("bash");
			expect(result).toMatch(/^script_\d+_[a-z0-9]+\.sh$/);
		});

		it("should use custom prefix when provided", () => {
			const result = generateScriptFilename("python", "myprefix");
			expect(result).toMatch(/^myprefix_\d+_[a-z0-9]+\.py$/);
		});
	});

	describe("writeScript", () => {
		beforeEach(() => {
			vi.mocked(existsSync).mockReturnValue(true);
		});

		it("should write PowerShell script with UTF-8 BOM", () => {
			vi.mocked(platform).mockReturnValue("win32");

			const result = writeScript("/project", "powershell", "Write-Host 'Hello'");

			expect(writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining(".ps1"),
				expect.any(Buffer),
			);

			// Check that BOM was included
			const call = vi.mocked(writeFileSync).mock.calls[0];
			const buffer = call?.[1] as Buffer;
			expect(buffer[0]).toBe(0xef);
			expect(buffer[1]).toBe(0xbb);
			expect(buffer[2]).toBe(0xbf);
		});

		it("should write pwsh script without BOM (pwsh defaults to UTF-8)", () => {
			vi.mocked(platform).mockReturnValue("win32");

			writeScript("/project", "pwsh", "Write-Host 'Hello'\nWrite-Host 'World'");

			// pwsh uses UTF-8 without BOM, but CRLF on Windows
			expect(writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining(".ps1"),
				"Write-Host 'Hello'\r\nWrite-Host 'World'",
				{ encoding: "utf8" },
			);
		});

		it("should write bash script with LF line endings", () => {
			const content = "echo 'Hello'\r\necho 'World'\r\n";
			writeScript("/project", "bash", content);

			expect(writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining(".sh"),
				"echo 'Hello'\necho 'World'\n",
				{ encoding: "utf8" },
			);
		});

		it("should write CMD script with CRLF on Windows", () => {
			vi.mocked(platform).mockReturnValue("win32");

			const content = "echo Hello\necho World";
			writeScript("/project", "cmd", content);

			expect(writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining(".bat"),
				"echo Hello\r\necho World",
				{ encoding: "utf8" },
			);
		});

		it("should write Python script without line ending changes", () => {
			vi.mocked(platform).mockReturnValue("win32");

			const content = "print('Hello')\nprint('World')";
			writeScript("/project", "python", content);

			expect(writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining(".py"),
				content,
				{ encoding: "utf8" },
			);
		});

		it("should use custom filename when provided", () => {
			writeScript("/project", "python", "print('test')", {
				filename: "custom.py",
			});

			expect(writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining("custom.py"),
				expect.any(String),
				{ encoding: "utf8" },
			);
		});

		it("should use custom prefix for generated filename", () => {
			const result = writeScript("/project", "python", "print('test')", {
				prefix: "myprefix",
			});

			expect(result).toContain("myprefix_");
		});

		it("should return the absolute path to created script", () => {
			const result = writeScript("/project", "bash", "echo test");

			expect(result).toContain(".axiomate");
			expect(result).toContain("scripts");
			expect(result).toContain(".sh");
		});

		it("should handle CMD on non-Windows without CRLF conversion", () => {
			vi.mocked(platform).mockReturnValue("linux");

			const content = "echo Hello\necho World";
			writeScript("/project", "cmd", content);

			expect(writeFileSync).toHaveBeenCalledWith(
				expect.stringContaining(".bat"),
				content,
				{ encoding: "utf8" },
			);
		});
	});

	describe("buildScriptCommand", () => {
		it("should build PowerShell command with UTF-8 encoding setup", () => {
			const result = buildScriptCommand("powershell", "/path/to/script.ps1");

			expect(result).toContain("powershell");
			expect(result).toContain("-NoProfile");
			expect(result).toContain("-ExecutionPolicy Bypass");
			expect(result).toContain("UTF8");
			expect(result).toContain("/path/to/script.ps1");
		});

		it("should build pwsh command with UTF-8 encoding", () => {
			const result = buildScriptCommand("pwsh", "/path/to/script.ps1");

			expect(result).toContain("pwsh");
			expect(result).toContain("-NoProfile");
			expect(result).toContain("UTF8");
		});

		it("should build Python command", () => {
			const result = buildScriptCommand("python", "/path/to/script.py");

			expect(result).toBe('python "/path/to/script.py"');
		});

		it("should build CMD command with chcp for UTF-8", () => {
			const result = buildScriptCommand("cmd", "/path/to/script.bat");

			expect(result).toContain("chcp 65001");
			expect(result).toContain("/path/to/script.bat");
		});

		it("should build Bash command", () => {
			const result = buildScriptCommand("bash", "/path/to/script.sh");

			expect(result).toBe('bash "/path/to/script.sh"');
		});

		it("should normalize Windows backslashes to forward slashes", () => {
			const result = buildScriptCommand(
				"python",
				"C:\\Users\\test\\script.py",
			);

			expect(result).toBe('python "C:/Users/test/script.py"');
			expect(result).not.toContain("\\");
		});
	});
});
