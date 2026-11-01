---
title: "Kinds of entities"
description: "Orion server plugins: the classes of the SDK for each kind of entity: TNT, arrows, minecarts, orbs…."
sidebar:
  order: 2
---

Besides players and mobs, the SDK has a class for each kind of entity a plugin works with: items lying on the ground,
experience orbs, lit TNT, lightning, the clouds of lingering potions and minecarts. An entity of one of these kinds is
an object of its class, so test it with `is` or `switch`; an entity of a kind without a class of its own is an object
of the nearest one (`Entity`, `Projectile`). The types are in `Orion.Sdk.Server.Entities`.

```csharp
foreach (Entity entity in world.Entities.InRadius(player.Position, 8))
{
    switch (entity)
    {
        case ItemEntity item:
            item.PickupDelay = 0;                                  // players pick it up at once
            break;
        case ExperienceOrb orb:
            orb.Value *= 2;
            break;
        case Tnt tnt:
            tnt.Fuse = 80;                                         // four more seconds
            break;
        case Minecart cart:
            cart.Break(player);
            break;
    }
}
```

| Class                                                                  | Entity                                    | Members                                                                                                                |
|------------------------------------------------------------------------|-------------------------------------------|------------------------------------------------------------------------------------------------------------------------|
| `ItemEntity`                                                           | An item lying in the world                | `Item`, `PickupDelay`, `Lifetime`                                                                                      |
| `ExperienceOrb`                                                        | An orb of experience                      | `Value`, `Lifetime`                                                                                                    |
| `Tnt`                                                                  | Lit TNT                                   | `Fuse`, `Igniter`                                                                                                      |
| `LightningBolt`                                                        | A lightning bolt                          | `IsHarmless`                                                                                                           |
| `AreaEffectCloud`                                                      | The cloud of a lingering potion           | `Potion`, `Owner`, `Radius`, `Duration`, `WaitTime`, `RadiusPerTick`, `RadiusOnUse`, `ReapplicationDelay`, `IsWaiting` |
| `Minecart`                                                             | A minecart, and the base of the next ones | `Damage`, `HurtTicks`, `HurtDirection`, `IsAtRest`, `Break(breaker)`                                                   |
| `ContainerMinecart`                                                    | A minecart that carries slots             | `Inventory`, `Open(player)`, `OpenedBy`, `CloseAll()`                                                                  |
| `ChestMinecart`                                                        | A minecart with a chest: 27 slots         | Those of `ContainerMinecart`                                                                                           |
| `HopperMinecart`                                                       | A minecart with a hopper: 5 slots         | `IsEnabled`, `TransferCooldown`                                                                                        |
| `TntMinecart`                                                          | A minecart with TNT                       | `Fuse`, `IsLit`, `Igniter`, `Ignite(fuse)`, `Explode()`                                                                |
| `Arrow`, `Snowball`, `Egg`, `EnderPearl`, `ThrownPotion`, `WindCharge` | Projectiles                               | [Projectiles](../projectiles/)                                                                                       |

## Items on the ground

`world.DropItem(stack, position)` drops a stack as an item players can pick up, and `player.DropItem(stack)` throws one
where the player looks:

```csharp
ItemEntity reward = world.DropItem(new ItemStack(ItemIds.Diamond, 3), new Vector3(0.5f, 65, 0.5f));
reward.PickupDelay = 40;                                     // two seconds before anyone takes it
reward.Lifetime = int.MaxValue;                              // it never disappears
reward.NameTag = "Reward";
```

Setting `Item` to the empty stack removes the item. `PickupDelay` set to `int.MaxValue` keeps it from ever being picked
up. `ItemPickupEvent` comes when a player is about to pick one up
([Items and inventories](../../items/items-and-inventories/)).

## Experience

`world.Entities.DropExperience(position, points)` drops orbs as the game splits them; an orb flies to the nearest player
within 8 blocks.

```csharp
world.Entities.DropExperience(player.Position, 100);
```

## TNT and lightning

```csharp
var tnt = (Tnt)world.Entities.Spawn(EntityIds.Tnt, new Vector3(0.5f, 70, 0.5f), EntitySpawnMode.None, 0, 0);
tnt.Fuse = 40;
tnt.Igniter = player;                                         // responsible for the damage of its explosion

world.Weather.Strike(new Vector3(10, 64, 10), harmless: false);
```

How TNT explodes (power, what it breaks) is a rule of the world (`world.Explosions.Tnt`,
[World rules](../../worlds/world-rules/)).

## Minecarts

```csharp
var cart = (ChestMinecart)world.Entities.Spawn(EntityIds.ChestMinecart, new Vector3(0.5f, 65, 0.5f), EntitySpawnMode.None, 0, 0);
cart.Inventory.Add(new ItemStack(ItemIds.GoldIngot, 16));
cart.Open(player);
```

How minecarts move in a world (speeds, drag) is in `world.Redstone.Rules.Minecarts` ([World rules](../../worlds/world-rules/)).

## Reference

`ItemEntity`: An item lying in a world (`minecraft:item`): players who come near pick it up once its PickupDelay is
over, items of the same kind next to each other join into one stack, one caught inside a block rises out of it, and it
disappears after its Lifetime.

