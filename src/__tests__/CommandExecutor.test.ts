import { describe, it, expect, beforeEach } from 'vitest';
import { CommandExecutor } from '../modules/CommandExecutor.js';

describe('CommandExecutor', () => {
  let commandExecutor: CommandExecutor;

  beforeEach(() => {
    commandExecutor = new CommandExecutor();
  });

  describe('execute', () => {
    it('should execute echo command successfully', async () => {
      const result = await commandExecutor.execute('echo "Hello World"', {
        currentDirectory: process.cwd(),
        env: process.env as Record<string, string>,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Hello World');
      expect(result.stderr).toBe('');
    });

    it('should handle command with exit code 0', async () => {
      const result = await commandExecutor.execute('true', {
        currentDirectory: process.cwd(),
        env: process.env as Record<string, string>,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe('');
    });

    it('should handle command with non-zero exit code', async () => {
      const result = await commandExecutor.execute('false', {
        currentDirectory: process.cwd(),
        env: process.env as Record<string, string>,
      });

      expect(result.exitCode).toBe(1);
    });

    it('should handle non-existent command', async () => {
      const result = await commandExecutor.execute('nonexistentcommand12345', {
        currentDirectory: process.cwd(),
        env: process.env as Record<string, string>,
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBeTruthy();
    });

    it('should respect working directory', async () => {
      const tempDir = '/tmp';
      const result = await commandExecutor.execute('pwd', {
        currentDirectory: tempDir,
        env: process.env as Record<string, string>,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe(tempDir);
    });

    it('should handle commands with arguments', async () => {
      const result = await commandExecutor.execute('echo test argument', {
        currentDirectory: process.cwd(),
        env: process.env as Record<string, string>,
      });

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test argument');
    });
  });

  describe('killProcess', () => {
    it('should not throw when killing non-existent process', async () => {
      // This test just ensures the method doesn't crash
      await expect(commandExecutor.killProcess(999999)).resolves.toBeUndefined();
    });
  });
});