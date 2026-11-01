---
title: "Threads"
description: "Orion proxy plugins: where your code runs, and why proxy plugins must be thread-safe."
sidebar:
  order: 4
---

The proxy has no worlds and no ticks of a world: it serves each player on a thread of its own event loops, and runs the
code of plugins on several threads at once. Every member of the SDK of the proxy can be called from any of them. What
you must care about is your own state: two threads may run your code at the same time.

## Where your code runs

| Code                                    | Thread                                                                                             |
|-----------------------------------------|----------------------------------------------------------------------------------------------------|
| `OnLoad`, `OnEnable`, `OnDisable`       | The thread that starts or stops the proxy                                                          |
| Commands, forms, messages               | The thread of the player                                                                           |
| Events                                  | The thread that raised them: the one of the player for its events, the one of the change otherwise |
| Tasks of `Context.Scheduler`            | The thread of the plugins of the proxy (`orion-proxy-plugins`), in ticks of 50 ms                  |
| Balancers and Sentinel rules            | Threads of the proxy, possibly two at once                                                         |
| After `await` of an asynchronous member | The thread its operation completes on: a transfer completes on a thread of the proxy               |

There is no thread to hop to: nothing like `world.Post` exists on the proxy, and none is needed.

## Shared state needs care

The players of two servers raise events on two threads, a balancer may run for two groups at once, a command runs on
the thread of its player while a task runs on the plugin thread. State of the plugin that several of them change needs
a lock or a concurrent collection:

```csharp
using System.Collections.Concurrent;
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Events;

namespace Network;

public sealed partial class SessionsPlugin : ProxyPlugin
{
    private readonly ConcurrentDictionary<string, DateTime> _joinedAt = new();

    [EventHandler]
    public void OnJoined(PlayerJoinedEvent e) => _joinedAt[e.Player.Uuid] = DateTime.UtcNow;

    [EventHandler]
    public void OnLeft(PlayerLeftEvent e)
    {
        if (_joinedAt.TryRemove(e.Player.Uuid, out DateTime joined))
        {
            Context.Logger.LogInformation("{Player} played for {Time}", e.Player.Name, DateTime.UtcNow - joined);
        }
    }
}
```

## Waiting

A handler or command that waits awaits a `Task`: `player.TransferAsync`, `player.Forms.ShowAsync`, `Task.Delay`. It
goes on on the thread the task completes on; that is fine on the proxy, since every member can be called from any
thread. Never block a thread of the proxy (`.Result`, `.Wait()`, `Thread.Sleep`): it serves players.

```csharp
Context.Commands.Register("lobby", spec => spec.Executes(async call =>
{
    TransferResult result = await call.Player.TransferAsync("lobby");    // goes on on a thread of the proxy
    if (result is not (TransferResult.Completed or TransferResult.Reconnecting))
    {
        call.Fail($"The lobby is not available ({result}).");
    }
}));
```

An asynchronous job a handler starts (`_ = RunAsync(...)`) should catch what it throws, log it and report it with
`PluginFaults.Report(message)`, so it counts as a fault ([Errors and limits](../../network/errors-and-limits/)). A wait still
pending when the plugin is disabled ends with `OperationCanceledException`.

## Rules to remember

- Keep the objects of the SDK you need (a `Player`, a `Server`), never an event object or a `BalanceChoice`: they are
  valid only during the call.
- Check `player.IsOnline` before using a player you kept: one that left throws `PluginObjectGoneException`.
- Balancers and Sentinel rules at the `Connection` and `Command` stages answer at once: no waiting there
  ([Balancers](../../network/balancers/), [Sentinel](../../network/sentinel/)).
