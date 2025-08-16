/**
 * JSH 設定管理
 * アニメーションやUI設定を管理
 */

export interface JshSettings {
  animation: {
    enabled: boolean;
    sparkleIntervalMs: number;
    pauseOnBattery: boolean;
  };
  ui: {
    showFullPromptInHistory: boolean;
    colorScheme: 'default' | 'minimal' | 'vibrant';
  };
}

export const DEFAULT_SETTINGS: JshSettings = {
  animation: {
    enabled: true,
    sparkleIntervalMs: 350,
    pauseOnBattery: false,
  },
  ui: {
    showFullPromptInHistory: true,
    colorScheme: 'default',
  },
};

/**
 * 設定の取得（将来的にファイルやenv variablesから読み込み予定）
 */
export function getSettings(): JshSettings {
  // TODO: 設定ファイル (~/.jshrc) からの読み込み
  // TODO: 環境変数からの上書き
  // 現在は デフォルト設定のみ
  
  const settings = { ...DEFAULT_SETTINGS };
  
  // 環境変数での上書き例
  if (process.env.JSH_ANIMATION === 'false') {
    settings.animation.enabled = false;
  }
  
  if (process.env.JSH_ANIMATION_INTERVAL) {
    const interval = parseInt(process.env.JSH_ANIMATION_INTERVAL);
    if (!isNaN(interval) && interval > 0) {
      settings.animation.sparkleIntervalMs = interval;
    }
  }
  
  return settings;
}

/**
 * バッテリー状態の簡易チェック（Linux向け）
 */
export function isBatteryPowered(): boolean {
  try {
    // Linux の /sys/class/power_supply/ から情報を取得
    // 簡易実装: 実際のバッテリー検出はより複雑
    return false; // 現在は常にfalse（AC電源前提）
  } catch {
    return false;
  }
}