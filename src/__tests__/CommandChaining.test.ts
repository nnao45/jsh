import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { PipelineManager } from '../modules/PipelineManager.js';
import { CommandExecutor } from '../modules/CommandExecutor.js';
import { PipelineOptions, CommandOptions } from '../types/shell.js';

describe('Command Chaining', () => {
  let pipelineManager: PipelineManager;
  let commandExecutor: CommandExecutor;
  let tempDir: string;
  let options: PipelineOptions;

  beforeEach(async () => {
    pipelineManager = new PipelineManager();
    commandExecutor = new CommandExecutor();
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-chain-'));
    
    options = {
      currentDirectory: tempDir,
      env: { ...process.env },
    };
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Command Chain Parsing', () => {
    it('should detect command chains', () => {
      // Access private method for testing
      const pm = pipelineManager as any;
      
      expect(pm.isCommandChain('echo hello && echo world')).toBe(true);
      expect(pm.isCommandChain('echo hello || echo world')).toBe(true);
      expect(pm.isCommandChain('echo hello; echo world')).toBe(true);
      expect(pm.isCommandChain('echo hello')).toBe(false);
      expect(pm.isCommandChain('echo hello | cat')).toBe(false);
    });

    it('should parse command chains correctly', () => {
      const pm = pipelineManager as any;
      
      const chains1 = pm.parseCommandChain('echo hello && echo world');
      expect(chains1).toHaveLength(2);
      expect(chains1[0]).toEqual({ pipeline: 'echo hello', operator: '&&' });
      expect(chains1[1]).toEqual({ pipeline: 'echo world', operator: undefined });

      const chains2 = pm.parseCommandChain('cmd1 || cmd2 && cmd3; cmd4');
      expect(chains2).toHaveLength(4);
      expect(chains2[0]).toEqual({ pipeline: 'cmd1', operator: '||' });
      expect(chains2[1]).toEqual({ pipeline: 'cmd2', operator: '&&' });
      expect(chains2[2]).toEqual({ pipeline: 'cmd3', operator: ';' });
      expect(chains2[3]).toEqual({ pipeline: 'cmd4', operator: undefined });
    });
  });

  describe('AND Operator (&&)', () => {
    it('should execute second command only if first succeeds', async () => {
      const result = await pipelineManager.executeCommand('echo success && echo also-success', options);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('success\nalso-success');
      expect(result.stderr).toBe('');
    });

    it('should not execute second command if first fails', async () => {
      // Use a command that will fail (trying to read non-existent file)
      const result = await pipelineManager.executeCommand('cat /nonexistent-file && echo should-not-run', options);
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe('');
      expect(result.stderr).toContain('No such file');
      expect(result.stderr).not.toContain('should-not-run');
    });

    it('should handle multiple AND operations', async () => {
      const result = await pipelineManager.executeCommand(
        'echo first && echo second && echo third',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('first\nsecond\nthird');
    });

    it('should stop at first failure in multiple ANDs', async () => {
      const result = await pipelineManager.executeCommand(
        'echo first && cat /nonexistent && echo third',
        options
      );
      
      expect(result.exitCode).not.toBe(0);
      expect(result.stdout).toBe('first');
      expect(result.stderr).toContain('No such file');
    });
  });

  describe('OR Operator (||)', () => {
    it('should execute second command only if first fails', async () => {
      const result = await pipelineManager.executeCommand(
        'cat /nonexistent-file || echo fallback',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('fallback');
    });

    it('should not execute second command if first succeeds', async () => {
      const result = await pipelineManager.executeCommand(
        'echo success || echo should-not-run',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('success');
      expect(result.stdout).not.toContain('should-not-run');
    });

    it('should handle multiple OR operations', async () => {
      const result = await pipelineManager.executeCommand(
        'cat /nonexistent1 || cat /nonexistent2 || echo fallback',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('fallback');
    });
  });

  describe('Semicolon Operator (;)', () => {
    it('should execute both commands regardless of exit codes', async () => {
      const result = await pipelineManager.executeCommand(
        'echo first; echo second',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('first\nsecond');
    });

    it('should continue after failed command', async () => {
      const result = await pipelineManager.executeCommand(
        'cat /nonexistent-file; echo still-runs',
        options
      );
      
      // Exit code should be from the last command (echo), which succeeds
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('still-runs');
      expect(result.stderr).toContain('No such file');
    });

    it('should handle multiple semicolon operations', async () => {
      const result = await pipelineManager.executeCommand(
        'echo first; echo second; echo third',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('first\nsecond\nthird');
    });
  });

  describe('Mixed Operators', () => {
    it('should handle AND followed by OR', async () => {
      const result = await pipelineManager.executeCommand(
        'echo success && echo also-success || echo fallback',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('success\nalso-success');
    });

    it('should handle failed AND followed by OR', async () => {
      const result = await pipelineManager.executeCommand(
        'cat /nonexistent && echo wont-run || echo fallback',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('fallback');
    });

    it('should handle complex mixed chains', async () => {
      // Create test files
      await fs.writeFile(path.join(tempDir, 'exists.txt'), 'content');
      
      const result = await pipelineManager.executeCommand(
        `cat ${path.join(tempDir, 'exists.txt')} && echo found || echo not-found; echo done`,
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('content\nfound\ndone');
    });
  });

  describe('Integration with Pipes and Redirections', () => {
    it('should combine command chaining with pipes', async () => {
      const result = await pipelineManager.executeCommand(
        'echo "hello world" | grep hello && echo success',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello world\nsuccess');
    });

    it('should combine command chaining with redirections', async () => {
      const outputFile = path.join(tempDir, 'output.txt');
      
      const result = await pipelineManager.executeCommand(
        `echo "first" > ${outputFile} && echo "second" >> ${outputFile}`,
        options
      );
      
      expect(result.exitCode).toBe(0);
      
      const fileContent = await fs.readFile(outputFile, 'utf-8');
      expect(fileContent).toBe('first\nsecond\n');
    });

    it('should handle failed pipe in chain', async () => {
      const result = await pipelineManager.executeCommand(
        'echo "hello" | grep "xyz" && echo success || echo failed',
        options
      );
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('failed');
    });
  });

  describe('CommandExecutor Integration', () => {
    it('should handle command chains through CommandExecutor', async () => {
      const cmdOptions: CommandOptions = {
        currentDirectory: tempDir,
        env: process.env as Record<string, string>,
      };
      
      const result = await commandExecutor.execute('echo hello && echo world', cmdOptions);
      
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello\nworld');
    });

    it('should properly route chains vs non-chains in CommandExecutor', async () => {
      const cmdOptions: CommandOptions = {
        currentDirectory: tempDir,
        env: process.env as Record<string, string>,
      };
      
      // Non-chain should work normally
      const result1 = await commandExecutor.execute('echo simple', cmdOptions);
      expect(result1.exitCode).toBe(0);
      expect(result1.stdout.trim()).toBe('simple');
      
      // Chain should work through pipeline manager
      const result2 = await commandExecutor.execute('echo first && echo second', cmdOptions);
      expect(result2.exitCode).toBe(0);
      expect(result2.stdout).toBe('first\nsecond');
    });
  });

  describe('Error Handling', () => {
    it('should handle syntax errors gracefully', async () => {
      // Malformed command
      const result = await pipelineManager.executeCommand('echo hello &&', options);
      
      // Should not crash, and should have some error indication
      expect(result.exitCode).toBe(0); // Empty command after && just gets skipped
    });

    it('should handle complex error scenarios', async () => {
      const result = await pipelineManager.executeCommand(
        'nonexistent-command && echo should-not-run || echo recovery; echo final',
        options
      );
      
      expect(result.exitCode).toBe(0); // Final command succeeds
      expect(result.stdout).toBe('recovery\nfinal');
    });
  });
});