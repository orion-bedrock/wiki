---
title: "Servers and groups"
description: "Orion proxy plugins: the servers and groups behind the proxy, their states, servers added at run time."
sidebar:
  order: 2
---

Behind the proxy are servers, each in a group: the lobby group with three lobby servers, the skywars group with ten
game servers. Players are sent to a group and its balancer picks the server, or to one server. `routing.json` of the
proxy declares them; a plugin reads them, changes their state, and adds servers while the proxy runs. The types are in
`Orion.Sdk.Proxy.Servers`.

```json
{
  "default_group": "lobby",
  "groups": {
    "skywars": { "balancer": "fewest_players" }
  },
  "servers": [
    { "id": "lobby-1", "group": "lobby", "host": "10.0.0.11", "port": 19140 },
    { "id": "sw-1", "group": "skywars", "host": "10.0.0.21", "port": 19140, "max_players": 12, "metadata": { "map": "islands" } }
  ]
}
```

## Read the servers

```csharp
ServerRegistry servers = ProxyServer.Current.Servers;
foreach (ServerGroup group in servers.Groups)
{
    Context.Logger.LogInformation("{Group}: {Players} players on {Servers} servers ({Balancer})",
        group.Name, group.PlayerCount, group.Servers.Count, group.BalancerName);
}

if (servers.Find("sw-1") is { } sw1)
{
    string? map = sw1.GetMetadata("map");                       // "islands"
    bool room = sw1.CanTake(4);                                  // a party of four fits
}

string lobbyGroup = servers.DefaultGroup;                        // where players join
```

| Member of `Server`                                      | What it is                                                                            |
|---------------------------------------------------------|---------------------------------------------------------------------------------------|
| `Id`, `Group`, `Host`, `Port`                           | Who it is and where                                                                   |
| `MaxPlayers`, `PlayerCount`, `IsFull`, `CanTake(slots)` | How full it is, as the proxy counts; `MaxPlayers` 0 is no limit                       |
| `State`                                                 | `Online`, `Draining` (keeps its players, takes no new ones) or `Offline`              |
| `Joinable`                                              | Whether players routed to its group may go there; settable                            |
| `Status`                                                | A free text of plugins for the server (`"in game"`, `"waiting"`), or `null`; settable |
| `MetadataKeys`, `GetMetadata(key)`                      | The `metadata` of `routing.json`                                                      |
| `IsDynamic`                                             | Whether a plugin or a command added it while the proxy runs                           |

## Change the state of a server

```csharp
if (ProxyServer.Current.Servers.Find("sw-1") is { } server)
{
    ProxyServer.Current.Servers.SetState(server, ServerState.Draining);   // before a restart: no new players
    server.Joinable = false;                                             // the balancer skips it
    server.Status = "restarting";
}
```

A server in a game that has started is typically set not joinable, so that its group sends new players elsewhere, and
joinable again when it waits for players: a plugin of the server tells the proxy through a message
([Messages with the servers](../messaging/)).

## Add servers while the proxy runs

```csharp
Server added = ProxyServer.Current.Servers.Add("bw-3", "bedwars", "10.0.0.31", 19140, maxPlayers: 16);
bool removed = ProxyServer.Current.Servers.Remove("bw-3");   // its players stay until they move
```

A server added by a plugin is online at once and not saved: `routing.json` stays as it is. Ids and group names are 1
to 32 lowercase letters, digits, `-` or `_`, and share one namespace; a group exists when a server names it.

## Server events

| Event                | When                                                                         |
|----------------------|------------------------------------------------------------------------------|
| `ServerOnlineEvent`  | A server takes players again, or joined the proxy                            |
| `ServerOfflineEvent` | A server stopped taking players because it is unreachable, or left the proxy |
| `ServerStateEvent`   | The state of a server changed (`Previous`, `Current`)                        |

## Reference

`ServerRegistry`: The servers and groups behind the proxy.

| Member                                                                                                                          | What it is                                                                                                                                                     |
|---------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `Server Add(string id, string group, string host, int port, int maxPlayers)`                                                    | Adds a server while the proxy runs: online at once, not saved                                                                                                  |
| `IReadOnlyList<Server> All`                                                                                                     | Every server, at this moment                                                                                                                                   |
| `IReadOnlyList<string> Balancers`                                                                                               | The names of the balancers groups may name: those of the proxy and those plugins registered                                                                    |
| `string DefaultGroup`                                                                                                           | The group players join by default                                                                                                                              |
| `Server? Find(string id)`                                                                                                       | Finds a server by id                                                                                                                                           |
| `ServerGroup? FindGroup(string name)`                                                                                           | Finds a group by name                                                                                                                                          |
| `IReadOnlyList<ServerGroup> Groups`                                                                                             | Every group, at this moment                                                                                                                                    |
| `void RegisterBalancer(string name, ServerBalancer balancer)`                                                                   | Registers a balancer by name, in place of the balancer of the proxy of that name, until the plugin is disabled; the groups that name it in routing.json use it |
| `bool Remove(string id)`                                                                                                        | Removes a server; its players stay until they move                                                                                                             |
| `void SetState(Server server, ServerState state)`                                                                               | Sets the state of a server                                                                                                                                     |
| `async Task<IReadOnlyList<TransferResult>> TransferAsync(IReadOnlyList<Player> players, string target, BatchTransferMode mode)` | Moves players together to a server or a group; the task completes on a thread of the proxy                                                                     |

`Server`: A server behind the proxy.

| Member                               | What it is                                                              |
|--------------------------------------|-------------------------------------------------------------------------|
| `bool CanTake(int slots)`            | Tells whether the server takes so many players more                     |
| `string? GetMetadata(string key)`    | A value of the metadata of the server (routing.json)                    |
| `string Group`                       | The group of the server                                                 |
| `string Host`                        | The host of the server                                                  |
| `string Id`                          | The id of the server                                                    |
| `bool IsDynamic`                     | Whether a plugin or a command added the server while the proxy runs     |
| `bool IsFull`                        | Whether the server is full                                              |
| `bool Joinable`                      | Whether the server takes players that are routed to its group; settable |
| `int MaxPlayers`                     | How many players the server takes, 0 for no limit                       |
| `IReadOnlyList<string> MetadataKeys` | The keys of the metadata of the server (GetMetadata reads each)         |
| `int PlayerCount`                    | The players on the server, as the proxy counts them                     |
| `int Port`                           | The port of the server                                                  |
| `ServerState State`                  | The state of the server                                                 |
| `string? Status`                     | A status of the server for plugins, or null; settable                   |

`ServerGroup`: A group of servers behind the proxy.

| Member                          | What it is                               |
|---------------------------------|------------------------------------------|
| `string BalancerName`           | The name of the balancer of the group    |
| `bool IsDeclared`               | Whether routing.json declares the group  |
| `string Name`                   | The name of the group                    |
| `int PlayerCount`               | The players on the servers of the group  |
| `IReadOnlyList<Server> Servers` | The servers of the group, at this moment |

`ServerState`: Whether a server behind the proxy takes players.

| Member         | What it is                                                                              |
|----------------|-----------------------------------------------------------------------------------------|
| `Online = 0`   | The server takes players                                                                |
| `Draining = 1` | The server keeps its players but takes no new ones, for example before it stops         |
| `Offline = 2`  | The server is unreachable: it failed several connections in a row, or its lease ran out |
