export interface GitFeature {
  enabled: boolean
  showBranch: boolean
  showChanges: boolean
  compactMode: boolean
}

export function generateGitBashCode(config: GitFeature, colors: boolean): string {
  if (!config.enabled) return ''

  const colorCode = colors ? `
# ---- git colors ----
git_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;150m'; fi; }  # soft green
rst() { if [ "$use_color" -eq 1 ]; then printf '\\033[0m'; fi; }
# ---- git status colors ----
staged_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;114m'; fi; }    # green
unstaged_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;215m'; fi; }  # orange/peach
newfile_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;81m'; fi; }    # cyan
sep_color() { if [ "$use_color" -eq 1 ]; then printf '\\033[38;5;245m'; fi; }       # gray
` : `
git_color() { :; }
rst() { :; }
staged_color() { :; }
unstaged_color() { :; }
newfile_color() { :; }
sep_color() { :; }
`

  return `${colorCode}

# ---- git ----
git_branch=""
git_staged=0
git_unstaged=0
git_new=0
if git rev-parse --git-dir >/dev/null 2>&1; then
  git_branch=$(git branch --show-current 2>/dev/null || git rev-parse --short HEAD 2>/dev/null)
  # Count staged files (index changes)
  git_staged=$(git diff --cached --numstat 2>/dev/null | wc -l | tr -d ' ')
  # Count unstaged modified files
  git_unstaged=$(git diff --numstat 2>/dev/null | wc -l | tr -d ' ')
  # Count untracked files
  git_new=$(git ls-files --others --exclude-standard 2>/dev/null | wc -l | tr -d ' ')
fi`
}

export function generateGitDisplayCode(config: GitFeature, colors: boolean, emojis: boolean): string {
  if (!config.enabled) return ''

  const branchEmoji = emojis ? '🌿' : 'git:'

  let displayCode = `
# git display
if [ -n "$git_branch" ]; then
  printf '  ${branchEmoji} %s%s%s' "$(git_color)" "$git_branch" "$(rst)"
fi`

  return displayCode
}

export function generateGitUtilities(): string {
  return `
# git utilities
num_or_zero() { v="$1"; [[ "$v" =~ ^[0-9]+$ ]] && echo "$v" || echo 0; }`
}