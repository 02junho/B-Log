#!/usr/bin/env bash
# B-Log 세션 로그 백업 (팀 규칙: 주 1회. 이 로그가 메타 데모의 원본 데이터다.)
#
# 사용법:
#   1) 준호에게 비공개 레포 02junho/B-Log-logs 접근 권한을 받는다.
#   2) git clone https://github.com/02junho/B-Log-logs ~/B-Log-logs
#   3) 이 레포에서:  bash scripts/backup-logs.sh
#      (백업 위치를 바꾸려면: BACKUP_DIR=/path bash scripts/backup-logs.sh)
#
# 무엇을 백업하나 — B-Log 관련 로그만:
#   - Claude Code: ~/.claude/projects/ 중 폴더 이름에 b-log/blog가 들어가는 프로젝트
#   - Codex: ~/.codex/sessions/ 중 세션 앞부분(cwd·git 정보)에 B-Log가 나오는 파일
# 다른 프로젝트의 로그는 건드리지 않는다. 백업 레포는 비공개이며 절대 공개로 바꾸지 않는다.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$HOME/B-Log-logs}"
WHO="$(git config user.name 2>/dev/null || whoami)"
DEST="$BACKUP_DIR/${WHO// /-}"

if [ ! -d "$BACKUP_DIR/.git" ]; then
  echo "오류: $BACKUP_DIR 가 git 레포가 아닙니다. 먼저 B-Log-logs를 클론하세요." >&2
  exit 1
fi

copied=0

# Claude Code: 프로젝트 폴더 단위
if [ -d "$HOME/.claude/projects" ]; then
  while IFS= read -r dir; do
    name="$(basename "$dir")"
    mkdir -p "$DEST/claude/$name"
    rsync -a "$dir/" "$DEST/claude/$name/"
    copied=$((copied + 1))
  done < <(find "$HOME/.claude/projects" -maxdepth 1 -type d | grep -iE 'b-?log' || true)
fi

# Codex: 세션 파일 앞 8KB에 B-Log가 언급된 것만 (cwd 또는 git url)
if [ -d "$HOME/.codex/sessions" ]; then
  while IFS= read -r f; do
    if head -c 8192 "$f" | grep -qiE 'b-?log'; then
      rel="${f#"$HOME/.codex/sessions/"}"
      mkdir -p "$DEST/codex/$(dirname "$rel")"
      cp -p "$f" "$DEST/codex/$rel"
      copied=$((copied + 1))
    fi
  done < <(find "$HOME/.codex/sessions" -name '*.jsonl' -type f)
fi

cd "$BACKUP_DIR"
git add -A
if git diff --cached --quiet; then
  echo "변경 없음 (마지막 백업 이후 새 로그 없음). 검사한 항목: $copied"
  exit 0
fi
git commit -q -m "backup($WHO): $(date +%F)"
git push -q
echo "백업 완료: $copied개 항목 → $DEST (커밋·푸시됨)"
