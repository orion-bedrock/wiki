---
title: "Logging"
description: "Orion server plugins: writing to the log of the server."
sidebar:
  order: 3
---

`Context.Logger` is a standard `ILogger` of `Microsoft.Extensions.Logging`. Its lines go to the log of the server, in
the category `plugin.<id>` (`plugin.arena` for the plugin `arena`), with the time, the level and the message, on the
console and in the log files of Orion.

## Write a line

Two styles work; both reach the same log.

**Extension methods** (`LogInformation`, `LogWarning`…) are the quickest to write, fine for lines that are rare:

```csharp
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Server;

namespace Arena;

public sealed class ArenaPlugin : ServerPlugin
{
    public override void OnEnable() => Context.Logger.LogInformation("Arena {Version} is ready", Context.Version);

    public override void OnDisable() => Context.Logger.LogInformation("Arena stopped");
}
```

**`[LoggerMessage]` methods** are generated at build time: no boxing of the arguments, no parsing of the template on
each call, and the level is checked before anything is formatted. Prefer them for lines written often (in handlers,
tasks and commands). The class must be `partial`, and the project needs the package
`Microsoft.Extensions.Logging.Abstractions` (see [Getting started](../getting-started/)), which brings its source generator:

```csharp
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;

namespace Arena;

public sealed partial class ArenaPlugin : ServerPlugin
{
    [EventHandler]
    public void OnJoin(PlayerJoinEvent e) => Joined(Context.Logger, e.Player.Name, e.World.Name);

    [LoggerMessage(EventId = 1, Level = LogLevel.Information, Message = "{Player} joined in {World}")]
    private static partial void Joined(ILogger logger, string player, string world);

    [LoggerMessage(EventId = 2, Level = LogLevel.Warning, Message = "The round of {World} could not start")]
    private static partial void RoundFailed(ILogger logger, string world, Exception exception);
}
```

An exception passed as the last parameter is written below the line, with its stack trace.

## Levels

| Level         | For                                                                   |
|---------------|-----------------------------------------------------------------------|
| `Trace`       | Step-by-step detail, while you debug                                  |
| `Debug`       | What helps to understand a problem                                    |
| `Information` | What an administrator wants to see: the plugin started, a round ended |
| `Warning`     | Something unexpected the plugin recovered from                        |
| `Error`       | Something failed                                                      |
| `Critical`    | The plugin cannot go on                                               |

Only the levels the log configuration of Orion enables for `plugin.<id>` are written, and
`Context.Logger.IsEnabled(level)` tells which ones are. The server writes `Information` and above by default;
`logging.json` of the server changes it for one plugin:

```json
{
  "categories": { "plugin.arena": "debug" }
}
```

## What Orion logs about a plugin

| Category      | Lines                                                                                                                             |
|---------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `Plugins`     | Plugins found, loaded, enabled, disabled, failed, skipped (another application, or in `plugins.disabled`)                         |
| `plugin.<id>` | Your lines; the faults of the plugin (an exception of a handler, command or task); a value of an event handler the server refused |

## Reference

| Member                           | What it is                                                                          |
|----------------------------------|-------------------------------------------------------------------------------------|
| `Context.Logger`                 | The `ILogger` of the plugin, category `plugin.<id>`; it can be used from any thread |
| `ILogger.IsEnabled(level)`       | Whether a level is written for the plugin                                           |
| `ILogger.Log…` extension methods | `LogTrace`, `LogDebug`, `LogInformation`, `LogWarning`, `LogError`, `LogCritical`   |
| `[LoggerMessage]`                | Generated logging methods, in a `partial` class                                     |
| `ILogger.BeginScope`             | Accepted, without effect: the log of Orion does not show scopes                     |
