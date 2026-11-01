---
title: "Events"
description: "Orion proxy plugins: handling the events of the proxy: priorities, canceling, changing them; every event."
sidebar:
  order: 5
---

The proxy raises events for what happens in the network: a player logs in, reaches its first server, moves to
another one, loses its server; a server goes offline; Sentinel blocks an address. A handler reads the event, changes
what it says (where a player goes, the message it is refused with) and, for most events, cancels it. The events of the
proxy are in the namespace `Orion.Sdk.Proxy.Events`.

## Handle an event

A handler is a method marked `[EventHandler]` that returns `void` and takes one event, in a `partial` class: the SDK
finds it when you build. The plugin class is a listener itself, registered just
before `OnEnable`.

```csharp
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Events;
using Orion.Sdk.Proxy.Lang;

namespace Network;

public sealed partial class NetworkPlugin : ProxyPlugin
{
    [EventHandler]
    public static void OnJoined(PlayerJoinedEvent e) => e.Player.SendMessage($"Welcome, {e.Player.Name}!");

    [EventHandler(EventPriority.High)]
    public static void OnLogin(PlayerLoginEvent e)
    {
        if (e.Player.Xuid is null)
        {
            e.RefusalMessage = Text.Lang("network::xbox_required");
            e.IsCanceled = true;
        }
    }
}
```

## Listener classes

Put handlers in classes of their own and register them with `Context.Events.Register(listener)`, from `OnEnable` on:

```csharp
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Events;
using Orion.Sdk.Proxy.Players;
using Orion.Sdk.Proxy.Servers;

namespace Network;

public sealed partial class OfflineAlerts(string staffPermission)
{
    [EventHandler]
    public void OnOffline(ServerOfflineEvent e)
    {
        foreach (Player player in ProxyServer.Current.Players.Where(p => p.HasPermission(staffPermission)))
        {
            player.SendMessage($"§c{e.Server.Id} went offline.");
        }
    }

    [EventHandler]
    public void OnState(ServerStateEvent e)
    {
        if (e.Current == ServerState.Draining)
        {
            e.Server.Status = "restarting";
        }
    }
}

public sealed class AlertsPlugin : ProxyPlugin
{
    public override void OnEnable() => Context.Events.Register(new OfflineAlerts("network.staff"));
}
```

A listener stays until `Context.Events.Unregister(listener)` takes it away (`false` when it was not registered) or the
plugin is disabled; once no handler of the plugin is left for an event (at a priority), the proxy stops dispatching that
event to the plugin. Registering an object that is registered already does nothing; its `[MessageHandler]` methods hear
their channels from its first registration until the plugin is disabled.

The SDK has no lambda handlers (`Events.On<T>(e => …)`): a plugin is compiled with Native AOT, without reflection over
its code at run time, so the SDK reads every handler from its attributes when you build and checks it (`ORSG007`,
`ORSG008`). A small listener class can still call any delegate you keep.

## Priorities, canceling and changes

Handlers run by priority, from `Lowest` to `Highest`, across every plugin (then by the load order of the plugins), and
`Monitor` handlers run last, read-only, with the `Outcome` (`Done`, `Canceled`, `Refused`). Each handler sees what the
previous ones left. `IsCanceled` cancels a cancelable event and a later handler may set it back; `IgnoreCanceled =
true` skips a handler for events already canceled.

```csharp
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Events;

namespace Network;

public sealed partial class Routing : ProxyPlugin
{
    // Players who lost a minigame server go back to the lobby rather than to another minigame.
    [EventHandler]
    public static void OnFallback(PlayerFallbackEvent e)
    {
        if (e.Lost?.Group.StartsWith("mini-", StringComparison.Ordinal) == true)
        {
            e.TargetName = "lobby";
        }
    }

    // Staff skip the capacity of the proxy.
    [EventHandler]
    public static void OnLogin(PlayerLoginEvent e) => e.IgnoreCapacity = e.Player.HasPermission("network.staff");

    [EventHandler(EventPriority.Monitor)]
    public void OnTransfer(PlayerTransferEvent e)
    {
        if (e.Outcome == EventOutcome.Canceled)
        {
            e.Player.SendMessage($"You cannot go to {e.TargetName} now.");
        }
    }
}
```

A `TargetName` is the id of a server or the name of a group; a value the proxy does not know is refused: the change is
undone, with a warning in the log of the plugin. A writable `string?` takes `null`: `PlayerFallbackEvent.TargetName =
null` disconnects the player with `DisconnectMessage`. `DisconnectMessage` and the `RefusalMessage`s are `Text`s, shown
in the language of the player.

## Rules of handlers

| Rule             | What                                                                                                                                          |
|------------------|-----------------------------------------------------------------------------------------------------------------------------------------------|
| The event object | Valid only during the call: it is reused, so keep the values you need, never the event                                                        |
| Threads          | A handler runs on the thread that raised the event: the one of the player for its events ([Threads](../threads/))                           |
| A handler throws | A fault of the plugin: what the handlers of the plugin at that priority changed is undone, and its next handlers at that priority are skipped |
| Waiting          | A handler is not asynchronous: start a task and let the event go                                                                              |
| Disabling        | Every handler of the plugin is removed when it is disabled                                                                                    |

## Every event

### Players

