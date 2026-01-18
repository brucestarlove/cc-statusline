export interface ColorConfig {
  enabled: boolean
  theme: 'minimal' | 'detailed' | 'compact'
}

export function generateColorBashCode(config: ColorConfig): string {
  if (!config.enabled) {
    return `
# ---- color variables (disabled) ----
use_color=0
CLR_RST=""
`
  }

  return `
# ---- color variables (force colors for Claude Code) ----
use_color=1
[ -n "$NO_COLOR" ] && use_color=0

# Pre-compute color codes as variables to prevent escape sequence fragmentation
if [ "$use_color" -eq 1 ]; then
  CLR_RST=$'\\033[0m'
else
  CLR_RST=""
fi
`
}

export function generateBasicColors(): string {
  return `
# ---- modern sleek colors (as variables) ----
if [ "$use_color" -eq 1 ]; then
  CLR_DIR=$'\\033[38;5;117m'      # sky blue
  CLR_MODEL=$'\\033[38;5;147m'    # light purple
  CLR_VERSION=$'\\033[38;5;180m'  # soft yellow
  CLR_CC_VER=$'\\033[38;5;249m'   # light gray
  CLR_STYLE=$'\\033[38;5;245m'    # gray
else
  CLR_DIR=""; CLR_MODEL=""; CLR_VERSION=""; CLR_CC_VER=""; CLR_STYLE=""
fi
`
}

export const COLOR_CODES = {
  // Basic colors
  BLACK: '30',
  RED: '31', 
  GREEN: '32',
  YELLOW: '33',
  BLUE: '34',
  MAGENTA: '35',
  CYAN: '36',
  WHITE: '37',
  
  // Bright colors (bold)
  BRIGHT_BLACK: '1;30',
  BRIGHT_RED: '1;31',
  BRIGHT_GREEN: '1;32', 
  BRIGHT_YELLOW: '1;33',
  BRIGHT_BLUE: '1;34',
  BRIGHT_MAGENTA: '1;35',
  BRIGHT_CYAN: '1;36',
  BRIGHT_WHITE: '1;37',
  
  // Reset
  RESET: '0'
} as const

export function getThemeColors(theme: 'minimal' | 'detailed' | 'compact') {
  switch (theme) {
    case 'minimal':
      return {
        directory: COLOR_CODES.CYAN,
        git: COLOR_CODES.GREEN,
        model: COLOR_CODES.MAGENTA,
        usage: COLOR_CODES.YELLOW,
        session: COLOR_CODES.BLUE
      }
    case 'detailed':
      return {
        directory: COLOR_CODES.BRIGHT_CYAN,
        git: COLOR_CODES.BRIGHT_GREEN,
        model: COLOR_CODES.BRIGHT_MAGENTA,
        usage: COLOR_CODES.BRIGHT_YELLOW,
        session: COLOR_CODES.BRIGHT_BLUE
      }
    case 'compact':
      return {
        directory: COLOR_CODES.CYAN,
        git: COLOR_CODES.GREEN,
        model: COLOR_CODES.BLUE,
        usage: COLOR_CODES.YELLOW,
        session: COLOR_CODES.RED
      }
  }
}