| Member            | What it is                                                                           |
|-------------------|--------------------------------------------------------------------------------------|
| `ItemStack Item`  | The stack it holds; the empty stack removes it; settable                             |
| `int Lifetime`    | The `Age` in ticks after which it disappears, or `int.MaxValue` to keep it; settable |
| `int PickupDelay` | The ticks before players can pick it up, or `int.MaxValue` for never; settable       |

`ExperienceOrb`: An experience orb: it flies to the nearest player within 8 blocks, who takes its points by touching it,
joins the orbs next to it, and goes after Lifetime ticks.

| Member         | What it is                                                              |
|----------------|-------------------------------------------------------------------------|
| `int Lifetime` | How long it lies in the world, in ticks from when it appeared; settable |
| `int Value`    | The points it gives; settable                                           |

`Tnt`: lit TNT (`minecraft:tnt`): it falls and slides as a block, flashes while its fuse runs out, then explodes as the
TNT rules of its world say.

| Member            | What it is                                                                    |
|-------------------|-------------------------------------------------------------------------------|
| `int Fuse`        | The ticks until it explodes; clients flash it faster as it runs out; settable |
| `Entity? Igniter` | Who lit it, responsible for the damage to its explosion, or null; settable    |

`LightningBolt`: A lightning bolt (`minecraft:lightning_bolt`): clients draw the flash, everyone in the world hears the
thunder, and on its first tick it hurts the living entities it strikes.

| Member            | What it is                                                 |
|-------------------|------------------------------------------------------------|
| `bool IsHarmless` | Whether it only shows and sounds, hurting no one; settable |

`AreaEffectCloud`: The cloud a lingering potion leaves (`minecraft:area_effect_cloud`): after a short wait, every few
ticks it gives the effects of its potion, for a quarter of their time, to the living entities inside it, which it then
leaves alone for a while; it shrinks with time and with each entity it affects (`AreaEffectCloudEvent`).

| Member                   | What it is                                                                                                       |
|--------------------------|------------------------------------------------------------------------------------------------------------------|
| `int Duration`           | How long it lasts after its wait, in ticks; settable                                                             |
| `bool IsWaiting`         | Whether it still waits and affects no one                                                                        |
| `Entity? Owner`          | Who made it, such as the thrower of the potion, or null; settable                                                |
| `PotionType? Potion`     | The potion whose effects it gives, or null for a cloud that gives none; settable                                 |
| `float Radius`           | Its radius, in blocks; below half a block it disappears; settable                                                |
| `float RadiusOnUse`      | How much its radius changes each time it affects an entity; settable                                             |
| `float RadiusPerTick`    | How much its radius changes each tick after its wait; the game shrinks it to nothing over its duration; settable |
| `int ReapplicationDelay` | How long an entity it affected is left alone, in ticks; settable                                                 |
| `int WaitTime`           | How long it waits before it affects anyone, in ticks; settable                                                   |

`Minecart`: A minecart (`minecraft:minecart`), and the base of the chest, hopper and TNT minecarts.

| Member                        | What it is                                                                                                              |
|-------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `void Break(Entity? breaker)` | Breaks it: it drops what it leaves (its item, and what it holds) unless broken by a player in creative, then is removed |
| `float Damage`                | The damage it took lately; it heals by one each tick, and breaks above 40                                               |
| `int HurtDirection`           | Which way it shakes, 1 or -1: each hit turns it                                                                         |
| `int HurtTicks`               | The ticks it still shakes after a hit                                                                                   |
| `bool IsAtRest`               | Whether it lies at rest: it costs nothing until something pushes it or its rail changes                                 |

`ContainerMinecart`: A minecart that carries slots: players open it by using it, hoppers fill and empty it, and a
detector rail under it gives comparators how full it is.

| Member                           | What it is                                                                                   |
|----------------------------------|----------------------------------------------------------------------------------------------|
| `void CloseAll()`                | Closes it for every player who has it open                                                   |
| `MinecartInventory Inventory`    | Its slots                                                                                    |
| `bool Open(Player player)`       | Opens it to a player, as `InventoryOpenEvent` decides; the screen the player had open closes |
| `IReadOnlyList<Player> OpenedBy` | The players who have it open, in a new list each time                                        |

`ChestMinecart`: A minecart with a chest (`minecraft:chest_minecart`): 27 slots, opened as a chest.

| Member | What it is |
|--------|------------|

`HopperMinecart`: A minecart with a hopper (`minecraft:hopper_minecart`): 5 slots.

| Member                 | What it is                                       |
|------------------------|--------------------------------------------------|
| `bool IsEnabled`       | Whether it takes items; settable                 |
| `int TransferCooldown` | The ticks it rests before it takes an item again |

`TntMinecart`: a minecart with TNT (`minecraft:tnt_minecart`): a powered activator rail, flint and steel, fire, an
explosion or a break while it moves lights it.

| Member                  | What it is                                                                 |
|-------------------------|----------------------------------------------------------------------------|
| `void Explode()`        | Explodes it now, harder the faster it goes                                 |
| `int Fuse`              | The ticks until it explodes, or -1 while it is not lit                     |
| `bool Ignite(int fuse)` | Lights it, unless it is lit already                                        |
| `Entity? Igniter`       | Who lit it, responsible for the damage to its explosion, or null; settable |
| `bool IsLit`            | Whether it is lit                                                          |
