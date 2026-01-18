export interface UsageFeature {
  enabled: boolean
  showCost: boolean
  showTokens: boolean
  showBurnRate: boolean
  showSession: boolean  // This is the only feature requiring ccusage
  showProgressBar: boolean
}

export function generateUsageBashCode(config: UsageFeature, colors: boolean): string {
  if (!config.enabled) return ''

  const colorCode = colors ? `
# ---- usage colors (as variables) ----
if [ "$use_color" -eq 1 ]; then
  CLR_USAGE=$'\\033[38;5;189m'    # lavender
  CLR_COST=$'\\033[38;5;222m'     # light gold
  CLR_BURN=$'\\033[38;5;220m'     # bright gold
else
  CLR_USAGE=""; CLR_COST=""; CLR_BURN=""
fi

# Session reset color is dynamic based on percentage
get_session_reset_color() {
  if [ "$use_color" -eq 1 ]; then
    local rem_pct=$(( 100 - session_pct ))
    if   (( rem_pct <= 10 )); then printf '%s' $'\\033[38;5;210m'  # light pink
    elif (( rem_pct <= 25 )); then printf '%s' $'\\033[38;5;228m'  # light yellow
    else                           printf '%s' $'\\033[38;5;194m'; fi  # light green
  fi
}
` : `
CLR_USAGE=""; CLR_COST=""; CLR_BURN=""
get_session_reset_color() { :; }
`

  // Session reset time is the only feature requiring ccusage
  const needsCcusage = config.showSession || config.showProgressBar

  return `${colorCode}
# ---- cost and usage extraction ----
session_txt=""; session_pct=0; session_bar=""
cost_usd=""; cost_per_hour=""; tpm=""; tot_tokens=""

# Extract cost and token data from Claude Code's native input
if [ "$HAS_JQ" -eq 1 ]; then
  # Cost data
  cost_usd=$(echo "$input" | jq -r '.cost.total_cost_usd // empty' 2>/dev/null)
  total_duration_ms=$(echo "$input" | jq -r '.cost.total_duration_ms // empty' 2>/dev/null)

  # Calculate burn rate ($/hour) from cost and duration
  if [ -n "$cost_usd" ] && [ -n "$total_duration_ms" ] && [ "$total_duration_ms" -gt 0 ]; then
    cost_per_hour=$(echo "$cost_usd $total_duration_ms" | awk '{printf "%.2f", $1 * 3600000 / $2}')
  fi
${config.showTokens ? `
  # Token data from native context_window (no ccusage needed)
  input_tokens=$(echo "$input" | jq -r '.context_window.total_input_tokens // 0' 2>/dev/null)
  output_tokens=$(echo "$input" | jq -r '.context_window.total_output_tokens // 0' 2>/dev/null)

  if [ "$input_tokens" != "null" ] && [ "$output_tokens" != "null" ]; then
    tot_tokens=$(( input_tokens + output_tokens ))
    [ "$tot_tokens" -eq 0 ] && tot_tokens=""
  fi` : ''}
${config.showBurnRate && config.showTokens ? `
  # Calculate tokens per minute from native data
  if [ -n "$tot_tokens" ] && [ -n "$total_duration_ms" ] && [ "$total_duration_ms" -gt 0 ]; then
    # Convert ms to minutes and calculate rate
    tpm=$(echo "$tot_tokens $total_duration_ms" | awk '{if ($2 > 0) printf "%.0f", $1 * 60000 / $2; else print ""}')
  fi` : ''}
else
  # Bash fallback for cost extraction
  cost_usd=$(echo "$input" | grep -o '"total_cost_usd"[[:space:]]*:[[:space:]]*[0-9.]*' | sed 's/.*:[[:space:]]*\\([0-9.]*\\).*/\\1/')
  total_duration_ms=$(echo "$input" | grep -o '"total_duration_ms"[[:space:]]*:[[:space:]]*[0-9]*' | sed 's/.*:[[:space:]]*\\([0-9]*\\).*/\\1/')

  # Calculate burn rate ($/hour) from cost and duration
  if [ -n "$cost_usd" ] && [ -n "$total_duration_ms" ] && [ "$total_duration_ms" -gt 0 ]; then
    cost_per_hour=$(echo "$cost_usd $total_duration_ms" | awk '{printf "%.2f", $1 * 3600000 / $2}')
  fi
${config.showTokens ? `
  # Token data from native context_window (bash fallback)
  input_tokens=$(echo "$input" | grep -o '"total_input_tokens"[[:space:]]*:[[:space:]]*[0-9]*' | sed 's/.*:[[:space:]]*\\([0-9]*\\).*/\\1/')
  output_tokens=$(echo "$input" | grep -o '"total_output_tokens"[[:space:]]*:[[:space:]]*[0-9]*' | sed 's/.*:[[:space:]]*\\([0-9]*\\).*/\\1/')

  if [ -n "$input_tokens" ] && [ -n "$output_tokens" ]; then
    tot_tokens=$(( input_tokens + output_tokens ))
    [ "$tot_tokens" -eq 0 ] && tot_tokens=""
  fi` : ''}
${config.showBurnRate && config.showTokens ? `
  # Calculate tokens per minute from native data
  if [ -n "$tot_tokens" ] && [ -n "$total_duration_ms" ] && [ "$total_duration_ms" -gt 0 ]; then
    tpm=$(echo "$tot_tokens $total_duration_ms" | awk '{if ($2 > 0) printf "%.0f", $1 * 60000 / $2; else print ""}')
  fi` : ''}
fi
${needsCcusage ? `
# Session reset time requires ccusage (only feature that needs external tool)
if command -v ccusage >/dev/null 2>&1 && [ "$HAS_JQ" -eq 1 ]; then
  blocks_output=""

  # Try ccusage with timeout
  if command -v timeout >/dev/null 2>&1; then
    blocks_output=$(timeout 5s ccusage blocks --json 2>/dev/null)
  elif command -v gtimeout >/dev/null 2>&1; then
    blocks_output=$(gtimeout 5s ccusage blocks --json 2>/dev/null)
  else
    blocks_output=$(ccusage blocks --json 2>/dev/null)
  fi

  if [ -n "$blocks_output" ]; then
    active_block=$(echo "$blocks_output" | jq -c '.blocks[] | select(.isActive == true)' 2>/dev/null | head -n1)
    if [ -n "$active_block" ]; then
      # Session time calculation from ccusage
      reset_time_str=$(echo "$active_block" | jq -r '.usageLimitResetTime // .endTime // empty')
      start_time_str=$(echo "$active_block" | jq -r '.startTime // empty')

      if [ -n "$reset_time_str" ] && [ -n "$start_time_str" ]; then
        start_sec=$(to_epoch "$start_time_str"); end_sec=$(to_epoch "$reset_time_str"); now_sec=$(date +%s)
        total=$(( end_sec - start_sec )); (( total<1 )) && total=1
        elapsed=$(( now_sec - start_sec )); (( elapsed<0 ))&&elapsed=0; (( elapsed>total ))&&elapsed=$total
        session_pct=$(( elapsed * 100 / total ))
        remaining=$(( end_sec - now_sec )); (( remaining<0 )) && remaining=0
        rh=$(( remaining / 3600 )); rm=$(( (remaining % 3600) / 60 ))
        end_hm=$(fmt_time_hm "$end_sec")${config.showSession ? `
        session_txt="$(printf '%dh %dm until reset at %s (%d%%)' "$rh" "$rm" "$end_hm" "$session_pct")"` : ''}${config.showProgressBar ? `
        session_bar=$(progress_bar "$session_pct" 10)` : ''}
      fi
    fi
  fi
fi` : ''}`
}

