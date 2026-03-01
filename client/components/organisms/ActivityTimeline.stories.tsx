import type { Meta, StoryObj } from "@storybook/react";
import { ActivityTimeline } from "./ActivityTimeline";
import type { ActivityLogEntry } from "@/app/api/groups/[groupId]/logs/route";

const meta: Meta<typeof ActivityTimeline> = {
  component: ActivityTimeline,
  title: "Organisms/ActivityTimeline",
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div style={{ height: "400px", position: "relative" }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof ActivityTimeline>;

/** グループ未選択時（グループに参加すると…のメッセージ表示） */
export const NoGroup: Story = {
  args: {
    groupId: null,
  },
};

/** ダミーログを注入してタイムラインの見た目を確認 */
function getMockLogs(): ActivityLogEntry[] {
  const base = new Date();
  return [
    {
      id: "log-1",
      group_id: "g1",
      user_id: "u1",
      action: "capture",
      h3_index: null,
      message: "山田太郎 が 5個の陣地を奪取・防衛しました！",
      created_at: new Date(base.getTime() - 2 * 60 * 1000).toISOString(),
      user: { display_name: "山田太郎", icon_url: null },
    },
    {
      id: "log-2",
      group_id: "g1",
      user_id: "u2",
      action: "capture",
      h3_index: null,
      message: "佐藤花子 が 3個の陣地を奪取・防衛しました！",
      created_at: new Date(base.getTime() - 60 * 60 * 1000).toISOString(),
      user: { display_name: "佐藤花子", icon_url: null },
    },
    {
      id: "log-3",
      group_id: "g1",
      user_id: "u3",
      action: "capture",
      h3_index: null,
      message: "ランナー が 12個の陣地を奪取・防衛しました！",
      created_at: new Date(base.getTime() - 24 * 60 * 60 * 1000).toISOString(),
      user: { display_name: null, icon_url: null },
    },
  ];
}

export const WithMockLogs: Story = {
  args: {
    groupId: "00000000-0000-0000-0000-000000000001",
    initialLogs: getMockLogs(),
  },
};

/** グループ指定あり（API から取得するため、プレビュー時は空になる） */
export const WithGroup: Story = {
  args: {
    groupId: "00000000-0000-0000-0000-000000000001",
  },
};
