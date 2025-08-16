/**
 * Parse command line string respecting quotes and escapes
 */
export function parseCommandLine(input: string): { command: string; args: string[] } {
  const tokens = tokenizeCommand(input.trim());
  
  if (tokens.length === 0) {
    return { command: '', args: [] };
  }
  
  return {
    command: tokens[0],
    args: tokens.slice(1),
  };
}

/**
 * Tokenize command string respecting quotes and escapes
 */
function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escaped = false;
  
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    
    if (escaped) {
      // Previous character was escape, add current character literally
      current += char;
      escaped = false;
      continue;
    }
    
    if (char === '\\' && (inSingleQuote || inDoubleQuote)) {
      // Escape character inside quotes
      escaped = true;
      continue;
    }
    
    if (char === "'" && !inDoubleQuote) {
      // Single quote (only if not inside double quotes)
      if (inSingleQuote) {
        // Closing quote - add current token even if empty
        tokens.push(current);
        current = '';
        inSingleQuote = false;
      } else {
        // Opening quote
        if (current) {
          tokens.push(current);
          current = '';
        }
        inSingleQuote = true;
      }
      continue;
    }
    
    if (char === '"' && !inSingleQuote) {
      // Double quote (only if not inside single quotes)
      if (inDoubleQuote) {
        // Closing quote - add current token even if empty
        tokens.push(current);
        current = '';
        inDoubleQuote = false;
      } else {
        // Opening quote
        if (current) {
          tokens.push(current);
          current = '';
        }
        inDoubleQuote = true;
      }
      continue;
    }
    
    if (!inSingleQuote && !inDoubleQuote && /\s/.test(char)) {
      // Whitespace outside quotes - end current token
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    
    // Regular character - add to current token
    current += char;
  }
  
  // Add final token if exists
  if (current) {
    tokens.push(current);
  }
  
  return tokens;
}

/**
 * Simple command line parsing for basic cases
 */
export function parseSimpleCommand(input: string): { command: string; args: string[] } {
  // For simple cases without complex quoting
  const parts = input.trim().split(/\s+/);
  return {
    command: parts[0] || '',
    args: parts.slice(1),
  };
}

/**
 * Test if input contains complex quoting that needs special parsing
 */
export function needsComplexParsing(input: string): boolean {
  return /['"]/.test(input);
}