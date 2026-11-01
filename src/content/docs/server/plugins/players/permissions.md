---
title: "Permissions and abilities"
description: "Orion server plugins: named permissions, operators and abilities."
sidebar:
  order: 2
---

Three things decide what a player may do on an Orion server:

| What                 | Where it comes from                                                                            | Read it with                      |
|----------------------|------------------------------------------------------------------------------------------------|-----------------------------------|
| Named permissions    | Granted by plugins for the session, such as `arena.admin`                                      | `player.HasPermission(name)`      |
| The permission level | `Visitor`, `Member` or `Operator`; operators are listed in `server.json`                       | `player.Permission`, `IsOperator` |
| Abilities            | Worked out from the game mode and the level: build, mine, fly, attack…, enforced by the client | `player.Abilities`                |

## Named permissions

A named permission is a string your plugin chooses (use the id of the plugin in front: `arena.join`, `arena.admin`).
Operators have every permission; other players have those granted to them.

```csharp
if (!player.HasPermission("arena.vip"))
{
    player.SendMessage("This area is for VIPs.");
}

player.GrantPermission("arena.vip");        // until the player leaves
player.RevokePermission("arena.vip");
```

Grants last until the player leaves the server: Orion does not save them. To keep permissions, store them yourself
([Keeping data](../../platform/persistence/)) and grant them again when the player joins:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;

namespace Arena;

public sealed partial class RanksPlugin : ServerPlugin
{
    private readonly Dictionary<string, string[]> _ranks = new()
    {
        ["2b9a3e6f-0c1d-4e7a-9f3b-5d8c1a2b4e6f"] = ["arena.vip", "arena.build"],
    };

    [EventHandler]
    public void OnJoin(PlayerJoinEvent e)
    {
        foreach (string permission in _ranks.GetValueOrDefault(e.Player.Uuid, []))
        {
            e.Player.GrantPermission(permission);
        }
    }
}
```

Commands use the same permissions: `spec.Permission("arena.admin")` hides a command from the players without it
([Commands](../../basics/commands/)). `PermissionChangedEvent` comes whenever a permission of a player is granted or revoked
(`Permission`, `IsGranted`), or its level changes (`Permission` is then `null`).

## The permission level

`player.Permission` is `Visitor` (only looks around), `Member` (a normal player) or `Operator` (operator commands and
teleporting). Operators come from the `operators` of `server.json`; a plugin cannot change the level of a player in the
game, but it chooses the level of a player that logs in:

```csharp
[EventHandler]
public static void OnLogin(PlayerLoginEvent e)
{
    if (e.Player.Name == "Guest")
    {
        e.Permission = PlayerPermission.Visitor;
        e.GameMode = GameMode.Adventure;
    }
}
```

## Abilities

The client enforces what a player may do: build, mine, use doors and switches, open containers, attack players or
mobs, fly. The server works the abilities out from the game mode and the permission level when the player joins and
whenever either changes; `PlayerAbilitiesEvent` lets a plugin change the result:

```csharp
[EventHandler]
public static void OnAbilities(PlayerAbilitiesEvent e)
{
    if (e.World?.Name == "lobby")
    {
        e.Abilities &= ~(PlayerAbilities.Build | PlayerAbilities.Mine | PlayerAbilities.AttackPlayers);
    }
}
```

When something your handler depends on changes (the player entered the lobby), ask for the abilities again:
`player.RefreshAbilities()` runs `PlayerAbilitiesEvent` again and sends the result to the client.

```csharp
World lobby = GameServer.Current.FindWorld("lobby")!;
if (await player.TeleportAsync(lobby, lobby.Spawn))
{
    player.RefreshAbilities();                 // on the thread of the lobby: the rules of OnAbilities apply now
}
```

`PlayerAbilities` is a set of flags; read them with `player.Abilities.HasFlag(PlayerAbilities.MayFly)`.

## Reference

| Member of `Player`                   | What it is                                                                                  |
|--------------------------------------|---------------------------------------------------------------------------------------------|
| `bool HasPermission(string name)`    | Whether the player has a named permission: operators have all                               |
| `bool GrantPermission(string name)`  | Grants a named permission until the player leaves                                           |
| `bool RevokePermission(string name)` | Revokes a named permission                                                                  |
| `bool IsOperator`                    | Whether the player is an operator                                                           |
| `PlayerPermission Permission`        | The permission level, read-only                                                             |
| `PlayerAbilities Abilities`          | What the player may do now                                                                  |
| `void RefreshAbilities()`            | Works the abilities out again, through `PlayerAbilitiesEvent`, and sends them to the client |

| Event                    | What                                                                                                       |
|--------------------------|------------------------------------------------------------------------------------------------------------|
| `PlayerLoginEvent`       | Writable `Permission` and `GameMode` of a player that logs in                                              |
| `PlayerAbilitiesEvent`   | Writable `Abilities` (and `From`, what they were) whenever they are worked out                             |
| `PermissionChangedEvent` | A permission granted or revoked (`Permission`, `IsGranted`), or the level changed (`Permission` is `null`) |

`PlayerAbilities`: What a player may do, as its client enforces it.

| Member                       | What it is                                            |
|------------------------------|-------------------------------------------------------|
| `None = 0`                   | Nothing                                               |
| `Build = 1`                  | Place blocks                                          |
| `Mine = 2`                   | Break blocks                                          |
| `DoorsAndSwitches = 4`       | Use doors, trapdoors, buttons and levers              |
| `OpenContainers = 8`         | Open chests and other containers                      |
| `AttackPlayers = 16`         | Attack players                                        |
| `AttackMobs = 32`            | Attack mobs                                           |
| `OperatorCommands = 64`      | Use operator commands                                 |
| `Teleport = 128`             | Teleport with commands                                |
| `Invulnerable = 256`         | Take no damage                                        |
| `Flying = 512`               | Is flying now                                         |
| `MayFly = 1024`              | May start flying                                      |
| `InstantBuild = 2048`        | Break blocks at once                                  |
| `Lightning = 4096`           | Summon lightning                                      |
| `Muted = 32768`              | Cannot chat                                           |
| `WorldBuilder = 65536`       | Use world builder tools                               |
| `NoClip = 131072`            | Move through blocks                                   |
| `PrivilegedBuilder = 262144` | Edit blocks other players cannot (privileged builder) |

`PlayerPermission`: What a player is allowed on the server, beyond the rules of its game mode.

| Member         | What it is                                                                |
|----------------|---------------------------------------------------------------------------|
| `Visitor = 0`  | Can only look around                                                      |
| `Member = 1`   | A normal player                                                           |
| `Operator = 2` | An operator: operator commands and teleporting (operators of server.json) |
