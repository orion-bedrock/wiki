---
title: "Scheduled tasks"
description: "Orion proxy plugins: tasks that run later or repeat."
sidebar:
  order: 7
---

`Context.Scheduler` runs code later or again and again. The proxy has no worlds: its tasks run on the thread of the
plugins of the proxy (`orion-proxy-plugins`), counted in ticks of 50 ms (20 a second), and read and call whatever they
need from there.

| Method                          | Runs                                                                | The action takes    |
|---------------------------------|---------------------------------------------------------------------|---------------------|
| `After(ticks, action)`          | Once, after `ticks` ticks                                           | Nothing             |
| `Every(ticks, action)`          | Every `ticks` ticks, the first time after as many                   | Its `ScheduledTask` |
| `Repeat(delay, period, action)` | After `delay` ticks (0 is the next tick), then every `period` ticks | Its `ScheduledTask` |

## Lambdas, methods and classes

**A lambda** for a short task:

```csharp
Context.Scheduler.Every(20 * 60 * 10, _ => ProxyServer.Current.Broadcast("Vote for the network: vote.example.com"));

Player newcomer = player;
Context.Scheduler.After(20, () =>
{
    if (newcomer.IsOnline)
    {
        newcomer.SendMessage("Welcome! /servers lists where to go.");
    }
});
```

**A method group** when the task grows:

```csharp
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Servers;

namespace Network;

public sealed class StatusPlugin : ProxyPlugin
{
    public override void OnEnable() => Context.Scheduler.Every(100, Publish);

    // Every five seconds, each server shows how full it is in its status.
    private static void Publish(ScheduledTask task)
    {
        foreach (Server server in ProxyServer.Current.Servers.All)
        {
            server.Status = server.MaxPlayers == 0 ? "open" : $"{server.PlayerCount * 100 / server.MaxPlayers}%";
        }
    }
}
```

**A class** that owns its task, for something with a start and an end:

```csharp
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Scheduling;

namespace Network;

public sealed class RestartCountdown(ProxyScheduler scheduler, int seconds)
{
    private ScheduledTask? _task;
    private int _left = seconds;

    public void Start() => _task = scheduler.Every(20, Tick);

    public void Cancel() => _task?.Cancel();

    private void Tick(ScheduledTask task)
    {
        if (--_left <= 0)
        {
            task.Cancel();
            ProxyServer.Current.Maintenance.Set(enabled: true, kick: true);
            return;
        }

        if (_left <= 10 || _left % 60 == 0)
        {
            ProxyServer.Current.Broadcast($"§cThe network restarts in {_left} s.");
        }
    }
}
```

`RunCount` is how many runs of the task started so far, the current one included. A task ends one way: a task of
`After` is completed (`IsCompleted`) once its run starts; any task is canceled (`IsCanceled`) by `Cancel()` or by the
disable of the plugin before that. Canceling a task that ended changes nothing.
A task whose action throws is a fault of the plugin and runs again at its next period. Every task of the plugin is
canceled when it is disabled.

## Reference

`ProxyScheduler` (`Context.Scheduler`, namespace `Orion.Sdk.Proxy.Scheduling`):

| Member                                                                      | What it does                                                  |
|-----------------------------------------------------------------------------|---------------------------------------------------------------|
| `ScheduledTask After(int ticks, Action action)`                             | Runs an action once, after a number of ticks of 50 ms         |
| `ScheduledTask Every(int ticks, Action<ScheduledTask> action)`              | Runs an action every `ticks` ticks, until it is canceled      |
| `ScheduledTask Repeat(int delay, int period, Action<ScheduledTask> action)` | Runs an action after `delay` ticks, then every `period` ticks |

`ScheduledTask` (`Orion.Sdk`): `RunCount`, `IsCompleted`, `IsCanceled`, `Cancel()`. `ScheduledTask.Schedule` and `Delay` are public for
the SDK.
