// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { sidebar } from "./src/sidebar.mjs";

const base = "/wiki";

// https://astro.build/config
export default defineConfig({
  site: "https://orion-bedrock.github.io",
  base,
  integrations: [
    starlight({
      title: "Orion Bedrock",
      favicon: "/orion.png",
      editLink: {
        baseUrl: "https://github.com/orion-bedrock/wiki/edit/release/",
      },
      customCss: [
        "./src/styles/home.css",
        "./src/styles/sidebar.css",
        "./src/styles/content.css",
      ],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/orion-bedrock",
        },
        {
          icon: "discord",
          label: "Discord",
          href: "https://discord.gg/NE6TWXz4xU",
        },
      ],
      sidebar,
    }),
  ],
});
