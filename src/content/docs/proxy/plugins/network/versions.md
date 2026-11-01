---
title: "Versions"
description: "Orion proxy plugins: which proxies a plugin runs on, and what a new SDK version means for it."
sidebar:
  order: 10
---

A proxy plugin has the version of its own releases (`version` of `plugin.json`) and is built against a version of the
SDK of the proxy (`ProxyAbi.Major`, `ProxyAbi.Minor`), which says the surface of the proxy it uses. The proxy that runs
it has a version of its own (`PluginTable.Major`, `PluginTable.Minor`).

## Which proxies a plugin runs on

A plugin runs on a proxy of the same **major** version as its SDK, and the same or a later **minor** version. Within a
major version the surface of the proxy only grows (members, events and fields added at the end), so a plugin built
against an older SDK keeps running on newer proxies without being rebuilt; a plugin built against a newer SDK than the
proxy fails to load, with both versions in the log. A new major version may change or remove things: rebuild against
it.

| Plugin built with SDK | Proxy | Result                           |
|-----------------------|-------|----------------------------------|
| 0.5                   | 0.5   | Runs                             |
| 0.2                   | 0.5   | Runs                             |
| 0.5                   | 0.2   | Fails: it may use what 0.2 lacks |
| 0.5                   | 1.0   | Fails: rebuild against SDK 1.0   |

The major version is 0 while Orion is in development: until 1.0, a minor version may also rename a type of the SDK or
keep a member to the SDK itself. A plugin built before keeps running; rebuilding it shows what to change.

The SDK of the proxy and the SDK of the server have versions of their own: a server and a proxy can be updated
separately, and so can their plugins.

```csharp
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Proxy;

namespace Network;

public sealed class NetworkPlugin : ProxyPlugin
{
    public override void OnLoad() =>
        Context.Logger.LogInformation("Built with SDK {SdkMajor}.{SdkMinor}, on a proxy of {Major}.{Minor}",
            ProxyAbi.Major, ProxyAbi.Minor, PluginTable.Major, PluginTable.Minor);
}
```

## Reference

| Member                                   | What it is                                      |
|------------------------------------------|-------------------------------------------------|
| `ProxyAbi.Major`, `ProxyAbi.Minor`       | The version of the SDK the plugin is built with |
| `PluginTable.Major`, `PluginTable.Minor` | The version of the running proxy                |
| `PluginTable.PluginId`                   | The number Orion gave the plugin for this run   |

The other members of `ProxyAbi` and `PluginTable` are used by the SDK; plugin code does not use them.
