const group = (label, directory, collapsed = true) => ({
  label,
  collapsed,
  items: [{ autogenerate: { directory } }],
});

export const sidebar = [
  {
    label: "SDK",
    collapsed: true,
    items: [{ autogenerate: { directory: "sdk" } }],
  },
  {
    label: "Server",
    collapsed: true,
    items: [
      "server/plugins",
      group("Basics", "server/plugins/basics"),
      group("Players", "server/plugins/players"),
      group("Worlds and blocks", "server/plugins/worlds"),
      group("Items", "server/plugins/items"),
      group("Entities", "server/plugins/entities"),
      group("What players see", "server/plugins/player-ui"),
      group("Platform", "server/plugins/platform"),
    ],
  },
  {
    label: "Proxy",
    collapsed: true,
    items: [
      "proxy/plugins",
      group("Basics", "proxy/plugins/basics"),
      group("The network", "proxy/plugins/network"),
    ],
  },
];
