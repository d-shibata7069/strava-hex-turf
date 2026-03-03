/// <reference types="node" />
import path from "path";

/** @type { import('@storybook/react-webpack5').StorybookConfig } */
const config = {
  stories: ["../components/**/*.stories.@(js|jsx|mjs|ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: "@storybook/react-webpack5",
  webpackFinal: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...config.resolve.alias,
      "next/link": path.resolve(__dirname, "next-link-mock.tsx"),
    };
    const babelLoader = {
      loader: require.resolve("babel-loader"),
      options: {
        presets: [
          [require.resolve("@babel/preset-env"), { targets: { node: "current" } }],
          require.resolve("@babel/preset-react"),
        ],
      },
    };
    const rules = (config.module?.rules ?? []).map((rule) => {
      if (rule && typeof rule === "object" && rule.test?.toString().includes("stories")) {
        const use = Array.isArray(rule.use) ? [babelLoader, ...rule.use] : [babelLoader, rule.loader || rule].filter(Boolean);
        return { ...rule, use };
      }
      return rule;
    });
    config.module = config.module ?? {};
    config.module.rules = rules;
    return config;
  },
};

export default config;
