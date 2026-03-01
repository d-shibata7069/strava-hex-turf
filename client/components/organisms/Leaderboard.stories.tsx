import type { Meta, StoryObj } from "@storybook/react";
import { Leaderboard } from "./Leaderboard";
import type { LeaderboardEntry } from "@/app/api/groups/[id]/leaderboard/route";

const meta: Meta<typeof Leaderboard> = {
  component: Leaderboard,
  title: "Organisms/Leaderboard",
  parameters: {
    layout: "centered",
  },
  decorators: [
    (Story) => (
      <div style={{ width: "320px", border: "1px solid #e5e7eb", borderRadius: "4px", overflow: "hidden" }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Leaderboard>;

/** グループ未選択時（グループに参加すると…のメッセージ表示） */
export const NoGroup: Story = {
  args: {
    groupId: null,
  },
};

/** ダミーデータを注入してランキングの見た目を確認（1〜3位の王冠装飾付き） */
function getMockEntries(): LeaderboardEntry[] {
  return [
    { user_id: "u1", display_name: "山田太郎", icon_url: null, tile_count: "42" },
    { user_id: "u2", display_name: "佐藤花子", icon_url: null, tile_count: "28" },
    { user_id: "u3", display_name: "ランナー", icon_url: null, tile_count: "15" },
    { user_id: "u4", display_name: "四郎", icon_url: null, tile_count: "7" },
    { user_id: "u5", display_name: "五郎", icon_url: null, tile_count: "3" },
  ];
}

export const WithMockEntries: Story = {
  args: {
    groupId: "00000000-0000-0000-0000-000000000001",
    initialEntries: getMockEntries(),
  },
};

/** グループ指定あり（API から取得するため、プレビュー時は空 or 読み込み表示） */
export const WithGroup: Story = {
  args: {
    groupId: "00000000-0000-0000-0000-000000000001",
  },
};
