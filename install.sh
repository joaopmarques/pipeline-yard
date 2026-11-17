#!/bin/bash
# Install the Pipeline Yard skills for Claude Code.
# The script copies each folder in skills/ into the skills folder of the user.
# Usage: ./install.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
DEST="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

mkdir -p "$DEST"
for skill in "$HERE"/skills/*/; do
  name="$(basename "$skill")"
  rsync -a --delete --exclude ".DS_Store" "$skill" "$DEST/$name/"
  echo "installed $name"
done
echo "Skills are in $DEST. In a repository, say \"set up the yard\" to Claude Code."
