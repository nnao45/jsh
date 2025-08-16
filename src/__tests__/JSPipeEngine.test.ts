import { describe, it, expect, beforeEach } from 'vitest';
import { JSPipeEngine } from '../modules/JSPipeEngine.js';

describe('JSPipeEngine', () => {
  let engine: JSPipeEngine;

  beforeEach(() => {
    engine = new JSPipeEngine();
  });

  describe('executeJS', () => {
    describe('console output', () => {
      it('should capture console.log output', async () => {
        const result = await engine.executeJS('console.log("hello")');
        expect(result.stdout).toBe('hello');
        expect(result.stderr).toBe('');
        expect(result.exitCode).toBe(0);
      });

      it('should capture multiple console.log outputs', async () => {
        const result = await engine.executeJS('console.log("first"); console.log("second")');
        expect(result.stdout).toBe('first\nsecond');
        expect(result.exitCode).toBe(0);
      });

      it('should capture console.log with multiple arguments', async () => {
        const result = await engine.executeJS('console.log("Number:", 42, "Boolean:", true)');
        expect(result.stdout).toBe('Number: 42 Boolean: true');
        expect(result.exitCode).toBe(0);
      });

      it('should capture console.error with ERROR prefix', async () => {
        const result = await engine.executeJS('console.error("This is an error")');
        expect(result.stdout).toBe('ERROR: This is an error');
        expect(result.exitCode).toBe(0);
      });

      it('should capture console.warn with WARN prefix', async () => {
        const result = await engine.executeJS('console.warn("This is a warning")');
        expect(result.stdout).toBe('WARN: This is a warning');
        expect(result.exitCode).toBe(0);
      });

      it('should capture console.info with INFO prefix', async () => {
        const result = await engine.executeJS('console.info("This is info")');
        expect(result.stdout).toBe('INFO: This is info');
        expect(result.exitCode).toBe(0);
      });

      it('should combine console output with return value', async () => {
        const result = await engine.executeJS('console.log("hello"); "world"');
        expect(result.stdout).toBe('hello\nworld');
        expect(result.exitCode).toBe(0);
      });

      it('should handle objects in console.log', async () => {
        const result = await engine.executeJS('console.log({name: "test", value: 42})');
        expect(result.stdout).toBe('{"name":"test","value":42}');
        expect(result.exitCode).toBe(0);
      });
    });

    describe('basic execution', () => {
      it('should execute simple expressions', async () => {
        const result = await engine.executeJS('2 + 2');
        expect(result.stdout).toBe('4');
        expect(result.exitCode).toBe(0);
      });

      it('should execute string operations', async () => {
        const result = await engine.executeJS('"hello " + "world"');
        expect(result.stdout).toBe('hello world');
        expect(result.exitCode).toBe(0);
      });

      it('should handle undefined results', async () => {
        const result = await engine.executeJS('undefined');
        expect(result.stdout).toBe('');
        expect(result.exitCode).toBe(0);
      });

      it('should handle null results', async () => {
        const result = await engine.executeJS('null');
        expect(result.stdout).toBe('');
        expect(result.exitCode).toBe(0);
      });
    });

    describe('pipe input handling', () => {
      it('should process string input', async () => {
        const result = await engine.executeJS('$.toUpperCase()', 'hello world');
        expect(result.stdout).toBe('HELLO WORLD');
        expect(result.exitCode).toBe(0);
      });

      it('should process JSON input', async () => {
        const result = await engine.executeJS('$.name', '{"name": "test", "value": 42}');
        expect(result.stdout).toBe('test');
        expect(result.exitCode).toBe(0);
      });

      it('should process array input', async () => {
        const result = await engine.executeJS('$.length', '[1, 2, 3, 4, 5]');
        expect(result.stdout).toBe('5');
        expect(result.exitCode).toBe(0);
      });

      it('should process number input', async () => {
        const result = await engine.executeJS('$ * 2', '21');
        expect(result.stdout).toBe('42');
        expect(result.exitCode).toBe(0);
      });
    });

    describe('async operations', () => {
      it('should handle promises', async () => {
        const result = await engine.executeJS('Promise.resolve("async result")');
        expect(result.stdout).toBe('async result');
        expect(result.exitCode).toBe(0);
      });

      it('should handle async utilities', async () => {
        const result = await engine.executeJS('async.delay(10).then(() => "delayed")');
        expect(result.stdout).toBe('delayed');
        expect(result.exitCode).toBe(0);
      });
    });

    describe('error handling', () => {
      it('should handle syntax errors', async () => {
        const result = await engine.executeJS('invalid javascript syntax {');
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('JS Error:');
        expect(result.exitCode).toBe(1);
      });

      it('should handle runtime errors', async () => {
        const result = await engine.executeJS('throw new Error("test error")');
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('JS Error: Error: test error');
        expect(result.exitCode).toBe(1);
      });

      it('should handle reference errors', async () => {
        const result = await engine.executeJS('nonexistentVariable');
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('JS Error:');
        expect(result.exitCode).toBe(1);
      });
    });

    describe('utility functions', () => {
      it('should provide array utilities', async () => {
        const result = await engine.executeJS('array.chunk([1,2,3,4,5,6], 2)');
        expect(result.stdout).toBe('[\n  [\n    1,\n    2\n  ],\n  [\n    3,\n    4\n  ],\n  [\n    5,\n    6\n  ]\n]');
        expect(result.exitCode).toBe(0);
      });

      it('should provide string utilities', async () => {
        const result = await engine.executeJS('string.lines("line1\\nline2\\nline3")');
        expect(result.stdout).toBe('[\n  "line1",\n  "line2",\n  "line3"\n]');
        expect(result.exitCode).toBe(0);
      });
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', () => {
      const stats = engine.getCacheStats();
      expect(stats).toHaveProperty('npmPackages');
      expect(stats).toHaveProperty('vmContexts');
      expect(stats).toHaveProperty('maxVMContexts');
      expect(typeof stats.npmPackages).toBe('number');
      expect(typeof stats.vmContexts).toBe('number');
      expect(typeof stats.maxVMContexts).toBe('number');
    });

    it('should clear all caches', () => {
      engine.clearAllCaches();
      const stats = engine.getCacheStats();
      expect(stats.npmPackages).toBe(0);
      expect(stats.vmContexts).toBe(0);
    });

    it('should optimize memory', () => {
      // This mainly tests that the method doesn't throw
      expect(() => engine.optimizeMemory()).not.toThrow();
    });
  });
});