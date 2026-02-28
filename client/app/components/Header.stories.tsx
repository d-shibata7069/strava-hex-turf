import type { Meta, StoryObj } from "@storybook/react";
import { HeaderView } from "./Header";

const meta: Meta<typeof HeaderView> = {
  component: HeaderView,
  title: "App/Header",
};
export default meta;

type Story = StoryObj<typeof HeaderView>;

export const LoggedOut: Story = {
  args: {
    user: null,
  },
};

export const LoggedInWithIcon: Story = {
  args: {
    user: {
      displayName: "山田 太郎",
      iconUrl: "https://d3nn82uaxijpm6.cloudfront.net/assets/avatar/athlete/large.png",
    },
  },
};

export const LoggedInWithoutIcon: Story = {
  args: {
    user: {
      displayName: "匿名ランナー",
      iconUrl: null,
    },
  },
};
