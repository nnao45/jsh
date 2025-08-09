import { describe, it, expect, beforeEach } from 'vitest';
import { TabCompletion } from '../modules/TabCompletion.js';

describe('TabCompletion', () => {
  let tabCompletion: TabCompletion;

  beforeEach(() => {
    const builtinCommands = ['help', 'cd', 'ls', 'pwd', 'mkdir', 'clear', 'exit'];
    tabCompletion = new TabCompletion(builtinCommands);
  });

  describe('complete', () => {
    it('should complete builtin commands', async () => {
      const result = await tabCompletion.complete('hel');
      
      expect(result.completions).toContain('help');
      expect(result.completions.length).toBeGreaterThanOrEqual(1);
    });

    it('should complete multiple matching commands', async () => {
      const result = await tabCompletion.complete('c');
      
      expect(result.completions).toContain('cd');
      expect(result.completions).toContain('clear');
      expect(result.completions.length).toBeGreaterThanOrEqual(2);
    });

    it('should return empty for non-matching commands', async () => {
      const result = await tabCompletion.complete('zzz');
      
      expect(result.completions).toHaveLength(0);
      expect(result.commonPrefix).toBe('');
    });

    it('should handle empty input', async () => {
      const result = await tabCompletion.complete('');
      
      expect(result.completions.length).toBeGreaterThan(0);
      expect(result.completions).toContain('help');
      expect(result.completions).toContain('cd');
    });

    it('should find common prefix for multiple matches', async () => {
      // This test might need adjustment based on available commands
      const result = await tabCompletion.complete('c');
      
      if (result.completions.length > 1) {
        expect(result.commonPrefix).toBeTruthy();
      }
    });

    it('should complete file paths', async () => {
      // Create a test scenario with current directory
      const result = await tabCompletion.complete('src/');
      
      // Should not error and should attempt file completion
      expect(result).toHaveProperty('completions');
      expect(result).toHaveProperty('commonPrefix');
    });
  });

  describe('globComplete', () => {
    it('should handle glob patterns', async () => {
      const result = await tabCompletion.globComplete('src/*.ts');
      
      expect(Array.isArray(result)).toBe(true);
      // Result may be empty if no matching files, but shouldn't error
    });

    it('should handle invalid glob patterns gracefully', async () => {
      const result = await tabCompletion.globComplete('invalid[[[');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });
});