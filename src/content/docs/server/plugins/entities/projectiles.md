---
title: "Projectiles"
description: "Orion server plugins: shooting projectiles and handling their hits."
sidebar:
  order: 5
---

Arrows, snowballs, eggs, ender pearls, thrown potions and wind charges are projectiles: entities that fly and hit. A
plugin shoots them from any living entity, changes how hard they hit, and reacts when they land. The types are in
`Orion.Sdk.Server.Entities`.

## Shoot

`Shoot(projectileId, speed)` shoots from the eyes of a living entity, where it looks, and gives the projectile:

```csharp
Projectile snowball = player.Shoot(EntityIds.Snowball, 1.5f);          // blocks per tick
snowball.Damage = 2;                                                    // snowballs hurt nobody by default

if (player.Shoot(EntityIds.Arrow, 3) is Arrow arrow)
{
    arrow.IsCritical = true;
    arrow.CanBePickedUp = false;
    arrow.KnockbackLevel = 2;
}
```

The `Shooter` of a projectile is responsible for its damage (who gets the kill); set it to make a projectile shot by
code count for a player. A mob shoots its target with the goal `GoalFactory.RangedAttack`
([AI and goals](../ai-and-goals/)). How fast the projectiles of players fly in a world is a rule
(`world.Combat.Projectiles`, [World rules](../../worlds/world-rules/)).

| Class                                         | Projectile                                           | Its own members                                                      |
|-----------------------------------------------|------------------------------------------------------|----------------------------------------------------------------------|
| `Projectile`                                  | Any projectile                                       | `Shooter`, `Damage`, `KnockbackLevel`, `IsFlying`                    |
| `Arrow`                                       | An arrow: hurts by its speed, sticks in blocks       | `IsCritical`, `DamagePerSpeed`, `CanBePickedUp`, `Potion`, `IsStuck` |
| `ThrownPotion`                                | A splash or lingering potion, a bottle o' enchanting | `Potion`, `IsSplash`, `IsLingering`, `IsExperienceBottle`            |
| `Snowball`, `Egg`, `EnderPearl`, `WindCharge` | What their names say                                 | Those of `Projectile`                                                |

## Hits

`ProjectileHitEvent` comes when a projectile hits an entity or a block: `Target` (the entity, or `null`), `HitsBlock`
and `HitBlock`, `Face`, `Point`, `Shooter`. Cancel it and the projectile goes on as if it hit nothing.

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Entities;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public sealed partial class SnowballFight : ServerPlugin
{
    // In the arena, snowballs explode where they land, without breaking blocks.
    [EventHandler]
    public static void OnHit(ProjectileHitEvent e)
    {
        if (e.Projectile is Snowball && e.World.Name == "arena")
        {
            e.World.Explode(e.Point, 1.5f, ExplosionOptions.KeepBlocks, e.Shooter);
        }
    }

    // Arrows shot by players in the arena carry slowness.
    [EventHandler]
    public static void OnDamage(EntityDamageEvent e)
    {
        if (e.Cause == DamageCause.Projectile && e.Direct is Arrow && e.Entity is LivingEntity victim && e.World.Name == "arena")
        {
            victim.Effects.Add(EffectIds.Slowness, 60, 1, true);
        }
    }
}
```

The damage of a hit goes through `EntityDamageEvent` like any other ([Damage, healing and death](../damage/)): its `Cause` is
`Projectile`, `Direct` the projectile and `Attacker` its shooter. `PotionSplashEvent` comes when a splash potion breaks
(writable `Radius` and `Potion`), and `AreaEffectCloudEvent` when the cloud of a lingering potion is about to give its
effects to an entity ([Effects and potions](../effects/)). `ItemReleaseEvent` comes when a player lets go of a bow it was drawing.

## Reference

`Projectile`: An entity that flies and hits: an arrow, a snowball, an ender pearl.

| Member               | What it is                                                                         |
|----------------------|------------------------------------------------------------------------------------|
| `float Damage`       | The damage it deals to a living entity it hits: 0 for a snowball; settable         |
| `bool IsFlying`      | Whether it still flies; an arrow stuck in a block does not                         |
| `int KnockbackLevel` | The levels of knockback its hits add, as punch gives the arrows of a bow; settable |
| `Entity? Shooter`    | Who shot it, or null: it is responsible for the damage; settable                   |

`Arrow`: An arrow (`minecraft:arrow`): it hurts by its speed, more when critical, and sticks in the block it hits, where
a player picks it up if it was shot by a player in survival.

| Member                 | What it is                                                                                                                |
|------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `bool CanBePickedUp`   | Whether a player can pick it up once it sticks; arrows of creative players and mobs cannot; settable                      |
| `float DamagePerSpeed` | The damage per block per tick of speed: half a point more per level of power, as the arrows of a bow with power; settable |
| `bool IsCritical`      | Whether it hurts more: a fully drawn bow shoots critical arrows; settable                                                 |
| `bool IsStuck`         | Whether it is stuck in a block                                                                                            |
| `PotionType? Potion`   | The potion of a tipped arrow, which clients draw its particles in the color of, or null for a plain arrow; settable       |

`ThrownPotion`: A thrown splash or lingering potion, or a bottle o' enchanting: it breaks where it lands, in the color
of its potion.

| Member                    | What it is                                                                                               |
|---------------------------|----------------------------------------------------------------------------------------------------------|
| `bool IsExperienceBottle` | Whether it is a bottle o' enchanting, which leaves experience where it breaks                            |
| `bool IsLingering`        | Whether it is a lingering potion, which leaves a cloud where it breaks                                   |
| `bool IsSplash`           | Whether it is a splash potion, which gives its effects where it breaks                                   |
| `PotionType? Potion`      | The potion it holds, which clients draw it in the color of, or null for a bottle o' enchanting; settable |

`Snowball`: A thrown snowball (`minecraft:snowball`): it pushes what it hits without hurting it, except a blaze, which
takes 3.

| Member | What it is |
|--------|------------|

`Egg`: A thrown egg (`minecraft:egg`): where it breaks, a baby chicken hatches one time in eight, and four of them one
time in 32 of those.

| Member | What it is |
|--------|------------|

`EnderPearl`: A thrown ender pearl (`minecraft:ender_pearl`): where it lands, the player who threw it arrives, and takes
5 damage from the fall.

| Member | What it is |
|--------|------------|

`WindCharge`: A wind charge (`minecraft:wind_charge_projectile`, or the one of a breeze): it flies straight and bursts
where it hits, pushing everything around without breaking blocks; the entity it hits takes 1.

| Member | What it is |
|--------|------------|
