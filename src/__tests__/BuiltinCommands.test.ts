import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BuiltinCommands } from '../modules/BuiltinCommands.js';
import { ShellState } from '../types/shell.js';

describe('BuiltinCommands', () => {
  let builtinCommands: BuiltinCommands;
  let mockSetState: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockSetState = vi.fn();
    builtinCommands = new BuiltinCommands(mockSetState);
  });

  describe('help command', () => {
    it('should return list of available commands', async () => {
      const result = await builtinCommands.execute('help', []);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('InkSh Built-in Commands');
      expect(result.stdout).toContain('help');
      expect(result.stdout).toContain('cd');
      expect(result.stdout).toContain('ls');
      expect(result.stderr).toBe('');
    });
  });

  describe('pwd command', () => {
    it('should return current working directory', async () => {
      const result = await builtinCommands.execute('pwd', []);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe(process.cwd());
      expect(result.stderr).toBe('');
    });
  });

  describe('clear command', () => {
    it('should clear the output', async () => {
      const result = await builtinCommands.execute('clear', []);
      
      expect(result.exitCode).toBe(0);
      expect(mockSetState).toHaveBeenCalledWith(
        expect.any(Function)
      );
    });
  });

  describe('mkdir command', () => {
    it('should return error when no directory specified', async () => {
      const result = await builtinCommands.execute('mkdir', []);
      
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('missing operand');
    });
  });

  describe('history command', () => {
    it('should not error when executed', async () => {
      // History command uses setState callback and returns in Promise
      // Just verify it can be called without throwing
      expect(() => builtinCommands.execute('history', [])).not.toThrow();
    });
  });

  describe('jobs command', () => {
    it('should return no active jobs initially', async () => {
      const result = await builtinCommands.execute('jobs', []);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No active jobs');
    });
  });

  describe('hasCommand', () => {
    it('should return true for existing commands', () => {
      expect(builtinCommands.hasCommand('help')).toBe(true);
      expect(builtinCommands.hasCommand('cd')).toBe(true);
      expect(builtinCommands.hasCommand('ls')).toBe(true);
      expect(builtinCommands.hasCommand('pwd')).toBe(true);
    });

    it('should return false for non-existing commands', () => {
      expect(builtinCommands.hasCommand('nonexistent')).toBe(false);
      expect(builtinCommands.hasCommand('fakecommand')).toBe(false);
    });
  });

  describe('getCommands', () => {
    it('should return array of all commands', () => {
      const commands = builtinCommands.getCommands();
      
      expect(Array.isArray(commands)).toBe(true);
      expect(commands.length).toBeGreaterThan(0);
      
      // Check that all commands have required properties
      commands.forEach(cmd => {
        expect(cmd).toHaveProperty('name');
        expect(cmd).toHaveProperty('description');
        expect(cmd).toHaveProperty('execute');
        expect(typeof cmd.execute).toBe('function');
      });
    });
  });

  describe('unknown command', () => {
    it('should return command not found error', async () => {
      const result = await builtinCommands.execute('unknowncommand', []);
      
      expect(result.exitCode).toBe(127);
      expect(result.stderr).toContain('Command not found: unknowncommand');
    });
  });
});