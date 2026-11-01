---
title: "NPCs"
description: "Orion server plugins: human NPCs with skins, and mobs that stand still."
sidebar:
  order: 4
---

An NPC is a character that stands in a world for players to talk to: a shopkeeper, a guide, a quest giver. Orion has
human NPCs, mobs that look like players with a skin of your choice; any other mob can be an NPC too. The types are in
`Orion.Sdk.Server.Entities` and `Orion.Sdk.Server.Players`.

## Spawn a human NPC

```csharp
Skin skin = SkinFactory.LoadPng(Path.Combine(Context.DataDirectory, "skins", "merchant.png"), slim: false);
HumanNpc merchant = world.Entities.SpawnHuman(skin, new Vector3(0.5f, 64, 4.5f), EntitySpawnMode.Npc, yaw: 180, pitch: 0);
merchant.NameTag = Text.Lang("lobby::merchant");
merchant.NameTagVisibility = NameTagVisibility.Always;
merchant.InteractText = "Trade";
merchant.Goals.Add(1, GoalFactory.LookAt(merchant, range: 8, chance: 1, kind: EntityIds.Player));
```

`EntitySpawnMode.Npc` makes it `Static` (the world never moves it) and `Invulnerable`; add `Persistent` to keep it in
the world across restarts. A `HumanNpc` is a `Mob`, so it takes goals ([AI and goals](../ai-and-goals/)): looking at
players that come near is the usual one, and `HasAi = false` keeps it from doing anything at all. Skins are made with
`SkinFactory` ([Skins and the player list](../../players/skins-and-player-list/)).

Any other entity works as an NPC with the same options: a villager or an armor stand.

```csharp
Entity villager = world.Entities.Spawn(EntityIds.Villager, new Vector3(8.5f, 64, 4.5f), EntitySpawnOptions.Npc with { Yaw = 90 });
villager.NameTag = "Quests";
```

## React when a player uses an NPC

A player using an entity (a right click, or a tap) raises `PlayerInteractEntityEvent`; hitting one raises
`PlayerAttackEntityEvent`. Check that the `Target` is your NPC.

**One NPC, one handler** in the plugin class:

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Entities;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Forms;
using Orion.Sdk.Server.Game;
using Orion.Sdk.Server.Math;
using Orion.Sdk.Server.Players;

namespace Lobby;

public sealed partial class GuidePlugin : ServerPlugin
{
    private Entity? _guide;

    public override void OnEnable()
    {
        if (GameServer.Current.DefaultWorld is { } world)
        {
            _guide = world.Entities.Spawn(EntityIds.Villager, new Vector3(0.5f, 64, 2.5f), EntitySpawnOptions.Npc);
            _guide.NameTag = "Guide";
        }
    }

    [EventHandler]
    public void OnInteract(PlayerInteractEntityEvent e)
    {
        if (e.Target == _guide)
        {
            e.IsCanceled = true;                                  // no trading screen of the villager
            e.Player.Forms.Show(new SimpleForm("Guide").Content("Welcome! Type /arena to play."));
        }
    }

    [EventHandler]
    public void OnAttack(PlayerAttackEntityEvent e) => e.IsCanceled |= e.Target == _guide;

    public override void OnDisable() => _guide?.Remove();
}
```

**Many NPCs, an action each**: a small listener that keeps an action per NPC lets you give each one a lambda:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server.Entities;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Players;

namespace Lobby;

public sealed partial class Npcs
{
    private readonly Dictionary<Entity, Action<Player>> _actions = [];

    public void Add(Entity npc, Action<Player> onUse) => _actions[npc] = onUse;

    public void Remove(Entity npc) => _actions.Remove(npc);

    [EventHandler]
    public void OnInteract(PlayerInteractEntityEvent e)
    {
        if (_actions.TryGetValue(e.Target, out Action<Player>? action))
        {
            e.IsCanceled = true;
            action(e.Player);
        }
    }

    [EventHandler]
    public void OnAttack(PlayerAttackEntityEvent e) => e.IsCanceled |= _actions.ContainsKey(e.Target);
}
```

```csharp
var npcs = new Npcs();
Context.Events.Register(npcs);

Entity shop = world.Entities.Spawn(EntityIds.Villager, new Vector3(4.5f, 64, 0.5f), EntitySpawnOptions.Npc);
npcs.Add(shop, p => p.RunCommand("/shop"));
Entity quests = world.Entities.Spawn(EntityIds.Villager, new Vector3(-3.5f, 64, 0.5f), EntitySpawnOptions.Npc);
npcs.Add(quests, p => p.SendMessage("No quests today."));
```

Entities compare by the entity they are, so they work as dictionary keys. Keep an NPC that is not persistent in a
loaded chunk (near the spawn of the world), or spawn it again in `ChunkLoadedEvent`: one that is not persistent
disappears with its chunk.

## Reference

| Member                                                                                                 | What it does                                                           |
|--------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------|
| `WorldEntities.SpawnHuman(Skin skin, Vector3 position, EntitySpawnMode flags, float yaw, float pitch)` | Spawns a human NPC with a skin                                         |
| `HumanNpc.Skin`                                                                                        | The skin the NPC wears                                                 |
| `EntitySpawnMode.Npc`, `EntitySpawnOptions.Npc`                                                        | Static and invulnerable, as an NPC                                     |
| `Entity.NameTag`, `NameTagVisibility`, `InteractText`                                                  | What players read over it, and on the button of touch screens          |
| `Mob.HasAi`                                                                                            | Off: the mob does nothing by itself                                    |
| `PlayerInteractEntityEvent`                                                                            | A player used an entity: `Target`, `Held`, `ClickPosition`; cancelable |
| `PlayerAttackEntityEvent`                                                                              | A player hit an entity; cancelable ([Damage, healing and death](../damage/))            |
