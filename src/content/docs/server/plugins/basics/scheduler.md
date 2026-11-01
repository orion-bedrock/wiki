---
title: "Scheduled tasks"
description: "Orion server plugins: tasks that run later or repeat."
sidebar:
  order: 7
---

`Context.Scheduler` runs code later or again and again: a reminder in a minute, a scoreboard refreshed every second, a
round that ends after five minutes. Tasks count in ticks of a world (20 ticks are a second) and run on the thread of
that world, so they use its blocks, entities and players directly.

## Run once, or repeat

| Method                                  | Runs                                                                | The action takes    |
|-----------------------------------------|---------------------------------------------------------------------|---------------------|
| `After(ticks, action, world?)`          | Once, `ticks` after the next tick                                   | Nothing             |
| `Every(ticks, action, world?)`          | Every `ticks` ticks, the first time after as many                   | Its `ScheduledTask` |
| `Repeat(delay, period, action, world?)` | After `delay` ticks (0 is the next tick), then every `period` ticks | Its `ScheduledTask` |

Without a world, a task runs on the default world. Register tasks from `OnEnable` on.

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Game;

namespace Arena;

public sealed class AnnouncerPlugin : ServerPlugin
{
    public override void OnEnable()
    {
        Context.Scheduler.After(200, () => GameServer.Current.Broadcast("The arena opens in a minute!"));

        Context.Scheduler.Every(1200, task =>
        {
            GameServer.Current.Broadcast($"Tip #{task.RunCount}: /arena join to play.");
            if (task.RunCount == 10)
            {
                task.Cancel();                    // ten tips are enough
            }
        });
    }
}
```

`RunCount` is how many runs of the task started so far, the current one included (1 on the first run). Every method
returns the `ScheduledTask`, which you keep to cancel it later. A task ends one way: a task of `After` is completed
(`IsCompleted`) once its run starts; any task is canceled (`IsCanceled`) by `Cancel()`, by the unload of its world or by
the disable of the plugin before that. Canceling a task that ended changes nothing.

## A task on a given world

Pass the world as the last argument: the task runs on its thread and stops when the world unloads.

```csharp
if (GameServer.Current.FindWorld("arena") is { } arena)
{
    Context.Scheduler.Every(20, _ =>
    {
        foreach (Player player in arena.Players)
        {
            player.Hud.ShowActionBar($"Players in the arena: {arena.Players.Count}");
        }
    }, arena);
}
```

## Lambdas, methods and classes

**A lambda** suits a short task that only uses what is around it, as above.

**A method group** keeps the plugin readable when the task grows:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Game;
using Orion.Sdk.Server.Players;

namespace Arena;

public sealed class HungerPlugin : ServerPlugin
{
    public override void OnEnable() => Context.Scheduler.Every(100, Feed);

    private static void Feed(ScheduledTask task)
    {
        foreach (Player player in GameServer.Current.DefaultWorld!.Players)
        {
            player.Attributes.Food = 20;
        }
    }
}
```

**A class** that holds the task and its state is the clean way to write something with a beginning and an end, such
as a round:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server.Players;
using Orion.Sdk.Server.Scheduling;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public sealed class Round(ServerScheduler scheduler, World world, int seconds)
{
    private ScheduledTask? _timer;
    private int _left = seconds;

    public bool IsRunning => _timer is { IsCanceled: false };

    public void Start() => _timer = scheduler.Every(20, Tick, world);

    public void Stop()
    {
        _timer?.Cancel();
        foreach (Player player in world.Players)
        {
            player.Hud.ShowTitle("Round over", null, 10, 60, 10);
        }
    }

    private void Tick(ScheduledTask task)
    {
        _left--;
        foreach (Player player in world.Players)
        {
            player.Hud.ShowActionBar($"{_left} s left");
        }

        if (_left <= 0)
        {
            Stop();
        }
    }
}
```

```csharp
var round = new Round(Context.Scheduler, world, 300);
round.Start();
```

## A task or a wait

In code that already runs on a world (a handler, a command), `await world.Delay(ticks)` waits without a task and goes on
on the thread of the world ([Threads and async code](../threads/)). Prefer it for a sequence of steps; prefer a task for something
that repeats or that you cancel from elsewhere.

| You want                                     | Use                                                    |
|----------------------------------------------|--------------------------------------------------------|
| Run something every so often                 | `Every` or `Repeat`                                    |
| Run something once, later, from anywhere     | `After`                                                |
| Wait in the middle of a handler or a command | `await world.Delay(ticks)`                             |
| A countdown, then an action                  | Either: a loop with `Delay`, or a task with `RunCount` |

## Rules

| Rule                                             | What                                                                                          |
|--------------------------------------------------|-----------------------------------------------------------------------------------------------|
| Ticks                                            | 20 per second when the world keeps up; a negative number throws `ArgumentOutOfRangeException` |
| Thread                                           | The thread of the world of the task                                                           |
| An action throws                                 | A fault of the plugin, in its log; a repeating task goes on                                   |
| The world unloads                                | Its tasks stop and do not run again                                                           |
| The plugin is disabled                           | Every task of the plugin is canceled                                                          |
| `Cancel()` from the task itself or from anywhere | The task does not run again; canceling twice does nothing                                     |

## Reference

`ServerScheduler` (`Context.Scheduler`, namespace `Orion.Sdk.Server.Scheduling`):

| Member                                                                                           | What it does                                                  |
|--------------------------------------------------------------------------------------------------|---------------------------------------------------------------|
| `ScheduledTask After(int ticks, Action action, World? world = null)`                             | Runs an action once, after a number of ticks                  |
| `ScheduledTask Every(int ticks, Action<ScheduledTask> action, World? world = null)`              | Runs an action every `ticks` ticks, until it is canceled      |
| `ScheduledTask Repeat(int delay, int period, Action<ScheduledTask> action, World? world = null)` | Runs an action after `delay` ticks, then every `period` ticks |

`ScheduledTask` (`Orion.Sdk`):

| Member        | What it is                                                                                      |
|---------------|-------------------------------------------------------------------------------------------------|
| `RunCount`    | How many runs started so far, the current one included                                          |
| `IsCompleted` | Whether a task of `After` ran; a repeating task never completes                                 |
| `IsCanceled`  | Whether the task was canceled before it ended: `Cancel()`, the unload of its world, the disable |
| `Cancel()`    | Cancels the task: it does not run again; nothing when it ended already                          |

`ScheduledTask.Schedule` and `ScheduledTask.Delay` are public for the SDK; plugin code uses `Context.Scheduler` and
`world.Delay`.
