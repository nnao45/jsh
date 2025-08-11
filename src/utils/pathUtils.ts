import os from 'os';
import path from 'path';

/**
 * パスを短縮表示用に変換（~/表記など）
 */
export function getShortPath(fullPath: string): string {
  const home = os.homedir();
  if (fullPath.startsWith(home)) {
    return fullPath.replace(home, '~');
  }
  return fullPath;
}

/**
 * プロンプト用のディレクトリ表示を生成
 */
export function formatPromptPath(currentDirectory: string): string {
  const shortPath = getShortPath(currentDirectory);
  const basename = path.basename(shortPath);
  
  // ホームディレクトリの場合
  if (shortPath === '~') {
    return '🏠 ~';
  }
  
  // ルートディレクトリの場合
  if (shortPath === '/') {
    return '🏠 /';
  }
  
  // その他の場合は最後のディレクトリ名を強調
  return `🏠 ${shortPath}`;
}

/**
 * プロンプト行全体を生成
 */
export function generatePromptLine(currentDirectory: string, user?: string): string {
  return `$ `;
}