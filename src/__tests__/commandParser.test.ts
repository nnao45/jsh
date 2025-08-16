import { describe, it, expect } from 'vitest';
import { parseCommandLine, needsComplexParsing } from '../utils/commandParser.js';

describe('commandParser', () => {
  describe('needsComplexParsing', () => {
    it('should detect commands that need complex parsing', () => {
      expect(needsComplexParsing('js \'console.log("hello")\'')).toBe(true);
      expect(needsComplexParsing('echo "hello world"')).toBe(true);
      expect(needsComplexParsing('git commit -m "initial commit"')).toBe(true);
      expect(needsComplexParsing('js console.log("hello")')).toBe(true);
    });

    it('should detect commands that do not need complex parsing', () => {
      expect(needsComplexParsing('ls -la')).toBe(false);
      expect(needsComplexParsing('pwd')).toBe(false);
      expect(needsComplexParsing('js 2 + 2')).toBe(false);
      expect(needsComplexParsing('npm install lodash')).toBe(false);
    });
  });

  describe('parseCommandLine', () => {
    it('should parse simple commands', () => {
      const result = parseCommandLine('ls -la');
      expect(result.command).toBe('ls');
      expect(result.args).toEqual(['-la']);
    });

    it('should parse commands with single quotes', () => {
      const result = parseCommandLine('js \'console.log("hello")\'');
      expect(result.command).toBe('js');
      expect(result.args).toEqual(['console.log("hello")']);
    });

    it('should parse commands with double quotes', () => {
      const result = parseCommandLine('echo "hello world"');
      expect(result.command).toBe('echo');
      expect(result.args).toEqual(['hello world']);
    });

    it('should handle mixed quotes', () => {
      const result = parseCommandLine('git commit -m "initial commit"');
      expect(result.command).toBe('git');
      expect(result.args).toEqual(['commit', '-m', 'initial commit']);
    });

    it('should handle escaped quotes', () => {
      const result = parseCommandLine('js "console.log(\\"hello\\")"');
      expect(result.command).toBe('js');
      expect(result.args).toEqual(['console.log("hello")']);
    });

    it('should handle complex JavaScript expressions', () => {
      const result = parseCommandLine('js \'$.filter(item => item.name === "test")\'');
      expect(result.command).toBe('js');
      expect(result.args).toEqual(['$.filter(item => item.name === "test")']);
    });

    it('should handle multiple arguments with quotes', () => {
      const result = parseCommandLine('mycommand "arg1" \'arg2\' arg3');
      expect(result.command).toBe('mycommand');
      expect(result.args).toEqual(['arg1', 'arg2', 'arg3']);
    });

    it('should handle empty strings', () => {
      const result = parseCommandLine('command "" \'\'');
      expect(result.command).toBe('command');
      expect(result.args).toEqual(['', '']);
    });

    it('should handle commands with only spaces', () => {
      const result = parseCommandLine('   ls   -la   ');
      expect(result.command).toBe('ls');
      expect(result.args).toEqual(['-la']);
    });

    it('should handle empty input', () => {
      const result = parseCommandLine('');
      expect(result.command).toBe('');
      expect(result.args).toEqual([]);
    });

    it('should preserve spaces inside quotes', () => {
      const result = parseCommandLine('js \'2   +   2\'');
      expect(result.command).toBe('js');
      expect(result.args).toEqual(['2   +   2']);
    });

    it('should handle nested quotes correctly', () => {
      const result = parseCommandLine('js \'console.log("nested \\"quotes\\" here")\'');
      expect(result.command).toBe('js');
      expect(result.args).toEqual(['console.log("nested "quotes" here")']);
    });

    it('should handle single command without arguments', () => {
      const result = parseCommandLine('pwd');
      expect(result.command).toBe('pwd');
      expect(result.args).toEqual([]);
    });

    it('should handle commands with multiple spaces between arguments', () => {
      const result = parseCommandLine('command   arg1    "arg 2"     arg3');
      expect(result.command).toBe('command');
      expect(result.args).toEqual(['arg1', 'arg 2', 'arg3']);
    });
  });
});