export function generateUsageUtilities(): string {
  return `
# ---- time helpers ----
to_epoch() {
  ts="$1"
  if command -v gdate >/dev/null 2>&1; then gdate -d "$ts" +%s 2>/dev/null && return; fi
  date -u -j -f "%Y-%m-%dT%H:%M:%S%z" "\${ts/Z/+0000}" +%s 2>/dev/null && return
  python3 - "$ts" <<'PY' 2>/dev/null
import sys, datetime
s=sys.argv[1].replace('Z','+00:00')
print(int(datetime.datetime.fromisoformat(s).timestamp()))
PY
}

fmt_time_hm() {
  epoch="$1"
  if date -r 0 +%s >/dev/null 2>&1; then date -r "$epoch" +"%H:%M"; else date -d "@$epoch" +"%H:%M"; fi
}

progress_bar() {
  pct="\${1:-0}"; width="\${2:-10}"
  [[ "$pct" =~ ^[0-9]+$ ]] || pct=0; ((pct<0))&&pct=0; ((pct>100))&&pct=100
  filled=$(( pct * width / 100 )); empty=$(( width - filled ))

  # Color gradient based on usage (green -> yellow -> red as it fills up)
  # Use $'...' syntax for pre-computed escape sequences
  if [ "$use_color" -eq 1 ]; then
    if [ "$pct" -gt 70 ]; then
      bar_color=$'\\033[38;5;203m'   # red/coral - danger (>70% used)
    elif [ "$pct" -gt 40 ]; then
      bar_color=$'\\033[38;5;222m'   # yellow/gold - caution (40-70% used)
    else
      bar_color=$'\\033[38;5;114m'   # green - healthy (<40% used)
    fi
    dim_color=$'\\033[38;5;239m'     # dark gray for empty
    reset=$'\\033[0m'
  else
    bar_color=''; dim_color=''; reset=''
  fi

  # Build the entire bar as a single string to prevent fragmentation
  local bar_str=""
  for ((i=0; i<filled; i++)); do bar_str+='▓'; done
  local empty_str=""
  for ((i=0; i<empty; i++)); do empty_str+='░'; done

  # Output atomically with printf %b for escape interpretation
  printf '%b%s%b%b%s%b' "$bar_color" "$bar_str" "$reset" "$dim_color" "$empty_str" "$reset"
}`
}

