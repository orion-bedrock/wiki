---
title: "The life of a plugin"
description: "Orion server plugins: `OnLoad`, `OnEnable`, `OnDisable`, the context of the plugin, dependencies and failures."
sidebar:
  order: 2
---

Orion creates one instance of your plugin class when it opens the library, and calls three methods of it: `OnLoad`
while the server is being built, `OnEnable` once it is ready, and `OnDisable` when it stops. Override the ones you need.

## The three steps

| Step        | When                                                                                  | Do here                                                                                |
|-------------|---------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| `OnLoad`    | Once, while the server builds its game, in the order of the dependencies              | Read your configuration, describe custom content (`Context.Content`)                   |
| `OnEnable`  | Once the worlds are loaded, before the server lets players in                         | Register commands, tasks, listeners and message handlers; spawn what the plugin shows  |
| `OnDisable` | When the server stops (its players already left), or when the plugin failed too often | Save what the plugin keeps; everything it registered is removed right after it returns |

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Game;

[assembly: OrionPlugin(typeof(Arena.ArenaPlugin))]

namespace Arena;

public sealed class ArenaSettings
{
    public string World { get; set; } = "arena";

    public int RoundSeconds { get; set; } = 300;
}

[JsonSerializable(typeof(ArenaSettings))]
[JsonSourceGenerationOptions(WriteIndented = true, PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
internal sealed partial class ArenaJson : JsonSerializerContext;

public sealed class ArenaPlugin : ServerPlugin
{
    private ArenaSettings _settings = new();

    private string SettingsPath => Path.Combine(Context.DataDirectory, "settings.json");

    public override void OnLoad()
    {
        if (File.Exists(SettingsPath))
        {
            _settings = JsonSerializer.Deserialize(File.ReadAllText(SettingsPath), ArenaJson.Default.ArenaSettings) ?? new();
        }
    }

    public override void OnEnable()
    {
        if (GameServer.Current.FindWorld(_settings.World) is null)
        {
            Context.Logger.LogWarning("The world {World} of the arena is not loaded", _settings.World);
        }

        Context.Commands.Register("arena", spec => spec
            .Executes(call => call.Reply($"Rounds last {_settings.RoundSeconds} seconds.")));
    }

    public override void OnDisable() =>
        File.WriteAllText(SettingsPath, JsonSerializer.Serialize(_settings, ArenaJson.Default.ArenaSettings));
}
```

JSON goes through a source-generated `JsonSerializerContext`: a plugin is compiled with Native AOT, which has no
reflection-based serialization ([Errors and limits](../../platform/errors-and-limits/)).

## What is available at each step

| Member                                                            | `OnLoad`                                                 | `OnEnable`                  | `OnDisable`                 |
|-------------------------------------------------------------------|----------------------------------------------------------|-----------------------------|-----------------------------|
| `Context.Id`, `Version`, `DataDirectory`, `Logger`                | Yes                                                      | Yes                         | Yes                         |
| `Context.Content`                                                 | Yes: the only time content can be added                  | `InvalidOperationException` | `InvalidOperationException` |
| `GameServer.Current` and everything reached from it               | `InvalidOperationException`: the game does not exist yet | Yes                         | Yes, until it returns       |
| `Context.Commands`, `Scheduler`, `Events.Register`, `Messages.On` | Not yet: register from `OnEnable` on                     | Yes                         | Removed when it returns     |
| `Context.Translations`                                            | Not yet                                                  | Yes                         | Yes                         |

The handlers of the plugin class itself are registered just before `OnEnable`, so they already hear events raised while
`OnEnable` runs. Other listeners are registered by your code ([Events](../events/)).

## The context

`Context` (of type `PluginContext`) is what Orion tells the plugin about itself:

| Member                  | What it is                                                                                       |
|-------------------------|--------------------------------------------------------------------------------------------------|
| `Context.Id`            | The `id` of `plugin.json`                                                                        |
| `Context.Version`       | The `version` of `plugin.json`                                                                   |
| `Context.DataDirectory` | The full path of `plugins/<id>/data`, which Orion creates: the place for the files of the plugin |
| `Context.Logger`        | The logger of the plugin ([Logging](../logging/))                                              |
| `Context.Events`        | Registers listeners ([Events](../events/))                                                     |
| `Context.Messages`      | Messages with the proxy ([Messages with the proxy](../../platform/messaging/))                                           |
| `Context.Commands`      | Registers commands ([Commands](../commands/))                                                  |
| `Context.Scheduler`     | Schedules tasks ([Scheduled tasks](../scheduler/))                                                   |
| `Context.Translations`  | The texts of the `lang` folder ([Text and translations](../text-and-translations/))            |
| `Context.Content`       | Custom content, in `OnLoad` only ([Custom content](../../platform/custom-content/))                        |

`Commands`, `Scheduler`, `Translations` and `Content` come with `using Orion.Sdk.Server;`.

## Starting and stopping events

Two events frame the time the server takes players, if a plugin needs to react to it rather than to its own steps:

| Event                 | When                                                                                                                    |
|-----------------------|-------------------------------------------------------------------------------------------------------------------------|
| `ServerStartedEvent`  | The server listens: every plugin is enabled and players can join from now on (`Server`, `Port`)                         |
| `ServerStoppingEvent` | The server begins to stop: players are still in the game, and plugins are disabled after them (`Server`, `PlayerCount`) |

Both run on the thread that starts or stops the server, not on a world: use `world.Post` to act on a world from them
([Threads and async code](../threads/)).

```csharp
[EventHandler]
public void OnStopping(ServerStoppingEvent e)
{
    foreach (Player player in GameServer.Current.Players)
    {
        player.World?.Post(() => player.SendMessage("The server is restarting, see you in a minute!"));
    }
}
```

## Dependencies

`dependencies` of `plugin.json` names plugins that must be loaded before this one, at a minimum version;
`soft_dependencies` only orders the plugins when both are installed.

```json
{
  "id": "arena_shop",
  "version": "1.2.0",
  "application": "server",
  "dependencies": { "arena": "1.0.0" },
  "soft_dependencies": { "economy": "2.0.0" }
}
```

Plugins are loaded and enabled dependencies first (the others by id), and disabled in the reverse order, so a plugin
can rely on what its dependencies did in their `OnEnable`. Each plugin is its own native library: a dependency orders
plugins, it does not let one call the C# code of another. Plugins share what they do through the server (a
permission, the data of an entity, a world property) and through events.

## Failures

| What happens                                                                                                | Result                                                                                                |
|-------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `plugin.json` cannot be read, its id is not the name of its folder, or there is no library for the platform | The plugin fails, with the path in the log                                                            |
| A hard dependency is missing, failed, disabled or too old, or dependencies form a cycle                     | The plugin fails                                                                                      |
| The plugin was built for another major version of the SDK, or a newer minor one                             | The plugin fails, with both versions in the log ([Versions](../../platform/versions/))                          |
| `OnLoad` or `OnEnable` throws                                                                               | The plugin fails, with the exception in its log, and so do the plugins that need it                   |
| A handler, command, task or callback throws                                                                 | A fault: logged, and counted                                                                          |
| More faults in a minute than `max_failures_per_minute` (20 by default)                                      | The plugin is disabled: `OnDisable` runs while the server goes on, first for the plugins that need it |
| `OnDisable` throws                                                                                          | Logged ("did not disable cleanly"); what the plugin registered is removed anyway                      |

A failed plugin does not run at all, and the server goes on without it. A plugin disabled for its faults stays
disabled until the server restarts; players may still be online when its `OnDisable` runs. See
[Errors and limits](../../platform/errors-and-limits/) for faults and exceptions in detail.

## Reference

| Member of `ServerPlugin` (from `Plugin`) | What it is                                                                               |
|------------------------------------------|------------------------------------------------------------------------------------------|
| `Context`                                | The `PluginContext` of the plugin                                                        |
| `virtual void OnLoad()`                  | Called once, while the server builds its game; its objects do not exist yet              |
| `virtual void OnEnable()`                | Called once the worlds are loaded, before players are let in                             |
| `virtual void OnDisable()`               | Called when the server stops, once its players left, or when the plugin failed too often |

| Attribute                            | What it is                                                                                 |
|--------------------------------------|--------------------------------------------------------------------------------------------|
| `[assembly: OrionPlugin(typeof(T))]` | Names the plugin class of the library (`OrionPluginAttribute.PluginType`); one per library |

`Context.Commands`, `Context.Scheduler`, `Context.Translations` and `Context.Content` are extension properties of
`PluginContext` declared by `ServerPluginContext` (namespace `Orion.Sdk.Server`).
