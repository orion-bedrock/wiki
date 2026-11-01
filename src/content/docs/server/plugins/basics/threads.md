---
title: "Threads and async code"
description: "Orion server plugins: the thread of each world, moving work between worlds, `async` and `await`."
sidebar:
  order: 4
---

Each world of an Orion server ticks on its own thread, 20 times a second, and what belongs to a world (its blocks,
entities, players) is used on that thread. Most of the time you do not have to think about it: Orion calls your code on
the right thread. This page tells you where your code runs, how to act on another world, and how to wait without
blocking a world.

## Where your code runs

| Code                                                              | Thread                                                            |
|-------------------------------------------------------------------|-------------------------------------------------------------------|
| `OnLoad`, `OnEnable`, `OnDisable`                                 | The thread that starts or stops the server                        |
| Event handlers                                                    | The thread of the world the event happens in                      |
| `PlayerLoginEvent`, `PlayerSkinEvent`, `PlayerSpawnLocationEvent` | The network thread of the player: it is not in a world yet        |
| `ServerStartedEvent`, `ServerStoppingEvent`                       | The thread that starts or stops the server                        |
| Commands, forms, menus, cinematic steps, floating text functions  | The thread of the world of the player                             |
| Tasks of `Context.Scheduler`                                      | The thread of their world (the default world unless you give one) |
| Goals of mobs, callbacks of custom content                        | The thread of the world of the entity                             |
| Chat filters                                                      | The thread the message is sent from                               |
| Message handlers ([Messages with the proxy](../../platform/messaging/))                   | The thread of the world of the player                             |

A member of a world used from another thread fails with a `PluginException` that says so: the server checks the
thread, so a mistake shows at once rather than as a rare corruption.

## Act on another world

A handler of one world that changes another hops to the thread of that world. `World` offers three ways:

| Member                          | What it does                                                                                                  | Use it when                             |
|---------------------------------|---------------------------------------------------------------------------------------------------------------|-----------------------------------------|
| `world.Post(action)`            | Runs an action on the thread of the world, at its next opportunity (at the latest the start of its next tick) | You do not need a result                |
| `await world.InvokeAsync(func)` | Runs a function there and gives you its result                                                                | You need a value computed on that world |
| `await world.SwitchTo()`        | The rest of the method runs on the thread of the world                                                        | Several steps in a row on that world    |

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Entities;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Game;
using Orion.Sdk.Server.Players;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public sealed partial class LobbyPlugin : ServerPlugin
{
    // A player in the lobby writes "ready": the arena, another world, gets a zombie.
    [EventHandler]
    public void OnChat(PlayerChatEvent e)
    {
        if (e.Message != "ready" || GameServer.Current.FindWorld("arena") is not { } arena)
        {
            return;
        }

        arena.Post(() => arena.Entities.Spawn(EntityIds.Zombie, arena.Spawn, EntitySpawnMode.None, 0, 0));
        _ = AnnounceAsync(arena, e.Player.Name);
    }

    private static async Task AnnounceAsync(World arena, string name)
    {
        int count = await arena.InvokeAsync(() => arena.Players.Count);   // read on the thread of the arena
        await arena.SwitchTo();                                          // from here on, on the thread of the arena
        foreach (Player player in arena.Players)
        {
            player.SendMessage($"{name} is ready; {count} players are waiting.");
        }
    }
}
```

A post, an invoke or a switch still pending when the world unloads, or when the plugin is disabled, ends with
`OperationCanceledException`.

## Wait without blocking

Never block a world thread (`Thread.Sleep`, `.Result`, `.Wait()`, long loops): the world stops ticking for everyone in
it. To wait, `await world.Delay(ticks)`: the world goes on ticking, and your method continues on its thread `ticks`
later (20 ticks are a second).

```csharp
using Orion.Sdk.Server.Players;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public static class Countdown
{
    public static async Task RunAsync(World world)
    {
        for (int seconds = 5; seconds > 0; seconds--)
        {
            foreach (Player player in world.Players)
            {
                player.Hud.ShowTitle(seconds.ToString(), null, 0, 20, 0);
            }

            await world.Delay(20);   // a second later, on the thread of the world again
        }

        foreach (Player player in world.Players)
        {
            player.Hud.ShowTitle("Fight!", null, 0, 40, 10);
        }
    }
}
```

## await and where it resumes

Plugin code runs without a synchronization context: an `await` goes on on the thread where the awaited task
completes. That is the thread of a world for what the SDK does on a world, and the thread pool for everything else.

| You await                                                               | You continue on                                                          |
|-------------------------------------------------------------------------|--------------------------------------------------------------------------|
| `world.Delay`, `world.SwitchTo`, `world.InvokeAsync`                    | The thread of that world                                                 |
| `player.Forms.ShowAsync`, `player.Camera.PlayAsync`                     | The thread of the world of the player                                    |
| `player.TeleportAsync`                                                  | The thread of the world the player arrives in                            |
| `world.Blocks.CopyAsync`, `FillAsync`, `PasteAsync`, `batch.ApplyAsync` | The thread of that world                                                 |
| `WorldManager.LoadAsync`, `BuildAsync`, `UnloadAsync`, `DeleteAsync`    | The thread the operation completes on: switch to a world before using it |
| `Task.Delay`, `Task.Run`, `File.ReadAllTextAsync`, `HttpClient`         | The thread pool: switch to a world before using it                       |

`ConfigureAwait(false)` changes nothing here. After work of your own off the world, go back with `SwitchTo`:

```csharp
using System.Net.Http;
using Orion.Sdk.Server.Players;

