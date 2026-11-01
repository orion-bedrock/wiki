---
title: "Keeping data"
description: "Orion server plugins: keeping data: the data directory, data on entities and worlds, saved values."
sidebar:
  order: 4
---

A plugin keeps data in four places, each with its own life:

| Where                            | Kept                                   | Use it for                                                  |
|----------------------------------|----------------------------------------|-------------------------------------------------------------|
| Files in `Context.DataDirectory` | As long as the files are there         | Settings, player profiles, statistics, anything of your own |
| `entity.Data`                    | With the entity, when it is persistent | The owner of a pet, the team of a guard, the level of a mob |
| `world.Properties`               | With the world                         | The author of a map, the spawn points of an arena           |
| Values you store yourself        | Wherever you put them                  | Inventories (snapshots), blocks (`BlockState.Key`)          |

## The data directory

`Context.DataDirectory` is the full path of `plugins/<id>/data`, which Orion creates for the plugin. Read in `OnLoad`
or `OnEnable`, write in `OnDisable`, and save now and then in between so a crash loses little. JSON goes through a
source-generated context (Native AOT has no reflection):

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;

namespace Arena;

public sealed class Profile
{
    public int Wins { get; set; }

    public int Kills { get; set; }
}

[JsonSerializable(typeof(Dictionary<string, Profile>))]
internal sealed partial class ProfileJson : JsonSerializerContext;

public sealed partial class ProfilesPlugin : ServerPlugin
{
    private Dictionary<string, Profile> _profiles = [];

    private string FilePath => Path.Combine(Context.DataDirectory, "profiles.json");

    public override void OnEnable()
    {
        if (File.Exists(FilePath))
        {
            _profiles = JsonSerializer.Deserialize(File.ReadAllText(FilePath), ProfileJson.Default.DictionaryStringProfile) ?? [];
        }

        Context.Scheduler.Every(20 * 60 * 5, _ => Save());          // every five minutes
    }

    public override void OnDisable() => Save();

    [EventHandler]
    public void OnJoin(PlayerJoinEvent e)
    {
        Profile profile = _profiles.TryGetValue(e.Player.Uuid, out Profile? found) ? found : _profiles[e.Player.Uuid] = new Profile();
        e.Player.SendMessage($"Wins: {profile.Wins}, kills: {profile.Kills}");
    }

    private void Save() => File.WriteAllText(FilePath, JsonSerializer.Serialize(_profiles, ProfileJson.Default.DictionaryStringProfile));
}
```

Key what you keep about players by `player.Uuid`: names change, UUIDs do not. Writing a large file takes time: for
big data, write off the world thread (`File.WriteAllTextAsync`, a copy of the data) so the world does not wait
([Threads and async code](../../basics/threads/)).

## Data on entities

`entity.Data` holds typed values by key, saved with the entity when it is persistent (`IsPersistent`, or spawned with
`EntitySpawnMode.Persistent`). Every plugin shares the data of an entity: put the id of your plugin in front of your
keys.

```csharp
var pet = (Mob)world.Entities.Spawn(EntityIds.Wolf, player.Position, EntitySpawnMode.Persistent, 0, 0);
pet.Data.SetText("pets:owner", player.Uuid);
pet.Data.SetLong("pets:level", 1);
pet.Data.SetDouble("pets:hunger", 0.5);
pet.Data.SetBool("pets:sitting", false);
```

```csharp
[EventHandler]
public static void OnInteract(PlayerInteractEntityEvent e)
{
    if (e.Target.Data.GetText("pets:owner") is { } owner && owner == e.Player.Uuid)
    {
        e.Target.Data.SetLong("pets:level", e.Target.Data.GetLong("pets:level", 1) + 1);
    }
}
```

`GetLong`, `GetDouble` and `GetBool` take a fallback for a key without a value; `GetText` gives `null`. `Keys`, `Has`,
`Remove` and `Count` manage the keys.

## Properties of a world

`world.Properties` keeps texts with the world, saved with it:

```csharp
world.Properties.Set("arena:author", "Steve");
world.Properties.Set("arena:spawns", "0,64,0;10,64,10;-10,64,-10");
string? author = world.Properties.Get("arena:author");
world.Properties.Remove("arena:spawns");
```

A world created `InMemory` keeps them only while it is loaded.

## Values that cross restarts

| Value                     | Keep it as                                                       | Read it back with                                              |
|---------------------------|------------------------------------------------------------------|----------------------------------------------------------------|
| What a player carries     | `player.SnapshotInventory().ToJson()`                            | `PlayerInventorySnapshot.FromJson(json)`                       |
| The slots of an inventory | `inventory.Snapshot().ToJson()`                                  | `InventorySnapshot.FromJson(json)`                             |
| A block state             | `state.Text` (`minecraft:oak_log[pillar_axis=y]`) or `state.Key` | `GameServer.Current.Blocks.Parse(text)`, `BlockState.TryParse` |
| A position                | Its `X`, `Y`, `Z`                                                | `new BlockPosition(x, y, z)`, `new Vector3(x, y, z)`           |
| A world                   | `world.Name`                                                     | `GameServer.Current.FindWorld(name)`                           |
| A player                  | `player.Uuid`                                                    | `GameServer.Current.FindPlayerByUuid(uuid)`                    |
| An entity                 | `entity.Uuid`, for a persistent one                              | `world.Entities.Find(uuid)`                                    |

Never keep the SDK objects themselves across restarts: a `Player`, `World` or `Entity` stands for the object while it
exists, and another start of the server has other objects.

## Reference

`EntityData` (`entity.Data`): the data plugins keep on an entity, typed values by key, saved with a persistent entity.

| Member                                          | What it is                               |
|-------------------------------------------------|------------------------------------------|
| `int Count`                                     | The number of keys                       |
| `bool GetBool(string key, bool fallback)`       | A value that is on or off, or a fallback |
| `double GetDouble(string key, double fallback)` | A decimal number, or a fallback          |
| `long GetLong(string key, long fallback)`       | A whole number, or a fallback            |
| `string? GetText(string key)`                   | A text, or null                          |
| `bool Has(string key)`                          | Tells whether a key has a value          |
| `IReadOnlyList<string> Keys`                    | The keys that have a value               |
| `bool Remove(string key)`                       | Removes the value of a key               |
| `void SetBool(string key, bool value)`          | Sets a value that is on or off           |
| `void SetDouble(string key, double value)`      | Sets a decimal number                    |
| `void SetLong(string key, long value)`          | Sets a whole number                      |
| `void SetText(string key, string value)`        | Sets a text                              |

`WorldProperties`: Text that plugins keep with a world (the author of a map, the teams of an arena).

| Member                               | What it is                                         |
|--------------------------------------|----------------------------------------------------|
| `int Count`                          | The number of properties                           |
| `string? Get(string key)`            | The value of a property                            |
| `bool Remove(string key)`            | Removes a property                                 |
| `void Set(string key, string value)` | Sets the value of a property, saved with the world |
