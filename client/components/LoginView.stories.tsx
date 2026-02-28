import type { Meta, StoryObj } from "@storybook/react";
import { LoginView } from "./LoginView";

const meta: Meta<typeof LoginView> = {
  component: LoginView,
  title: "Login/LoginView",
  tags: ["autodocs"],
};
export default meta;

type Story = StoryObj<typeof LoginView>;

/** モックの認可URLで表示。プレビュー環境で見た目を確認する用 */
export const Default: Story = {
  args: {
    authUrl: "https://www.strava.com/oauth/authorize?client_id=12345&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fstrava%2Fcallback&response_type=code&scope=read%2Cactivity%3Aread_all&approval_prompt=auto",
  },
};
