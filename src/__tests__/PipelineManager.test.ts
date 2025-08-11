import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { PipelineManager, Pipeline } from '../modules/PipelineManager.js';
import { PipelineOptions } from '../types/shell.js';

describe('PipelineManager', () => {
  let pipelineManager: PipelineManager;
  let tempDir: string;
  let options: PipelineOptions;

  beforeEach(async () => {
    pipelineManager = new PipelineManager();
    tempDir = await fs.mkdtemp(path.join(process.cwd(), 'test-tmp-'));
    
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

  describe('parsePipeline', () => {
    it('should parse simple command', () => {
      const result = pipelineManager.parsePipeline('ls -la');
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].command).toBe('ls');
      expect(result.commands[0].args).toEqual(['-la']);
      expect(result.background).toBe(false);
    });

    it('should parse pipe commands', () => {
      const result = pipelineManager.parsePipeline('ls -la | grep test | wc -l');
      expect(result.commands).toHaveLength(3);
      
      expect(result.commands[0].command).toBe('ls');
      expect(result.commands[0].args).toEqual(['-la']);
      
      expect(result.commands[1].command).toBe('grep');
      expect(result.commands[1].args).toEqual(['test']);
      
      expect(result.commands[2].command).toBe('wc');
      expect(result.commands[2].args).toEqual(['-l']);
    });

    it('should parse background command', () => {
      const result = pipelineManager.parsePipeline('sleep 10 &');
      expect(result.background).toBe(true);
      expect(result.commands[0].command).toBe('sleep');
      expect(result.commands[0].args).toEqual(['10']);
    });

    it('should parse output redirection', () => {
      const result = pipelineManager.parsePipeline('echo hello > output.txt');
      expect(result.commands).toHaveLength(1);
      expect(result.commands[0].command).toBe('echo');
      expect(result.commands[0].args).toEqual(['hello']);
      expect(result.commands[0].redirections).toHaveLength(1);
      expect(result.commands[0].redirections[0]).toEqual({
        type: '>',
        target: 'output.txt',
        append: false,
      });
    });

    it('should parse append redirection', () => {
      const result = pipelineManager.parsePipeline('echo world >> output.txt');
      expect(result.commands[0].redirections[0]).toEqual({
        type: '>>',
        target: 'output.txt',
        append: true,
      });
    });

    it('should parse input redirection', () => {
      const result = pipelineManager.parsePipeline('sort < input.txt');
      expect(result.commands[0].command).toBe('sort');
      expect(result.commands[0].redirections[0]).toEqual({
        type: '<',
        target: 'input.txt',
        append: false,
      });
    });

    it('should handle quoted arguments', () => {
      const result = pipelineManager.parsePipeline('echo "hello world" | grep "hello"');
      expect(result.commands[0].args).toEqual(['hello world']);
      expect(result.commands[1].args).toEqual(['hello']);
    });

    it('should handle complex pipeline with redirections', () => {
      const result = pipelineManager.parsePipeline('cat input.txt | grep pattern > output.txt');
      expect(result.commands).toHaveLength(2);
      
      expect(result.commands[0].command).toBe('cat');
      expect(result.commands[0].args).toEqual(['input.txt']);
      
      expect(result.commands[1].command).toBe('grep');
      expect(result.commands[1].args).toEqual(['pattern']);
      expect(result.commands[1].redirections).toHaveLength(1);
      expect(result.commands[1].redirections[0].type).toBe('>');
      expect(result.commands[1].redirections[0].target).toBe('output.txt');
    });
  });

  describe('executePipeline - E2E Tests', () => {
    it('should execute simple command', async () => {
      const pipeline: Pipeline = {
        commands: [{ command: 'echo', args: ['hello'], redirections: [] }],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello');
      expect(result.stderr).toBe('');
    });

    it('should execute basic pipe (echo | cat)', async () => {
      const pipeline: Pipeline = {
        commands: [
          { command: 'echo', args: ['test data'], redirections: [] },
          { command: 'cat', args: [], redirections: [] }
        ],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('test data');
    });

    it('should execute pipe with grep', async () => {
      const pipeline: Pipeline = {
        commands: [
          { command: 'echo', args: ['line1\ntest line\nline3'], redirections: [] },
          { command: 'grep', args: ['test'], redirections: [] }
        ],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('test line');
    });

    it('should execute three-stage pipe (echo | grep | wc)', async () => {
      const pipeline: Pipeline = {
        commands: [
          { command: 'echo', args: ['line1\ntest line\nline3'], redirections: [] },
          { command: 'grep', args: ['line'], redirections: [] },
          { command: 'wc', args: ['-l'], redirections: [] }
        ],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      expect(result.stdout.trim()).toBe('3');
    });

    it('should handle output redirection', async () => {
      const outputFile = path.join(tempDir, 'test-output.txt');
      
      const pipeline: Pipeline = {
        commands: [{
          command: 'echo',
          args: ['hello world'],
          redirections: [{ type: '>', target: outputFile, append: false }]
        }],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      
      // Check that file was created with correct content
      const fileContent = await fs.readFile(outputFile, 'utf-8');
      expect(fileContent.trim()).toBe('hello world');
    });

    it('should handle append redirection', async () => {
      const outputFile = path.join(tempDir, 'test-append.txt');
      
      // First write
      await fs.writeFile(outputFile, 'first line\n');
      
      const pipeline: Pipeline = {
        commands: [{
          command: 'echo',
          args: ['second line'],
          redirections: [{ type: '>>', target: outputFile, append: true }]
        }],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      
      const fileContent = await fs.readFile(outputFile, 'utf-8');
      expect(fileContent).toBe('first line\nsecond line\n');
    });

    it('should handle input redirection', async () => {
      const inputFile = path.join(tempDir, 'test-input.txt');
      await fs.writeFile(inputFile, 'line3\nline1\nline2\n');
      
      const pipeline: Pipeline = {
        commands: [{
          command: 'sort',
          args: [],
          redirections: [{ type: '<', target: inputFile, append: false }]
        }],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('line1\nline2\nline3');
    });

    it('should handle complex pipeline with input and output redirection', async () => {
      const inputFile = path.join(tempDir, 'input.txt');
      const outputFile = path.join(tempDir, 'output.txt');
      
      await fs.writeFile(inputFile, 'apple\nbanana\ncherry\ndate\n');
      
      const pipeline: Pipeline = {
        commands: [
          {
            command: 'cat',
            args: [],
            redirections: [{ type: '<', target: inputFile, append: false }]
          },
          { command: 'grep', args: ['a'], redirections: [] },
          {
            command: 'sort',
            args: [],
            redirections: [{ type: '>', target: outputFile, append: false }]
          }
        ],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      
      const outputContent = await fs.readFile(outputFile, 'utf-8');
      expect(outputContent).toBe('apple\nbanana\ndate\n');
    });

    it('should handle command failures in pipeline', async () => {
      const pipeline: Pipeline = {
        commands: [
          { command: 'echo', args: ['test'], redirections: [] },
          { command: 'nonexistentcommand', args: [], redirections: [] }
        ],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain('nonexistentcommand');
    });

    it('should handle missing input file', async () => {
      const pipeline: Pipeline = {
        commands: [{
          command: 'cat',
          args: [],
          redirections: [{ type: '<', target: '/nonexistent/file.txt', append: false }]
        }],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('Cannot open');
    });

    it('should preserve exit codes from pipeline', async () => {
      // grep with no matches should return exit code 1
      const pipeline: Pipeline = {
        commands: [
          { command: 'echo', args: ['hello world'], redirections: [] },
          { command: 'grep', args: ['xyz'], redirections: [] }
        ],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(1); // grep returns 1 when no matches
      expect(result.stdout).toBe('');
    });
  });

  describe('Integration with shell commands', () => {
    it('should work with built-in ls equivalent', async () => {
      // Create some test files
      await fs.writeFile(path.join(tempDir, 'file1.txt'), 'content1');
      await fs.writeFile(path.join(tempDir, 'file2.txt'), 'content2');
      
      const pipeline: Pipeline = {
        commands: [
          { command: 'ls', args: [tempDir], redirections: [] },
          { command: 'grep', args: ['file1'], redirections: [] }
        ],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('file1.txt');
      expect(result.stdout).not.toContain('file2.txt');
    });

    it('should handle mixed pipes and redirections in real scenario', async () => {
      const inputFile = path.join(tempDir, 'names.txt');
      const outputFile = path.join(tempDir, 'sorted_names.txt');
      
      await fs.writeFile(inputFile, 'Bob\nAlice\nCharlie\nDave\n');
      
      // cat names.txt | sort | grep -v Charlie > sorted_names.txt
      const pipeline: Pipeline = {
        commands: [
          {
            command: 'cat',
            args: [],
            redirections: [{ type: '<', target: inputFile, append: false }]
          },
          { command: 'sort', args: [], redirections: [] },
          { command: 'grep', args: ['-v', 'Charlie'], redirections: [] },
          {
            command: 'cat',
            args: [],
            redirections: [{ type: '>', target: outputFile, append: false }]
          }
        ],
        background: false,
      };
      
      const result = await pipelineManager.executePipeline(pipeline, options);
      expect(result.exitCode).toBe(0);
      
      const outputContent = await fs.readFile(outputFile, 'utf-8');
      expect(outputContent).toBe('Alice\nBob\nDave\n');
    });
  });
});