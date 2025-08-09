import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export interface CompletionResult {
  completions: string[];
  commonPrefix: string;
}

export class TabCompletion {
  private builtinCommands: Set<string>;
  private cachedPath: string[] = [];

  constructor(builtinCommands: string[]) {
    this.builtinCommands = new Set(builtinCommands);
    this.loadPathCommands();
  }

  private async loadPathCommands(): Promise<void> {
    const pathDirs = (process.env.PATH || '').split(':').filter(Boolean);
    const commands = new Set<string>();

    try {
      for (const dir of pathDirs) {
        try {
          const entries = await fs.readdir(dir);
          entries.forEach(entry => commands.add(entry));
        } catch {
          // ディレクトリにアクセスできない場合は無視 🤷‍♂️
        }
      }
      this.cachedPath = Array.from(commands);
    } catch (error) {
      console.error('Failed to load PATH commands:', error);
    }
  }

  async complete(input: string, cursorPosition: number = input.length): Promise<CompletionResult> {
    const beforeCursor = input.slice(0, cursorPosition);
    const words = beforeCursor.split(/\s+/);
    const currentWord = words[words.length - 1] || '';

    // 最初の単語の場合はコマンド補完 🔍
    if (words.length === 1 || (words.length === 2 && beforeCursor.endsWith(' ') === false)) {
      return this.completeCommand(currentWord);
    }

    // ファイル/ディレクトリ補完 📁
    return this.completeFilePath(currentWord);
  }

  private async completeCommand(prefix: string): Promise<CompletionResult> {
    const allCommands = [
      ...Array.from(this.builtinCommands),
      ...this.cachedPath,
    ];

    const matches = allCommands
      .filter(cmd => cmd.startsWith(prefix))
      .sort();

    return {
      completions: matches,
      commonPrefix: this.findCommonPrefix(matches),
    };
  }

  private async completeFilePath(prefix: string): Promise<CompletionResult> {
    try {
      // 絶対パスか相対パスか判断 🗺️
      const isAbsolute = prefix.startsWith('/');
      const expandedPrefix = prefix.startsWith('~/') 
        ? path.join(process.env.HOME || '/', prefix.slice(2))
        : prefix;

      const dirname = path.dirname(expandedPrefix);
      const basename = path.basename(expandedPrefix);
      
      // ディレクトリが存在するかチェック 📋
      const targetDir = dirname === '.' ? process.cwd() : dirname;
      
      try {
        const entries = await fs.readdir(targetDir, { withFileTypes: true });
        const matches = entries
          .filter(entry => entry.name.startsWith(basename))
          .map(entry => {
            const fullName = entry.isDirectory() ? `${entry.name}/` : entry.name;
            return dirname === '.' ? fullName : path.join(dirname, fullName);
          })
          .sort();

        return {
          completions: matches,
          commonPrefix: this.findCommonPrefix(matches),
        };
      } catch {
        // ディレクトリが存在しない場合 🚫
        return { completions: [], commonPrefix: '' };
      }
    } catch (error) {
      return { completions: [], commonPrefix: '' };
    }
  }

  private findCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];

    let commonPrefix = '';
    const firstString = strings[0];

    for (let i = 0; i < firstString.length; i++) {
      const char = firstString[i];
      if (strings.every(str => str[i] === char)) {
        commonPrefix += char;
      } else {
        break;
      }
    }

    return commonPrefix;
  }

  // グロブパターンマッチング 🎯
  async globComplete(pattern: string): Promise<string[]> {
    try {
      const matches = await glob(pattern, { 
        cwd: process.cwd(),
        dot: true,
      });
      return matches.sort();
    } catch {
      return [];
    }
  }
}