namespace Arena;

public static class Ranks
{
    private static readonly HttpClient Http = new();

    public static async Task ShowRankAsync(Player player)
    {
        string rank = await Http.GetStringAsync("https://ranks.example.com/" + player.Uuid);   // the thread pool
        if (player.World is not { } world)
        {
            return;
        }

        await world.SwitchTo();                                   // back on the world of the player
        if (player.IsOnline)
        {
            player.SendMessage($"Your rank: {rank}");
        }
    }
}
```

## Fire and forget, safely

A handler returns `void`, so an asynchronous job it starts runs on its own (`_ = RunAsync(...)`). Exceptions of such a
task are not seen by anyone unless you catch them: wrap the body, log what fails, and report it as a fault so it
counts like any other failure of the plugin ([Errors and limits](../../platform/errors-and-limits/)):

```csharp
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public sealed partial class ArenaPlugin : ServerPlugin
{
    [EventHandler]
    public void OnJoin(PlayerJoinEvent e) => _ = WelcomeAsync(e.World, e.Player.Name);

    private async Task WelcomeAsync(World world, string name)
    {
        try
        {
            await world.Delay(40);
            world.Players.FirstOrDefault(p => p.Name == name)?.SendMessage("Two seconds in: good luck!");
        }
        catch (OperationCanceledException)
        {
            // The world unloaded, or the plugin was disabled, while waiting.
        }
        catch (Exception exception)
        {
            Context.Logger.LogError(exception, "The welcome of {Player} failed", name);
            PluginFaults.Report(exception.Message);
        }
    }
}
```

Command handlers do this for you: an asynchronous handler that throws after it waited is logged, reported and the
player told the command failed ([Commands](../commands/)).

## Rules to remember

- Keep the objects of the SDK you need (a `Player`, a `World`), never an event object: events are reused.
- Before using a player you kept, check `player.IsOnline`; a player that left throws `PluginObjectGoneException`.
- What waits when the plugin is disabled or the world unloads ends with `OperationCanceledException`, so `finally`
  blocks run; catch it where a stop is normal.
- Code of your own that several threads share (a dictionary of scores used by two worlds) needs your own locks or
  concurrent collections.

## Reference

| Member of `World`                          | What it does                                                                                 |
|--------------------------------------------|----------------------------------------------------------------------------------------------|
| `void Post(Action action)`                 | Runs an action on the thread of the world, from any thread                                   |
| `Task<T> InvokeAsync<T>(Func<T> function)` | Runs a function on the thread of the world and gives its result                              |
| `WorldSwitch SwitchTo()`                   | `await world.SwitchTo()`: the rest of the method runs on the thread of the world             |
| `Task Delay(int ticks)`                    | Waits ticks of the world without blocking it, and goes on on its thread (0 is the next tick) |

| Other member                               | What it does                                                                                                                   |
|--------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------|
| `PluginFaults.Report(string message)`      | Reports a failure Orion did not see (the rest of a job of the plugin): logged and counted as a fault                           |
| `WorldSwitch` (`PluginWorlds.WorldSwitch`) | The awaitable of `SwitchTo`: `GetAwaiter`, `IsCompleted`, `GetResult`, `OnCompleted`, `UnsafeOnCompleted`; you only `await` it |
