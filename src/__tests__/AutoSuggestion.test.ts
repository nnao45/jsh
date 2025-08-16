import { describe, it, expect, beforeEach } from 'vitest';
import { AutoSuggestion } from '../modules/AutoSuggestion.js';

describe('AutoSuggestion', () => {
  let autoSuggestion: AutoSuggestion;
  let sampleHistory: string[];

  beforeEach(() => {
    autoSuggestion = new AutoSuggestion({
      minInputLength: 2,
      maxSuggestions: 3,
      enableFuzzyMatch: true,
    });

    sampleHistory = [
      'npm install lodash',
      'git status',
      'git commit -m "Initial commit"',
      'ls -la',
      'cd src',
      'npm run build',
      'npm test',
      'git push origin main',
      'ls',
      'pwd',
    ];
  });

  describe('getSuggestion', () => {
    it('should return null for empty input', () => {
      const result = autoSuggestion.getSuggestion('', sampleHistory);
      expect(result).toBeNull();
    });

    it('should return null for input shorter than minInputLength', () => {
      const result = autoSuggestion.getSuggestion('l', sampleHistory);
      expect(result).toBeNull();
    });

    it('should return exact prefix match with high confidence', () => {
      const result = autoSuggestion.getSuggestion('npm i', sampleHistory);
      expect(result).toBeTruthy();
      expect(result?.suggestion).toBe('nstall lodash');
      expect(result?.confidence).toBe(0.9);
      expect(result?.source).toBe('history');
    });

    it('should return most recent match for multiple candidates', () => {
      const result = autoSuggestion.getSuggestion('ls', sampleHistory);
      expect(result).toBeTruthy();
      expect(result?.suggestion).toBe(' -la');
      expect(result?.source).toBe('history');
    });

    it('should handle fuzzy matching', () => {
      const result = autoSuggestion.getSuggestion('git sta', sampleHistory);
      expect(result).toBeTruthy();
      expect(result?.suggestion).toBe('tus');
      expect(result?.confidence).toBe(0.9);
    });

    it('should return null when no matches found', () => {
      const result = autoSuggestion.getSuggestion('nonexistent', sampleHistory);
      expect(result).toBeNull();
    });
  });

  describe('getMultipleSuggestions', () => {
    it('should return multiple suggestions for common prefix', () => {
      const results = autoSuggestion.getMultipleSuggestions('npm', sampleHistory);
      expect(results).toHaveLength(3);
      expect(results[0].suggestion).toBe(' test');
      expect(results[1].suggestion).toBe(' run build');
      expect(results[2].suggestion).toBe(' install lodash');
    });

    it('should respect maxSuggestions limit', () => {
      const results = autoSuggestion.getMultipleSuggestions('git', sampleHistory);
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should return empty array for no matches', () => {
      const results = autoSuggestion.getMultipleSuggestions('xyz', sampleHistory);
      expect(results).toHaveLength(0);
    });
  });

  describe('shouldSuggest', () => {
    it('should return true for valid input', () => {
      expect(autoSuggestion.shouldSuggest('npm')).toBe(true);
      expect(autoSuggestion.shouldSuggest('git st')).toBe(true);
    });

    it('should return false for short input', () => {
      expect(autoSuggestion.shouldSuggest('n')).toBe(false);
    });

    it('should return false for input ending with space', () => {
      expect(autoSuggestion.shouldSuggest('npm ')).toBe(false);
    });

    it('should return false for input with pipes', () => {
      expect(autoSuggestion.shouldSuggest('ls | grep')).toBe(false);
    });

    it('should return false for input with redirections', () => {
      expect(autoSuggestion.shouldSuggest('ls > file')).toBe(false);
      expect(autoSuggestion.shouldSuggest('cat < file')).toBe(false);
    });
  });

  describe('recordFeedback', () => {
    it('should record acceptance feedback', () => {
      // This is mainly for testing that the method doesn't throw
      expect(() => {
        autoSuggestion.recordFeedback('npm', ' install', true, 'history');
      }).not.toThrow();
    });

    it('should record rejection feedback', () => {
      expect(() => {
        autoSuggestion.recordFeedback('npm', ' test', false, 'history');
      }).not.toThrow();
    });
  });

  describe('configuration', () => {
    it('should update configuration', () => {
      autoSuggestion.updateConfig({ minInputLength: 3 });
      expect(autoSuggestion.shouldSuggest('ab')).toBe(false);
      expect(autoSuggestion.shouldSuggest('abc')).toBe(true);
    });

    it('should return stats', () => {
      const stats = autoSuggestion.getStats();
      expect(stats).toHaveProperty('cacheSize');
      expect(stats).toHaveProperty('lastCacheTime');
      expect(stats).toHaveProperty('config');
      expect(stats.config.minInputLength).toBe(2);
    });
  });

  describe('cache management', () => {
    it('should clear cache', () => {
      autoSuggestion.clearCache();
      const stats = autoSuggestion.getStats();
      expect(stats.cacheSize).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty history', () => {
      const result = autoSuggestion.getSuggestion('test', []);
      expect(result).toBeNull();
    });

    it('should handle history with duplicates', () => {
      const historyWithDuplicates = ['ls', 'ls', 'ls -la', 'ls'];
      const result = autoSuggestion.getSuggestion('ls', historyWithDuplicates);
      expect(result).toBeTruthy();
      expect(result?.suggestion).toBe(' -la');
    });

    it('should handle special characters in commands', () => {
      const specialHistory = [
        'echo "Hello World"',
        'grep -r "pattern" .',
        'find . -name "*.ts"',
      ];
      const result = autoSuggestion.getSuggestion('echo', specialHistory);
      expect(result).toBeTruthy();
      expect(result?.suggestion).toBe(' "Hello World"');
    });
  });

  describe('fuzzy matching strategies', () => {
    it('should match substrings', () => {
      const history = ['git checkout main', 'npm install package'];
      const result = autoSuggestion.getSuggestion('checkout', history);
      expect(result).toBeTruthy();
      // For fuzzy matches that don't start with the input, we get the remainder after input
      expect(result?.suggestion).toBe('kout main');
      expect(result?.confidence).toBe(0.7);
    });

    it('should match word boundaries', () => {
      const history = ['git commit -m "fix: bug"', 'npm run test'];
      const result = autoSuggestion.getSuggestion('git comm', history);
      expect(result).toBeTruthy();
    });
  });
});