export function generateUsageDisplayCode(config: UsageFeature, colors: boolean, emojis: boolean): string {
  if (!config.enabled) return ''

  let displayCode = ''

  if (config.showSession) {
    const sessionEmoji = emojis ? '⌛' : 'session:'
    displayCode += `
# session time
if [ -n "$session_txt" ]; then
  session_clr=$(get_session_reset_color)
  printf '  ${sessionEmoji} %b%s%b' "\$session_clr" "$session_txt" "\$CLR_RST"${config.showProgressBar ? `
  printf '  %b[%s]%b' "\$session_clr" "$session_bar" "\$CLR_RST"` : ''}
fi`
  }

  if (config.showCost) {
    const costEmoji = emojis ? '💵' : '$'
    displayCode += `
# cost
if [ -n "$cost_usd" ] && [[ "$cost_usd" =~ ^[0-9.]+$ ]]; then
  if [ -n "$cost_per_hour" ] && [[ "$cost_per_hour" =~ ^[0-9.]+$ ]]; then
    printf '  ${costEmoji} %b$%.2f ($%.2f/h)%b' "\$CLR_COST" "$cost_usd" "$cost_per_hour" "\$CLR_RST"
  else
    printf '  ${costEmoji} %b$%.2f%b' "\$CLR_COST" "$cost_usd" "\$CLR_RST"
  fi
fi`
  }

  if (config.showTokens) {
    const tokenEmoji = emojis ? '📊' : 'tok:'
    displayCode += `
# tokens
if [ -n "$tot_tokens" ] && [[ "$tot_tokens" =~ ^[0-9]+$ ]]; then
  if [ -n "$tpm" ] && [[ "$tpm" =~ ^[0-9.]+$ ]] && ${config.showBurnRate ? 'true' : 'false'}; then
    printf '  ${tokenEmoji} %b%s tok (%.0f tpm)%b' "\$CLR_USAGE" "$tot_tokens" "$tpm" "\$CLR_RST"
  else
    printf '  ${tokenEmoji} %b%s tok%b' "\$CLR_USAGE" "$tot_tokens" "\$CLR_RST"
  fi
fi`
  }

  return displayCode
}