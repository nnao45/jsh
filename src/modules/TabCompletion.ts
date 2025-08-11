import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

export interface CompletionResult {
  completions: string[];
  commonPrefix: string;
  baseInput: string;        // 元の入力（置換されない部分）
  completionStart: number;  // 補完が開始される位置
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
    
    // 現在の単語の開始位置を計算 📍
    const currentWordStart = beforeCursor.length - currentWord.length;
    const baseInput = input.slice(0, currentWordStart);

    // 最初の単語の場合はコマンド補完 🔍
    if (words.length === 1) {
      const result = await this.completeCommand(currentWord);
      return {
        ...result,
        baseInput,
        completionStart: currentWordStart,
      };
    }

    // ファイル/ディレクトリ補完 📁
    const result = await this.completeFilePath(currentWord);
    return {
      ...result,
      baseInput,
      completionStart: currentWordStart,
    };
  }

  private async completeCommand(prefix: string): Promise<Omit<CompletionResult, 'baseInput' | 'completionStart'>> {
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

  private async completeFilePath(prefix: string): Promise<Omit<CompletionResult, 'baseInput' | 'completionStart'>> {
    try {
      // 絶対パスか相対パスか判断 🗺️
      const isAbsolute = prefix.startsWith('/');
      const expandedPrefix = prefix.startsWith('~/') 
        ? path.join(process.env.HOME || '/', prefix.slice(2))
        : prefix;

      // 末尾スラッシュの特別処理 🔧
      let dirname: string;
      let basename: string;
      
      if (expandedPrefix.endsWith('/') && expandedPrefix.length > 1) {
        // 末尾スラッシュがある場合（/etc/ など）
        dirname = expandedPrefix.slice(0, -1); // 末尾スラッシュを除去
        basename = ''; // 全てのファイルを対象
      } else {
        dirname = path.dirname(expandedPrefix);
        basename = path.basename(expandedPrefix);
      }
      
      // ディレクトリが存在するかチェック 📋
      const targetDir = dirname === '.' ? process.cwd() : dirname;
      
      try {
        const entries = await fs.readdir(targetDir, { withFileTypes: true });
        const matches = entries
          .filter(entry => entry.name.startsWith(basename))
          .map(entry => {
            const fullName = entry.isDirectory() ? `${entry.name}/` : entry.name;
            
            // 末尾スラッシュがある場合の特別処理 🎯
            if (expandedPrefix.endsWith('/') && expandedPrefix.length > 1) {
              // 例: "/etc/" の場合、"passwd" → "/etc/passwd" を返す
              return path.join(dirname, fullName);
            } else {
              // 通常の処理
              return dirname === '.' ? fullName : path.join(dirname, fullName);
            }
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