---
title: "Logging"
description: "Orion proxy plugins: writing to the log of the proxy."
sidebar:
  order: 3
---

`Context.Logger` is a standard `ILogger` of `Microsoft.Extensions.Logging`. Its lines go to the log of the proxy, in
the category `plugin.<id>`, on the console and in the log files of Orion. It can be used from any thread.

## Write a line

**Extension methods** for lines that are rare:

```csharp
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Events;

namespace Network;

public sealed partial class AuditPlugin : ProxyPlugin
{
    [EventHandler(EventPriority.Monitor)]
    public void OnTransfer(PlayerTransferEvent e)
    {
        if (e.Outcome == EventOutcome.Done)
        {
            Context.Logger.LogInformation("{Player} moved to {Target} ({Cause})", e.Player.Name, e.TargetName, e.Cause);
        }
    }
}
```

**`[LoggerMessage]` methods**, generated at build time, for lines written often: no boxing of the arguments, and nothing
is formatted when the level is off. The class is `partial`, and the project references
`Microsoft.Extensions.Logging.Abstractions` ([Getting started](../getting-started/)):

```csharp
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Events;

namespace Network;

public sealed partial class JoinLog : ProxyPlugin
{
    [EventHandler]
    public void OnJoined(PlayerJoinedEvent e) => Joined(Context.Logger, e.Player.Name, e.Server?.Id ?? "none");

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "{Player} joined on {Server}")]
    private static partial void Joined(ILogger logger, string player, string server);
}
```

## Levels

Only the levels the log configuration of Orion enables for `plugin.<id>` are written (`Information` and above by
default); `Context.Logger.IsEnabled(level)` tells which ones. `logging.json` of the proxy changes it for one plugin:

```json
{
  "categories": { "plugin.network": "debug" }
}
```

The log of the proxy also has the lines of the loader of plugins (`Plugins`: found, loaded, enabled, disabled,
failed) and the faults of each plugin, under its category.

## Reference

| Member                           | What it is                                                                        |
|----------------------------------|-----------------------------------------------------------------------------------|
| `Context.Logger`                 | The `ILogger` of the plugin, category `plugin.<id>`                               |
| `ILogger.IsEnabled(level)`       | Whether a level is written for the plugin                                         |
| `ILogger.Log…` extension methods | `LogTrace`, `LogDebug`, `LogInformation`, `LogWarning`, `LogError`, `LogCritical` |
| `[LoggerMessage]`                | Generated logging methods, in a `partial` class                                   |
| `ILogger.BeginScope`             | Accepted, without effect                                                          |
