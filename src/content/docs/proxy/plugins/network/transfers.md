---
title: "Transfers"
description: "Orion proxy plugins: moving players and parties between servers, fallbacks and the first server."
sidebar:
  order: 3
---

A transfer moves a player from one server of the proxy to another without disconnecting it from the network. A plugin
moves one player or a whole party, to a server or to a group (whose balancer picks the server), decides where players
go when they join or lose their server, and reacts to every move. The types are in `Orion.Sdk.Proxy.Players` and
`Orion.Sdk.Proxy.Servers`.

## Move one player

```csharp
TransferResult result = await player.TransferAsync("skywars");            // a group, or a server by id
switch (result)
{
    case TransferResult.Completed:
    case TransferResult.Reconnecting:
        break;                                                           // it went, or is on its way
    case TransferResult.AlreadyThere:
        player.SendMessage("You are there already.");
        break;
    default:
        player.SendMessage($"Skywars is not available ({result}).");
        break;
}
```

`TransferAsync` never fails: it completes with how the transfer went, on a thread of the proxy.

| `TransferResult` | Meaning                                                                                     |
|------------------|---------------------------------------------------------------------------------------------|
| `Completed`      | The player is on the new server                                                             |
| `Reconnecting`   | The client was told to reconnect, and reaches the new server through the proxy when it does |
| `AlreadyThere`   | The player is on that server, or on a server of that group and no other one takes it        |
| `Unavailable`    | No server of the target takes the player: unknown, offline, draining, not joinable or full  |
| `Cancelled`      | A handler canceled it, the player left, or another transfer replaced it                     |
| `Failed`         | The server could not be joined                                                              |
| `TimedOut`       | The server did not spawn the player in time                                                 |

## Move a party

`ServerRegistry.TransferAsync` moves several players at once and gives a result for each, in their order:

```csharp
IReadOnlyList<Player> party = ProxyServer.Current.Players.Where(p => p.Name is "Steve" or "Alex").ToList();
IReadOnlyList<TransferResult> results = await ProxyServer.Current.Servers.TransferAsync(party, "bedwars", BatchTransferMode.Together);
```

| `BatchTransferMode` | The players go                                               |
|---------------------|--------------------------------------------------------------|
| `Together`          | All to one server with room for all of them, such as a party |
| `Spread`            | Each where the balancer of the group sends it                |

Transfers under way hold their places, so a batch never overflows a server.

## Watch and steer transfers

```csharp
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Events;
using Orion.Sdk.Proxy.Players;
using Orion.Sdk.Proxy.Servers;

namespace Network;

public sealed partial class TransferRules : ProxyPlugin
{
    // Players without the rank cannot go to the VIP lobby, whoever asked.
    [EventHandler]
    public static void OnTransfer(PlayerTransferEvent e)
    {
        if (e.TargetName == "vip-lobby" && !e.Player.HasPermission("network.vip"))
        {
            e.TargetName = "lobby";
        }
    }

    [EventHandler]
    public static void OnFailed(TransferFailedEvent e)
    {
        if (e.Result == TransferResult.Unavailable)
        {
            e.Player.SendMessage($"{e.TargetName} is full or offline, try again soon.");
        }
    }

    [EventHandler]
    public static void OnSwitched(PlayerSwitchedEvent e) =>
        e.Player.SendMessage($"You are on {e.To?.Id ?? "nowhere"} now.");
}
```

| Event                 | When                                                                              |
|-----------------------|-----------------------------------------------------------------------------------|
| `PlayerTransferEvent` | Before a player moves, whoever asked (`Cause`): writable `TargetName`, cancelable |
| `TransferFailedEvent` | A transfer did not take the player anywhere (`Result`, `TargetName`)              |
| `PlayerSwitchedEvent` | A player moved to another server (`From`, `To`)                                   |

`TransferCause` says who asked: `Api` (code of the proxy or of a plugin), `Server` (the server of the player sent it
with a transfer of its own), `Batch` (a transfer of several players), `Command` (`/server`, `/lobby`, `/send`).

## The first server

