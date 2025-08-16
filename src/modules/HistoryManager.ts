import fs from 'fs/promises';
import path from 'path';
import os from 'os';

export interface HistoryOptions {
  maxHistorySize: number;
  historyFile?: string;
  saveHistory: boolean;
  saveFailedCommands: boolean;
}

export class HistoryManager {
  private history: string[] = [];
  private options: HistoryOptions;
  private historyFilePath: string;

  constructor(options: HistoryOptions) {
    this.options = options;
    // デフォルトの履歴ファイルパスを設定
    this.historyFilePath = options.historyFile || path.join(os.homedir(), '.jsh_history');
  }

  /**
   * 履歴ファイルから履歴を読み込む
   */
  async loadHistory(): Promise<string[]> {
    if (!this.options.saveHistory) {
      return [];
    }

    try {
      const fileContent = await fs.readFile(this.historyFilePath, 'utf-8');
      const lines = fileContent
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);
      
      // 重複を除去し、最大数を制限
      this.history = this.deduplicateHistory(lines);
      this.limitHistorySize();
      
      return this.history;
    } catch (error) {
      // ファイルが存在しない場合は空の履歴を返す
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        this.history = [];
        return [];
      }
      
      // その他のエラー（権限不足など）の場合はログに出力して空の履歴を返す
      console.warn(`履歴ファイルの読み込みに失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.history = [];
      return [];
    }
  }

  /**
   * 履歴ファイルに履歴を保存する
   */
  async saveHistory(): Promise<void> {
    if (!this.options.saveHistory || this.history.length === 0) {
      return;
    }

    try {
      // ディレクトリが存在しない場合は作成
      const historyDir = path.dirname(this.historyFilePath);
      await fs.mkdir(historyDir, { recursive: true });
      
      // 履歴をファイルに書き込み
      const content = this.history.join('\n') + '\n';
      await fs.writeFile(this.historyFilePath, content, 'utf-8');
    } catch (error) {
      console.warn(`履歴ファイルの保存に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * コマンドを履歴に追加
   */
  async addCommand(command: string, exitCode?: number): Promise<void> {
    if (!command.trim() || !this.options.saveHistory) {
      return;
    }

    // 失敗したコマンドの保存設定をチェック
    if (exitCode !== undefined && exitCode !== 0 && !this.options.saveFailedCommands) {
      return;
    }

    // 前回と同じコマンドの場合は追加しない
    if (this.history.length > 0 && this.history[this.history.length - 1] === command.trim()) {
      return;
    }

    // 履歴に追加
    this.history.push(command.trim());
    
    // 重複を除去し、最大数を制限
    this.deduplicateHistory();
    this.limitHistorySize();
    
    // ファイルに保存
    await this.saveHistory();
  }

  /**
   * 現在の履歴を取得
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * 履歴をクリア
   */
  async clearHistory(): Promise<void> {
    this.history = [];
    
    if (this.options.saveHistory) {
      try {
        await fs.unlink(this.historyFilePath);
      } catch (error) {
        // ファイルが存在しない場合は無視
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          console.warn(`履歴ファイルの削除に失敗: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }
  }

  /**
   * 履歴の重複を除去（最新のものを保持）
   */
  private deduplicateHistory(inputHistory?: string[]): string[] {
    const targetHistory = inputHistory || this.history;
    const seen = new Set<string>();
    const deduplicated: string[] = [];
    
    // 逆順で処理して最新のものを保持
    for (let i = targetHistory.length - 1; i >= 0; i--) {
      const command = targetHistory[i];
      if (!seen.has(command)) {
        seen.add(command);
        deduplicated.unshift(command);
      }
    }
    
    if (!inputHistory) {
      this.history = deduplicated;
    }
    
    return deduplicated;
  }

  /**
   * 履歴のサイズを制限
   */
  private limitHistorySize(): void {
    if (this.history.length > this.options.maxHistorySize) {
      this.history = this.history.slice(-this.options.maxHistorySize);
    }
  }

  /**
   * 履歴ファイルのパスを取得
   */
  getHistoryFilePath(): string {
    return this.historyFilePath;
  }

  /**
   * 履歴の統計情報を取得
   */
  getStats(): { totalCommands: number; filePath: string; isEnabled: boolean } {
    return {
      totalCommands: this.history.length,
      filePath: this.historyFilePath,
      isEnabled: this.options.saveHistory,
    };
  }
}