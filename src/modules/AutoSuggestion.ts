export interface SuggestionResult {
  suggestion: string;
  confidence: number;
  source: 'history' | 'completion';
}

export interface AutoSuggestionConfig {
  maxHistoryAge: number; // Days
  minInputLength: number;
  maxSuggestions: number;
  enableFuzzyMatch: boolean;
}



export class AutoSuggestion {
  private config: AutoSuggestionConfig;
  private historyCache: Map<string, string[]> = new Map();
  private lastCacheTime: number = 0;
  private readonly cacheValidityMs = 60000; // 1 minute

  constructor(config: Partial<AutoSuggestionConfig> = {}) {
    this.config = {
      maxHistoryAge: 30, // 30 days
      minInputLength: 1,
      maxSuggestions: 3,
      enableFuzzyMatch: true,
      ...config,
    };
  }

  /**
   * Get suggestion for current input based on history
   */
  getSuggestion(
    currentInput: string,
    history: string[],
    currentDirectory?: string
  ): SuggestionResult | null {
    if (!currentInput || currentInput.length < this.config.minInputLength) {
      return null;
    }

    // Try exact prefix match first
    const exactMatch = this.findExactPrefixMatch(currentInput, history);
    if (exactMatch) {
      return {
        suggestion: exactMatch.slice(currentInput.length),
        confidence: 0.9,
        source: 'history',
      };
    }

    // Try fuzzy matching if enabled
    if (this.config.enableFuzzyMatch) {
      const fuzzyMatch = this.findFuzzyMatch(currentInput, history);
      if (fuzzyMatch) {
        return {
          suggestion: fuzzyMatch.slice(currentInput.length),
          confidence: 0.7,
          source: 'history',
        };
      }
    }

    return null;
  }

  /**
   * Find exact prefix match from history
   */
  private findExactPrefixMatch(input: string, history: string[]): string | null {
    // Search from most recent to oldest
    const reversedHistory = [...history].reverse();
    
    for (const command of reversedHistory) {
      if (command.startsWith(input) && command.length > input.length) {
        return command;
      }
    }

    return null;
  }

  /**
   * Find fuzzy match using various strategies
   */
  private findFuzzyMatch(input: string, history: string[]): string | null {
    const reversedHistory = [...history].reverse();
    const candidates: Array<{ command: string; score: number }> = [];

    for (const command of reversedHistory) {
      if (command.length <= input.length) continue;

      // Strategy 1: Substring match
      if (command.includes(input)) {
        candidates.push({ command, score: 0.8 });
        continue;
      }

      // Strategy 2: Word boundary match
      const words = command.split(/\s+/);
      const inputWords = input.split(/\s+/);
      
      if (inputWords.length > 0 && words.length >= inputWords.length) {
        let wordMatchScore = 0;
        let allWordsMatch = true;

        for (let i = 0; i < inputWords.length; i++) {
          const inputWord = inputWords[i];
          const commandWord = words[i];
          
          if (commandWord && commandWord.startsWith(inputWord)) {
            wordMatchScore += 1;
          } else {
            allWordsMatch = false;
            break;
          }
        }

        if (allWordsMatch) {
          const score = wordMatchScore / inputWords.length * 0.6;
          candidates.push({ command, score });
          continue;
        }
      }

      // Strategy 3: Levenshtein distance (for short inputs)
      if (input.length >= 3 && input.length <= 8) {
        const distance = this.levenshteinDistance(input, command.slice(0, input.length + 5));
        if (distance <= 2) {
          const score = Math.max(0, 1 - distance / input.length) * 0.4;
          candidates.push({ command, score });
        }
      }
    }

    // Sort by score and return best match
    candidates.sort((a, b) => b.score - a.score);
    return candidates.length > 0 ? candidates[0].command : null;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  /**
   * Get multiple suggestions for autocompletion dropdown
   */
  getMultipleSuggestions(
    currentInput: string,
    history: string[],
    currentDirectory?: string
  ): SuggestionResult[] {
    if (!currentInput || currentInput.length < this.config.minInputLength) {
      return [];
    }

    const suggestions: SuggestionResult[] = [];
    const seenCommands = new Set<string>();
    const reversedHistory = [...history].reverse();

    // Collect exact matches
    for (const command of reversedHistory) {
      if (suggestions.length >= this.config.maxSuggestions) break;
      
      if (command.startsWith(currentInput) && 
          command.length > currentInput.length && 
          !seenCommands.has(command)) {
        
        suggestions.push({
          suggestion: command.slice(currentInput.length),
          confidence: 0.9,
          source: 'history',
        });
        seenCommands.add(command);
      }
    }

    // If we don't have enough exact matches, add fuzzy matches
    if (suggestions.length < this.config.maxSuggestions && this.config.enableFuzzyMatch) {
      for (const command of reversedHistory) {
        if (suggestions.length >= this.config.maxSuggestions) break;
        
        if (!seenCommands.has(command) && 
            command.includes(currentInput) && 
            command.length > currentInput.length) {
          
          // For fuzzy matches, we suggest the full command
          suggestions.push({
            suggestion: command,
            confidence: 0.6,
            source: 'history',
          });
          seenCommands.add(command);
        }
      }
    }

    return suggestions;
  }

  /**
   * Learn from user acceptance/rejection of suggestions
   */
  recordFeedback(
    input: string, 
    suggestion: string, 
    accepted: boolean,
    source: 'history' | 'completion'
  ): void {
    // This could be used for machine learning improvements
    // For now, we'll just implement a simple frequency tracking
    const key = `${input}:${suggestion}`;
    
    if (accepted) {
      // Could increase confidence for similar patterns
      console.debug(`AutoSuggestion: Accepted suggestion '${suggestion}' for input '${input}'`);
    } else {
      // Could decrease confidence for similar patterns
      console.debug(`AutoSuggestion: Rejected suggestion '${suggestion}' for input '${input}'`);
    }
  }

  /**
   * Clear internal caches
   */
  clearCache(): void {
    this.historyCache.clear();
    this.lastCacheTime = 0;
  }

  /**
   * Get statistics about suggestions
   */
  getStats(): {
    cacheSize: number;
    lastCacheTime: number;
    config: AutoSuggestionConfig;
  } {
    return {
      cacheSize: this.historyCache.size,
      lastCacheTime: this.lastCacheTime,
      config: { ...this.config },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<AutoSuggestionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Check if input should trigger suggestions
   */
  shouldSuggest(input: string): boolean {
    return input.length >= this.config.minInputLength && 
           !input.endsWith(' ') && // Don't suggest at word boundaries
           !input.includes('|') && // Don't suggest in pipes
           !input.includes('>') && // Don't suggest in redirections
           !input.includes('<');
  }

  /**
   * Filter history to remove old or irrelevant entries
   */
  private filterRelevantHistory(history: string[]): string[] {
    // Remove duplicates while preserving order
    const seen = new Set<string>();
    const filtered = [];
    
    for (let i = history.length - 1; i >= 0; i--) {
      const command = history[i];
      if (command && command.trim() && !seen.has(command)) {
        seen.add(command);
        filtered.unshift(command);
      }
    }

    return filtered;
  }
}