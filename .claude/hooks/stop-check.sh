#!/bin/bash
# Stop フック：Claude が応答を終える前に
#   1. サイトのソースが変わっていれば `npm run build` を通す（失敗したら Claude に直させる）
#   2. 3MB を超える画像が追加・変更されていれば、ユーザーに知らせる
# ソースが前回の確認から変わっていなければ何もしない。

input=$(cat)
cd "$CLAUDE_PROJECT_DIR" || exit 0

# 失敗を直している最中（このフックで止められた直後）かどうか。無限ループを避けるため、2回目は止めない
retrying=false
echo "$input" | grep -q '"stop_hook_active": *true' && retrying=true

messages=()

# ---- 1. ビルド --------------------------------------------------------------
paths=(src public astro.config.mjs package.json tsconfig.json)
sig=$( { git diff HEAD -- "${paths[@]}"; git ls-files --others --exclude-standard -- "${paths[@]}" | xargs cat 2>/dev/null; } | shasum | cut -c1-40)
stamp="${TMPDIR:-/tmp}/claude-build-$(echo "$PWD" | shasum | cut -c1-12)"

if [ -n "$(git status --porcelain -- "${paths[@]}")" ] && [ "$sig" != "$(cat "$stamp" 2>/dev/null)" ]; then
  if log=$(npm run build 2>&1); then
    echo "$sig" > "$stamp"
  else
    if [ "$retrying" = false ]; then
      echo "npm run build が失敗しました。原因を直してから終えてください。" >&2
      echo "$log" | grep -iE "error|failed|\[ERROR\]" | head -20 >&2
      echo "--- 末尾 ---" >&2
      echo "$log" | tail -15 >&2
      exit 2
    fi
    messages+=("ビルドが失敗したままです（npm run build を確認してください）")
  fi
fi

# ---- 2. 大きな画像 -----------------------------------------------------------
big=$(git status --porcelain -uall -- assets public | cut -c4- | while IFS= read -r f; do
  f=${f#\"}; f=${f%\"}
  [ -f "$f" ] || continue
  size=$(wc -c < "$f")
  [ "$size" -gt 3145728 ] && echo "$f ($(awk "BEGIN{printf \"%.1f\", $size/1048576}")MB)"
done)
if [ -n "$big" ]; then
  messages+=("3MB を超える画像があります。sips -Z 2400 で縮めることを検討してください: $(echo "$big" | paste -sd ',' - | sed 's/,/, /g')")
fi

if [ ${#messages[@]} -gt 0 ]; then
  msg=$(printf '%s / ' "${messages[@]}"); msg=${msg% / }
  msg=${msg//\\/\\\\}; msg=${msg//\"/\\\"}
  printf '{"systemMessage": "%s"}\n' "$msg"
fi
exit 0
