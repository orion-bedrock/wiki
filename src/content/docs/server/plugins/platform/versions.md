---
title: "Versions"
description: "Orion server plugins: which servers a plugin runs on, and what a new SDK version means for it."
sidebar:
  order: 6
---

Three versions matter to a plugin, and they are independent:

| Version                   | Where                                                      | What it says                                                 |
|---------------------------|------------------------------------------------------------|--------------------------------------------------------------|
| The version of the plugin | `version` of its `plugin.json`                             | Your releases; other plugins name it in their `dependencies` |
| The version of the SDK    | `ServerAbi.Major`, `ServerAbi.Minor`                       | The surface of Orion the plugin was built against            |
| The version of the server | `PluginTable.Major`, `PluginTable.Minor`, from `OnLoad` on | The surface the running server offers                        |

## Which servers a plugin runs on

A plugin runs on a server when:

- the **major** version of the server is the major version of the SDK the plugin was built with, and
- the **minor** version of the server is the minor version of that SDK or a later one.

The surface of the server only grows within a major version: a minor version adds members, events and fields at the
end, and changes nothing that was there. So a plugin built against an older SDK keeps running on newer servers of the
same major version, without being rebuilt; a plugin built against a newer SDK than the server fails to load, and the log
of the server shows both versions. A new major version may change or remove things: rebuild the plugin against the new
SDK, and fix what the compiler reports.

| Plugin built with SDK | Server | Result                                                 |
|-----------------------|--------|--------------------------------------------------------|
| 0.15                  | 0.15   | Runs                                                   |
| 0.10                  | 0.15   | Runs: the members it uses are still there              |
| 0.15                  | 0.10   | Fails: it may use members the server does not have yet |
| 0.15                  | 1.0    | Fails: rebuild against SDK 1.0                         |

The major version is 0 while Orion is in development: until 1.0, a minor version may also rename a type of the SDK or
keep a member to the SDK itself. A plugin built before keeps running; rebuilding it shows what to change.

## Read the versions at run time

```csharp
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Server;

namespace Arena;

public sealed class ArenaPlugin : ServerPlugin
{
    public override void OnLoad() =>
        Context.Logger.LogInformation("Arena {Version}: built with SDK {SdkMajor}.{SdkMinor}, on a server of {Major}.{Minor}",
            Context.Version, ServerAbi.Major, ServerAbi.Minor, PluginTable.Major, PluginTable.Minor);
}
```

A plugin that wants to use a member added in a later minor version than the oldest server it supports checks
`PluginTable.Minor` first; the simple rule is to build against the SDK of the oldest server you support.

## Updating a plugin

Replace its files and restart the server: Orion opens a library once and never unloads it. Keep the `id` of the plugin
stable (it names its folder, its data directory and the keys of its translations) and raise its `version`.

## Reference

| Member                                   | What it is                                            |
|------------------------------------------|-------------------------------------------------------|
| `ServerAbi.Major`                        | The major version of the SDK the plugin is built with |
| `ServerAbi.Minor`                        | Its minor version                                     |
| `PluginTable.Major`, `PluginTable.Minor` | The version of the running server, from `OnLoad` on   |
| `PluginTable.PluginId`                   | The number Orion gave the plugin for this run         |

The other members of `ServerAbi`, `PluginTable` and `PluginEntry` are used by the SDK; plugin code does not use them.
