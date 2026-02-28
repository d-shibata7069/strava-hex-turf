#!/bin/bash
# Cursorが生成した一時的なworktreeを物理削除し、Gitの管理情報をクリーンアップするスクリプト

WORKTREE_DIR="$HOME/.cursor/worktrees/strava-hex-turf"

echo "Cursorの隠しワークツリーを削除しています: $WORKTREE_DIR"

# 1. 物理ディレクトリの削除
rm -rf "$WORKTREE_DIR"/*

# 2. Gitの内部管理からの削除（ロック解放）
git worktree prune

echo "クリーンアップが完了しました。メインディレクトリで安全にチェックアウト可能です。"