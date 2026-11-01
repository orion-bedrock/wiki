---
title: "Players"
description: "Orion proxy plugins: the players of the proxy: who they are, messages, permissions, disconnecting them."
sidebar:
  order: 1
---

`Player` (namespace `Orion.Sdk.Proxy.Players`) is a player of the proxy: connected to the network, on one of its
servers or moving between them. `ProxyServer.Current` (namespace `Orion.Sdk.Proxy`) is the proxy itself, where a
plugin finds the players, servers, Sentinel and maintenance.

## Find players

```csharp
ProxyServer proxy = ProxyServer.Current;
Player? steve = proxy.FindPlayer("Steve");
foreach (Player p in proxy.Players)                       // the players online, at this moment
{
    p.SendMessage($"{proxy.PlayerCount}/{proxy.MaxPlayers} on {proxy.Name}");
}

IReadOnlyList<Player> inLobby = proxy.Players.Where(p => p.Server?.Group == "lobby").ToList();
```

`ProxyServer.Current` exists from `OnEnable` on; it throws `InvalidOperationException` in `OnLoad`. Keep a `Player`
as long as you need it and check `IsOnline` before using one you kept: a player that left throws
`PluginObjectGoneException`. Two `Player` objects of the same player are equal.

## Who the player is and where

| Member          | What it is                                                           |
|-----------------|----------------------------------------------------------------------|
| `Name`          | The name of the player                                               |
| `Uuid`          | Its UUID, as text: the stable key to store data about a player       |
| `Xuid`          | Its Xbox user ID, or `null` when it is not signed in to Xbox         |
| `Locale`        | Its language, such as `es_MX`                                        |
| `Server`        | The server it is on, or `null` while it moves between servers        |
| `OnlineSeconds` | How long it has been on the proxy                                    |
| `IsOperator`    | Whether it is an operator of the proxy (`operators` of `proxy.json`) |

## Talk to the player, or disconnect it

```csharp
player.SendMessage("Hello from the proxy!");
ProxyServer.Current.Broadcast(Text.Lang("network::event_starts"));
player.Disconnect("You were kicked from the network.");
```

Forms of the proxy are shown on whatever server the player is on ([Forms](../forms/)).

## Move the player

```csharp
TransferResult result = await player.TransferAsync("skywars");             // a group: its balancer chooses the server
if (ProxyServer.Current.Servers.Find("lobby-2") is { } lobby)
{
    result = await player.TransferAsync(lobby);                              // one server
}
```

Transfers, their results and the events around them are in [Transfers](../transfers/).

## Permissions

The proxy has its own permissions, separate from those of the servers: operators of `proxy.json` have all of them,
other players those granted to them. Grants last until the player leaves the proxy.

```csharp
if (!player.HasPermission("network.vip"))
{
    player.GrantPermission("network.vip");
}

player.RevokePermission("network.vip");
```

Commands of the proxy use them (`spec.Permission("network.send")`, [Commands](../../basics/commands/)), and so does the bypass
of maintenance ([Maintenance](../maintenance/)). To keep permissions across sessions, store them
(`Context.DataDirectory`) and grant them again in `PlayerJoinedEvent`.

## Join and leave events

| Event                      | When                                                                          |
|----------------------------|-------------------------------------------------------------------------------|
| `PlayerLoginEvent`         | Logged in, before any server is chosen: refuse it, or let it in over capacity |
| `PlayerInitialServerEvent` | Its first server is chosen: change `TargetName`, or refuse it                 |
| `PlayerJoinedEvent`        | It reached its first server, which logs it in now                             |
| `PlayerSwitchedEvent`      | It moved to another server (`From`, `To`)                                     |
| `PlayerKickedEvent`        | It lost its server: kicked, or the server went away (`Cause`, `Reason`)       |
| `PlayerLeftEvent`          | It left the proxy                                                             |

```csharp
[EventHandler]
public static void OnLogin(PlayerLoginEvent e)
{
    if (ProxyServer.Current.PlayerCount >= ProxyServer.Current.MaxPlayers && e.Player.HasPermission("network.vip"))
    {
        e.IgnoreCapacity = true;                            // VIPs join a full network
    }
}
```

## Reference

`Player`: A player of the proxy, on one of its servers.

| Member                                              | What it is                                                                                             |
|-----------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `void Disconnect(Text message)`                     | Disconnects the player from the proxy with a message, plain or in its language                         |
| `PlayerForms Forms`                                 | The forms of the proxy the player sees                                                                 |
| `bool GrantPermission(string permission)`           | Grants a permission of the proxy to the player, until it leaves                                        |
| `bool HasPermission(string permission)`             | Tells whether the player has a permission of the proxy                                                 |
| `bool IsOnline`                                     | Whether the player is still on the proxy                                                               |
| `bool IsOperator`                                   | Whether the player is an operator of the proxy                                                         |
| `string Locale`                                     | The language of the player, such as `es_MX`                                                            |
| `string Name`                                       | The name of the player                                                                                 |
| `double OnlineSeconds`                              | How long the player has been on the proxy, in seconds                                                  |
| `bool RevokePermission(string permission)`          | Revokes a permission of the proxy from the player                                                      |
| `void SendMessage(Text message)`                    | Shows a message in the chat of the player, plain or in its language                                    |
| `Server? Server`                                    | The server the player is on, or `null` between servers                                                 |
| `Task<TransferResult> TransferAsync(string target)` | Moves the player to a server by id or to a group by name; it completes with how it went, never failing |
| `Task<TransferResult> TransferAsync(Server server)` | Moves the player to a server of the proxy; the task completes on a thread of the proxy                 |
| `string Uuid`                                       | The UUID of the player, as text                                                                        |
| `string? Xuid`                                      | The XUID of the player, or `null` when it is not signed in to Xbox                                     |

`ProxyServer`: The proxy: its players, servers, Sentinel and maintenance.

| Member                            | What it is                                                                                 |
|-----------------------------------|--------------------------------------------------------------------------------------------|
| `void Broadcast(Text message)`    | Shows a message in the chat of every player of the proxy, plain or in the language of each |
| `static ProxyServer Current`      | The proxy; `InvalidOperationException` before `OnEnable`                                   |
| `Player? FindPlayer(string name)` | Finds a player online by name                                                              |
| `Maintenance Maintenance`         | The maintenance of the proxy, its groups and servers                                       |
| `int MaxPlayers`                  | How many players the proxy takes, 0 for no limit                                           |
| `string Name`                     | The name of the proxy                                                                      |
| `int PlayerCount`                 | The number of players online                                                               |
| `IReadOnlyList<Player> Players`   | The players online, at this moment                                                         |
| `Sentinel Sentinel`               | Sentinel, the guard of the proxy                                                           |
| `ServerRegistry Servers`          | The servers and groups behind the proxy                                                    |
