export interface GitFeature {
  enabled: boolean
  showBranch: boolean
  showChanges: boolean
  compactMode: boolean
}

export function generateGitBashCode(config: GitFeature, colors: boolean): string {
  if (!config.enabled) return ''

  const colorCode = colors ? `
# ---- git colors (as variables) ----
if [ "$use_color" -eq 1 ]; then
  CLR_GIT=$'\\033[38;5;150m'        # soft green
  CLR_STAGED=$'\\033[38;5;114m'     # green
  CLR_UNSTAGED=$'\\033[38;5;215m'   # orange/peach
  CLR_NEWFILE=$'\\033[38;5;81m'     # cyan
  CLR_SEP=$'\\033[38;5;245m'        # gray
  CLR_LINES_ADD=$'\\033[38;5;114m'  # green
  CLR_LINES_REM=$'\\033[38;5;203m'  # red
else
  CLR_GIT=""; CLR_STAGED=""; CLR_UNSTAGED=""; CLR_NEWFILE=""; CLR_SEP=""
  CLR_LINES_ADD=""; CLR_LINES_REM=""
fi
` : `
CLR_GIT=""; CLR_STAGED=""; CLR_UNSTAGED=""; CLR_NEWFILE=""; CLR_SEP=""
CLR_LINES_ADD=""; CLR_LINES_REM=""
`

  return `${colorCode}
# ---- git ----
git_branch=""
git_staged=0
git_unstaged=0
git_new=0
git_lines_added=0
git_lines_removed=0
if git rev-parse --git-dir >/dev/null 2>&1; then
  git_branch=$(git branch --show-current 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
  # Count staged files (index changes)
  git_staged=$(git diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
  # Count unstaged modified files
  git_unstaged=$(git diff --numstat 2>/dev/null | wc -l | tr -d ' ')
  # Count untracked files
  git_new=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
  # Count lines added/removed (staged + unstaged)
  diff_stats=$(git diff --numstat HEAD 2>/dev/null | awk '{added+=$1; removed+=$2} END {print added+0, removed+0}')
  git_lines_added=$(echo "$diff_stats" | cut -d' ' -f1)
  git_lines_removed=$(echo "$diff_stats" | cut -d' ' -f2)
fi`
}

export function generateGitDisplayCode(config: GitFeature, colors: boolean, emojis: boolean): string {
  if (!config.enabled) return ''

  const branchEmoji = emojis ? '🌿' : 'git:'

  let displayCode = `
# git display
if [ -n "$git_branch" ]; then
  printf '  ${branchEmoji} %b%s%b' "\$CLR_GIT" "$git_branch" "\$CLR_RST"
fi`

  return displayCode
}

export function generateGitUtilities(): string {
  return `
# git utilities
num_or_zero() { v="$1"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }`
}