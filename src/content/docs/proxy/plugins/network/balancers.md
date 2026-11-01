---
title: "Balancers"
description: "Orion proxy plugins: choosing the server of a group for players."
sidebar:
  order: 4
---

When players are sent to a group, its balancer picks the server: the proxy has `first`, `round_robin`,
`least_players` (the default), `fill` (the fullest with room) and `random`. A plugin registers balancers of its own by
name, and the groups of `routing.json` that name one use it. The types are in `Orion.Sdk.Proxy.Servers`.

```json
{
  "groups": {
    "lobby": { "balancer": "fewest_players" },
    "skywars": { "balancer": "by_map" }
  }
}
```

## A balancer as a class

A balancer derives from `ServerBalancer` and answers `Choose`: one of the candidates, or `null` for none.

```csharp
using Orion.Sdk.Proxy.Servers;

namespace Network;

// Sends players to the candidate with the fewest players; of two with as many, the first of the group.
public sealed class FewestPlayersBalancer : ServerBalancer
{
    public override Server? Choose(BalanceChoice choice) => choice.Candidates.MinBy(static server => server.PlayerCount);
}

// Prefers the servers whose metadata names the map players voted for, and keeps parties together.
public sealed class ByMapBalancer(Func<string> votedMap) : ServerBalancer
{
    public override Server? Choose(BalanceChoice choice)
    {
        string map = votedMap();
        return choice.Candidates
            .Where(server => server.CanTake(choice.Slots))
            .OrderByDescending(server => server.GetMetadata("map") == map)
            .ThenBy(server => server.PlayerCount)
            .FirstOrDefault();
    }
}
```

```csharp
ProxyServer.Current.Servers.RegisterBalancer("fewest_players", new FewestPlayersBalancer());
ProxyServer.Current.Servers.RegisterBalancer("by_map", new ByMapBalancer(() => "islands"));
```

Register balancers in `OnEnable`. A balancer of a plugin takes the place of the balancer of the proxy of that name
until the plugin is disabled; `Servers.Balancers` lists the names groups may use.

## What Choose gets

| Member of `BalanceChoice` | What it is                                                               |
|---------------------------|--------------------------------------------------------------------------|
| `Group`                   | The group players are sent to                                            |
| `Candidates`              | The servers of the group that may take them                              |
| `Players`                 | The players that go                                                      |
| `Slots`                   | The places they need                                                     |
| `Reason`                  | Why they go: `Join` (joining the proxy), `Transfer`, `Fallback`, `Batch` |

The choice is valid only during the call: keep nothing of it.

## A balancer from a lambda

`RegisterBalancer` takes a `ServerBalancer`. When the rule fits in one expression, a small class that takes a function
gives you the lambda style:

```csharp
using Orion.Sdk.Proxy.Servers;

namespace Network;

public sealed class LambdaBalancer(Func<BalanceChoice, Server?> choose) : ServerBalancer
{
    public override Server? Choose(BalanceChoice choice) => choose(choice);
}
```

```csharp
ProxyServer.Current.Servers.RegisterBalancer("random_lobby",
    new LambdaBalancer(choice => choice.Candidates.Count == 0 ? null : choice.Candidates[Random.Shared.Next(choice.Candidates.Count)]));
```

## Rules

| Case                                              | What the proxy does                                                                                      |
|---------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `Choose` throws                                   | Reports a fault of the plugin and chooses with its own balancer                                          |
| `Choose` returns a server that is not a candidate | The same                                                                                                 |
| `Choose` returns `null`                           | The players get no server of the group                                                                   |
| The plugin is disabled                            | Removes its balancers: the groups go back to the balancer of the proxy of that name (or `least_players`) |

`Choose` runs on threads of the proxy, possibly two at once, and answers at once: no waiting, no I/O. State it reads
(the voted map above) must be safe to read from any thread ([Threads](../../basics/threads/)).

`ServerBalanceEvent` comes after any balancer chose (the proxy's or a plugin's), with the `Group`, the `Server` chosen
(writable), `Slots`, `Reason`, `PlayerCount` and `CandidateCount`; it is cancelable.

## Reference

`ServerBalancer`: A balancer of a plugin: it picks the server of a group for players, in place of the balancer of the
proxy of its name (RegisterBalancer(string, ServerBalancer)), for the groups of routing.json that name it.

| Member                                          | What it is     |
|-------------------------------------------------|----------------|
| `abstract Server? Choose(BalanceChoice choice)` | Picks a server |

`BalanceChoice`: what a balancer of the plugin chooses from, valid during its call.

| Member                             | What it is                                         |
|------------------------------------|----------------------------------------------------|
| `IReadOnlyList<Server> Candidates` | The servers of the group that may take the players |
| `ServerGroup Group`                | The group                                          |
| `IReadOnlyList<Player> Players`    | The players that go                                |
| `BalanceReason Reason`             | Why they go                                        |
| `int Slots`                        | The places they need                               |

`BalanceReason`: Why a balancer chooses a server.

| Member         | What it is                                      |
|----------------|-------------------------------------------------|
| `Join = 0`     | A player joins the proxy                        |
| `Transfer = 1` | A player is sent to a group                     |
| `Fallback = 2` | A player lost its server and goes to a fallback |
| `Batch = 3`    | Several players are sent together               |

`ServerRegistry.RegisterBalancer(string name, ServerBalancer balancer)` registers a balancer.
