---
title: Samples
description: "The complete Orion plugins under samples: Hello, Gems, HubCompass and Hub, and how to publish one."
sidebar:
  order: 5
---

The repository ships complete plugins under `samples/`. Each one is a working starting point rather than a fragment: it has a project, a `plugin.json`, texts and the code the page describes.

| Sample | Application | Shows |
|---|---|---|
| `Hello` | Server | The life of a plugin, events, a command that waits, a repeating task |
| `Gems` | Server | Custom content: an item, blocks, recipes, an effect, an enchantment and a mob, in two languages |
| `HubCompass` | Server | Messages to the proxy and back |
| `Hub` | Proxy | A server selector form, a balancer, a delayed welcome and messages from the servers |

## What to read with each sample

- `Hello` follows [Getting started](../../server/plugins/basics/getting-started/), [The life of a plugin](../../server/plugins/basics/lifecycle/), [Events](../../server/plugins/basics/events/) and [Scheduled tasks](../../server/plugins/basics/scheduler/).
- `Gems` follows [Custom content](../../server/plugins/platform/custom-content/), [Items and inventories](../../server/plugins/items/items-and-inventories/) and [Text and translations](../../server/plugins/basics/text-and-translations/).
- `HubCompass` and `Hub` follow [Messaging](../../server/plugins/platform/messaging/) and [Messaging](../../proxy/plugins/network/messaging/).

## Publish and install a sample

On Windows, `samples/publish-plugin.ps1` publishes the plugin and copies it into the host:

```shell
powershell -NoProfile -ExecutionPolicy Bypass -File samples/publish-plugin.ps1 -Server C:\Orion -Plugin Hello
powershell -NoProfile -ExecutionPolicy Bypass -File samples/publish-plugin.ps1 -Proxy C:\OrionProxy -Plugin Hub
```

For a plugin of your own, follow [Getting started](../../server/plugins/basics/getting-started/) or [Getting started](../../proxy/plugins/basics/getting-started/). The publish folder holds the native library, `plugin.json` and `lang/`; the library goes under `plugins/<id>/native/<rid>/`.