| Event                      | When                                                                                                                                                   | Fields (writable in bold)                                                         | Cancelable |
|----------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------|------------|
| `PlayerLoginEvent`         | A player logged in to the proxy and is about to be admitted, before any server is chosen; cancel with a `RefusalMessage` to refuse it                  | `Player`, **`IgnoreCapacity`**, **`RefusalMessage`**                              | Yes        |
| `PlayerInitialServerEvent` | The first server of an admitted player is chosen: `TargetName` is a server or group; cancel with a `RefusalMessage` to refuse the player               | `Player`, **`RefusalMessage`**, **`TargetName`**                                  | Yes        |
| `PlayerJoinedEvent`        | A player joined the proxy and reached its first server, which now logs it in                                                                           | `Player`, `Server?`                                                               | No         |
| `PlayerSwitchedEvent`      | A player moved to another server without reconnecting                                                                                                  | `Player`, `From?`, `To?`                                                          | No         |
| `PlayerKickedEvent`        | A player lost its server: the server disconnected it, or went away                                                                                     | `Player`, `Server?`, `Cause`, `Reason?`                                           | No         |
| `PlayerFallbackEvent`      | A player lost its server, and its fallback chose where it goes: `TargetName` is a server or group, or `null` to disconnect it with `DisconnectMessage` | `Player`, `Lost?`, `Cause`, `Reason?`, **`DisconnectMessage`**, **`TargetName?`** | Yes        |
| `PlayerLeftEvent`          | A player that joined left the proxy                                                                                                                    | `Player`, `Server?`                                                               | No         |
| `PlayerCommandEvent`       | A player sent a command of the proxy                                                                                                                   | `Player`, **`CommandLine`**                                                       | Yes        |

### Transfers

| Event                 | When                                                                    | Fields (writable in bold)                    | Cancelable |
|-----------------------|-------------------------------------------------------------------------|----------------------------------------------|------------|
| `PlayerTransferEvent` | A player is about to move to another server of the proxy, whoever asked | `Player`, `From?`, `Cause`, **`TargetName`** | Yes        |
| `TransferFailedEvent` | A transfer of a player did not take it anywhere                         | `Player`, `Result`, `TargetName`             | No         |

### Servers

| Event                | When                                                                                                                                                      | Fields (writable in bold)                                                  | Cancelable |
|----------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------|------------|
| `ServerOnlineEvent`  | A server takes players again, or joined the proxy                                                                                                         | `Server`                                                                   | No         |
| `ServerOfflineEvent` | A server stopped taking players because it is unreachable, or left the proxy                                                                              | `Server`                                                                   | No         |
| `ServerStateEvent`   | The state of a server changed                                                                                                                             | `Server`, `Previous`, `Current`                                            | No         |
| `ServerBalanceEvent` | The balancer of a group chose a server                                                                                                                    | `Group`, **`Server?`**, `Slots`, `Reason`, `PlayerCount`, `CandidateCount` | Yes        |
| `ServerMessageEvent` | The server of a player sent a message of its plugins with it, handled by a plugin or not (`Message` is the base64 of the bytes); the client never sees it | `Player`, `Server?`, `Channel`, `Message`                                  | No         |

### The proxy

| Event                     | When                                                                           | Fields (writable in bold)                            | Cancelable |
|---------------------------|--------------------------------------------------------------------------------|------------------------------------------------------|------------|
| `ProxyStartedEvent`       | The proxy started: it listens for players                                      | `Proxy`                                              | No         |
| `ProxyStoppingEvent`      | The proxy is stopping: its players are still connected, for the last time      | `Proxy`                                              | No         |
| `MaintenanceChangedEvent` | The proxy, a group or a server went into maintenance or out of it              | `Scope`, `Target?`, `IsEnabled`                      | No         |
| `AddressBlockedEvent`     | Sentinel blocked an address: it broke the limits too often, or code blocked it | `Player?`, `Rule`, `AddressText`, `UntilUnixSeconds` | No         |

## Reference

| Member                                       | What it is                                                                              |
|----------------------------------------------|-----------------------------------------------------------------------------------------|
| `[EventHandler]`, `[EventHandler(priority)]` | Marks a handler (`EventHandlerAttribute`: `Priority`, `IgnoreCanceled`)                 |
| `EventPriority`                              | `Lowest`, `Low`, `Normal` (the default), `High`, `Highest`, `Monitor`                   |
| `Context.Events.Register(listener)`          | Registers the handlers of a listener (`PluginEvents.Register`)                          |
| `Context.Events.Unregister(listener)`        | Removes them (`PluginEvents.Unregister`)                                                |
| `PluginEvent`, `CancelableEvent`             | The bases of the events: `IsCanceled` and `Outcome` (`EventOutcome`) of cancelable ones |
| `EventOutcome`                               | `Pending`, `Done`, `Canceled`, `Refused`                                                |
| `const int Id` of each event                 | The number of the event in the SDK, as the log names it                                 |

`IEventListener`, `EventHandlers`, `IPluginEvent<T>`, `EventPool<T>`, `PluginEventHeader` and the protected members of
`PluginEvent` (`EventData`, `SetText`, `SetOptionalText`) are used by the SDK; plugin code does not use them. The causes of the events (`TransferCause`, `FallbackCause`,
`BalanceReason`, `MaintenanceScope`) are in [Transfers](../../network/transfers/), [Balancers](../../network/balancers/) and
[Maintenance](../../network/maintenance/).