When a player joins the proxy, `PlayerInitialServerEvent` chooses its first server: by default the default group
(`DefaultGroup`), or the group its address names (`forced_hosts` of `routing.json`). Change `TargetName`, or cancel
with a `RefusalMessage` to refuse the player:

```csharp
[EventHandler]
public static void OnInitialServer(PlayerInitialServerEvent e)
{
    if (e.Player.HasPermission("network.staff"))
    {
        e.TargetName = "staff-lobby";
    }
}
```

## Fallbacks

When a player loses its server (it crashed, kicked the player, or shut down), the proxy chooses where it goes with the
`fallback` of `routing.json`, then raises `PlayerFallbackEvent`: change `TargetName`, or set it to `null` to disconnect
the player with `DisconnectMessage`. `PlayerKickedEvent` reports that the player lost its server.

```csharp
[EventHandler]
public static void OnFallback(PlayerFallbackEvent e)
{
    if (e.Cause == FallbackCause.Kick && e.Reason?.Contains("banned", StringComparison.OrdinalIgnoreCase) == true)
    {
        e.TargetName = null;                                   // banned from a server: off the network
        e.DisconnectMessage = Text.Lang("network::banned_from", ("server", e.Lost?.Id ?? "?"));
    }
}
```

| `FallbackCause` | The player lost its server because                     |
|-----------------|--------------------------------------------------------|
| `Crash`         | It stopped or stopped answering, without a word        |
| `Kick`          | It disconnected the player                             |
| `Shutdown`      | It disconnected the player because it is shutting down |
| `Unavailable`   | No server takes the player when it joins the proxy     |

## Reference

| Member                                                                                               | What it does                                          |
|------------------------------------------------------------------------------------------------------|-------------------------------------------------------|
| `Player.TransferAsync(string target)`                                                                | Moves the player to a server by id or a group by name |
| `Player.TransferAsync(Server server)`                                                                | Moves the player to a server                          |
| `ServerRegistry.TransferAsync(IReadOnlyList<Player> players, string target, BatchTransferMode mode)` | Moves players together; a result for each             |

`TransferResult`: How a transfer of a player between the servers of the proxy ended.

| Member             | What it is                                                                                    |
|--------------------|-----------------------------------------------------------------------------------------------|
| `Completed = 0`    | The player is on the new server                                                               |
| `Reconnecting = 1` | The client was told to reconnect, and reaches the new server through the proxy when it does   |
| `AlreadyThere = 2` | The player is on that server already, or on a server of that group and no other one takes it  |
| `Unavailable = 3`  | No server of the target takes the player: unknown, offline, draining, not joinable or full    |
| `Cancelled = 4`    | A plugin or the proxy canceled the transfer, the player left, or another transfer replaced it |
| `Failed = 5`       | The server could not be joined                                                                |
| `TimedOut = 6`     | The server did not spawn the player in time                                                   |

`TransferCause`: Who asked to move a player.

| Member        | What it is                                                                         |
|---------------|------------------------------------------------------------------------------------|
| `Api = 0`     | Code of the proxy or of a plugin, a command or the control plane                   |
| `Server = 1`  | The server of the player, with a Transfer packet to a server or group of the proxy |
| `Batch = 2`   | A transfer of several players at once                                              |
| `Command = 3` | A command of the proxy, such as /server, /lobby or /send                           |

`BatchTransferMode`: How a group of players is sent to a target.

| Member         | What it is                                                            |
|----------------|-----------------------------------------------------------------------|
| `Together = 0` | Every player to one server with room for all of them, such as a party |
| `Spread = 1`   | The balancer chooses a server for each player                         |

`FallbackCause`: Why a player needs a fallback server.

| Member            | What it is                                              |
|-------------------|---------------------------------------------------------|
| `Crash = 0`       | Its server stopped or stopped answering, without a word |
| `Kick = 1`        | Its server disconnected it                              |
| `Shutdown = 2`    | Its server disconnected it because it is shutting down  |
| `Unavailable = 3` | No server takes the player when it joins the proxy      |
