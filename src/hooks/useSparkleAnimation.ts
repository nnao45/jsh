import { useState, useEffect, useMemo } from 'react';

export interface SparkleFrame {
  symbols: Array<{ char: string; color: string; }>;
  bold: boolean;
  dim: boolean;
}

export interface SparkleAnimationOptions {
  enabled?: boolean;
  intervalMs?: number;
}

// 固定記号（3文字の配列）
const PROMPT_CHARS = ['❯', '❯', '❯'];

// 色の配列（ランダム選択用）
const COLORS = [
  'red', 'green', 'yellow', 'blue', 'magenta', 'cyan',
  'redBright', 'greenBright', 'yellowBright', 'blueBright',
  'magentaBright', 'cyanBright'
];

/**
 * ❯❯❯ プロンプトアニメーションhook
 * 色をランダムに変更してカラフルなプロンプト表示
 */
export function useSparkleAnimation(options: SparkleAnimationOptions = {}): SparkleFrame {
  const { enabled = true, intervalMs = 350 } = options;
  const [frameIndex, setFrameIndex] = useState(0);

  // ランダム色選択関数
  const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

  // 各文字の色を生成する関数
  const generateColoredChars = () => {
    return PROMPT_CHARS.map(char => ({
      char,
      color: getRandomColor()
    }));
  };

  // 色変更用の状態（各文字に個別の色）
  const [coloredChars, setColoredChars] = useState(() => generateColoredChars());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const timer = setInterval(() => {
      setColoredChars(generateColoredChars());
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }, [enabled, intervalMs]);

  // アニメーション無効時は静的なフレームを返す
  if (!enabled) {
    return { 
      symbols: PROMPT_CHARS.map(char => ({ char, color: 'cyan' })),
      bold: false, 
      dim: false 
    };
  }

  // ランダムな色で各文字を返す
  return {
    symbols: coloredChars,
    bold: false,
    dim: false
  };
}