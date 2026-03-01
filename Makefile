# この Makefile があるディレクトリをルートとする（どこから make しても同じ挙動にする）
REPO_ROOT := $(dir $(abspath $(lastword $(MAKEFILE_LIST))))

.PHONY: clean-worktrees db-push db-link

# Cursorの隠しワークツリーを一括削除するコマンド
clean-worktrees:
	@./scripts/clean-cursor-worktrees.sh

# Supabase マイグレーションをリモートに適用する（紐付け済みが前提）
db-push:
	cd $(REPO_ROOT) && supabase db push --linked --yes

# リモートプロジェクトと紐付ける（初回のみ。PROJECT_REF は必須）
# 例: make db-link PROJECT_REF=abcdefghijklmnop
db-link:
	@if [ -z "$(PROJECT_REF)" ]; then echo "PROJECT_REF を指定してください。例: make db-link PROJECT_REF=xxxx"; exit 1; fi
	cd $(REPO_ROOT) && supabase login && supabase link --project-ref $(PROJECT_REF)