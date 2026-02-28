import type { Meta, StoryObj } from "@storybook/react";
import { Map } from "./Map";

const meta: Meta<typeof Map> = {
  component: Map,
  title: "App/Map",
  parameters: {
    layout: "fullscreen",
  },
};
export default meta;

type Story = StoryObj<typeof Map>;

export const Default: Story = {
  render: () => (
    <div style={{ width: "100%", height: "500px" }}>
      <Map />
    </div>
  ),
};
