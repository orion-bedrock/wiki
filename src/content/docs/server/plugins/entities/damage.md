---
title: "Damage, healing and death"
description: "Orion server plugins: hurting, healing and killing, damage sources and the damage events."
sidebar:
  order: 7
---

Every `LivingEntity` (players and mobs) has health, can be hurt, healed and killed, and has armor that reduces damage.
A plugin hurts entities from code with a cause and an attacker, changes the damage of every hit, and decides what
happens when something dies. Health is in half hearts: a player has 20. The types are in `Orion.Sdk.Server.Entities`.

## Health

```csharp
player.Health = player.MaxHealth;                         // full health
player.Heal(4);                                           // two hearts, up to MaxHealth
player.MaxHealth = 40;                                    // twenty hearts
player.Absorption = 8;                                    // four golden hearts on top
player.IsInvulnerable = true;                             // nothing hurts it but the void and Kill
mob.Kill();
```

`IsDead` tells whether it died (a mob is removed after its death animation; a player waits to respawn), `LastAttacker`
and `LastDamage` what hurt it last, and `ArmorPoints` the armor of what it wears.

## Hurt an entity

```csharp
mob.Damage(6, DamageCause.Magic, attacker: null);                             // a cause, and maybe an attacker
mob.Damage(5, DamageSource.Attack(player));                                    // as if the player hit it
mob.Damage(3, DamageSource.Of(DamageCause.Fall));
mob.Damage(2, new DamageSource(DamageCause.Custom, player, null, origin: new Vector3(0, 64, 0)));   // pushed away from a point
```

Damage goes through `EntityDamageEvent` like a hit of the game: armor, enchantments and resistance count, other plugins
may change or cancel it, and `Damage` gives `false` when the entity was not hurt. `DamageSource.Projectile(projectile,
shooter)` is the source of a shot. The attacker is responsible for the
damage: it gets the kill. `DamageSource` is a record: `Cause`, `Attacker` (who is responsible), `Direct` (what hit: a
projectile, or the attacker itself) and `Origin` (where the push comes from).

`mob.Attack(target)` makes a mob hit a living entity in mêlée now, with its attack damage and what it holds.

## Change the damage of every hit

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Entities;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Players;

namespace Arena;

public sealed partial class ArenaCombat : ServerPlugin
{
    [EventHandler]
    public static void OnDamage(EntityDamageEvent e)
    {
        if (e.World.Name != "arena")
        {
            return;
        }

        switch (e.Cause)
        {
            case DamageCause.Fall:
                e.IsCanceled = true;                              // no fall damage in the arena
                break;
            case DamageCause.Attack when e.IsCritical:
                e.Amount *= 1.25f;                                // critical hits hurt more
                break;
            case DamageCause.Attack when e.Attacker is Player attacker && e.Entity is Player victim
                                         && attacker.Data.GetLong("arena:team", 0) == victim.Data.GetLong("arena:team", 0):
                e.IsCanceled = true;                              // no friendly fire
                break;
        }
    }

    [EventHandler]
    public static void OnAttack(PlayerAttackEntityEvent e) => e.KnockbackLevel += 1;   // players push harder
}
```

| Event                     | When                                       | Writable                                                                                                  |
|---------------------------|--------------------------------------------|-----------------------------------------------------------------------------------------------------------|
| `PlayerAttackEntityEvent` | A player hits an entity it reached         | `Damage`, `IsCritical`, `KnockbackLevel`, `HitDelayTicks`, `Knockback` (a `KnockbackProfile`); cancelable |
| `EntityDamageEvent`       | An entity is about to be hurt, by anything | `Amount`, `Knockback`, `NoDamageTicks`; cancelable                                                        |
| `EntityDeathEvent`        | An entity is about to die                  | `ShowsMessage`, `Experience`; cancelable                                                                  |
| `PlayerRespawnEvent`      | A dead player respawns                     | `Position`; cancelable                                                                                    |

`EntityDamageEvent` carries the `Cause`, the `Attacker` and the `Direct` entity (the projectile, for a shot), the
`RawAmount` before armor and `Amount` after. After a hit, an entity is immune for `NoDamageTicks`: only
a stronger hit hurts it, by the difference. The delay between hits and the knockback of a world are rules of the world
([World rules](../../worlds/world-rules/)).

## Death

```csharp
[EventHandler]
public static void OnDeath(EntityDeathEvent e)
{
    if (e.Entity is Player victim && e.World.Name == "arena")
    {
        e.ShowsMessage = false;                                   // no death message in the chat
        e.Experience = 0;
        if (e.Attacker is Player killer)
        {
            foreach (Player player in e.World.Players)
            {
                player.SendMessage($"{killer.Name} eliminated {victim.Name}");
            }
        }
    }
}

[EventHandler]
public static void OnRespawn(PlayerRespawnEvent e)
{
    if (e.World.Name == "arena")
    {
        e.Position = new Vector3(0.5f, 70, 0.5f);                  // back to the middle of the arena
    }
}
```

`player.Respawn()` brings a dead player back at once. Whether a player keeps its items is the game rule
`keepinventory` ([World rules](../../worlds/world-rules/)).

## Reference

`LivingEntity` (abstract): an entity that lives: a mob or a player.

| Member                                                           | What it is                                                                                                  |
|------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `float Absorption`                                               | The extra health that damage takes before Health, the yellow hearts of absorption, in half hearts; settable |
| `int ArmorPoints`                                                | The armor points of what it wears (each is half a chestplate icon), which reduce most damage                |
| `bool Damage(float amount, DamageCause cause, Entity? attacker)` | Hurts the entity, if `EntityDamageEvent` lets it                                                            |
| `bool Damage(float amount, DamageSource source)`                 | Damages the entity from a source, as `EntityDamageEvent` decides: armor, enchantments and resistance count  |
| `EntityEffects Effects`                                          | Its status effects                                                                                          |
| `ItemStack GetEquipment(EquipmentSlot slot)`                     | What it holds or wears in a slot; empty when it has nothing there or cannot hold anything                   |
| `void Heal(float amount)`                                        | Gives it health back, up to MaxHealth; the dead do not heal                                                 |
| `float Health`                                                   | Its health, in half hearts; setting 0 kills it; settable                                                    |
| `bool IsDead`                                                    | Whether it died: a mob is removed after its death animation, a player waits to respawn                      |
| `bool IsInvulnerable`                                            | Whether nothing hurts it but the void and Kill; settable                                                    |
| `void Kill()`                                                    | Kills the entity                                                                                            |
| `Entity? LastAttacker`                                           | The entity that hurt it last, or null                                                                       |
| `float LastDamage`                                               | The damage to the last hit, before armor: a hit while immune must be stronger                               |
| `long LastHurtTick`                                              | The tick of its world it was last hurt on, or -1 when it never was                                          |
| `float MaxHealth`                                                | The most health it can have; lowering it lowers Health too; settable                                        |
| `int NoDamageTicks`                                              | The ticks it stays immune after a hit; only a stronger hit hurts it, by the difference; settable            |
| `Projectile Shoot(string projectileId, float speed)`             | Shoots a projectile from the eyes of the entity, where it looks                                             |

`DamageSource`: Where damage comes from: its cause, the entity responsible, the entity that hit (a projectile; the
attacker itself otherwise) and where the push comes from.

| Member                                                                               | What it is                                                              |
|--------------------------------------------------------------------------------------|-------------------------------------------------------------------------|
| `static DamageSource Attack(Entity attacker)`                                        | The source of an attack: the entity hits with its hand or weapon        |
| `Entity? Attacker`                                                                   | The entity responsible for the damage, or `null`                        |
| `DamageCause Cause`                                                                  | What hurts                                                              |
| `DamageSource(DamageCause cause, Entity? attacker, Entity? direct, Vector3? origin)` | A new `DamageSource`                                                    |
| `Entity? Direct`                                                                     | The entity that hit: a projectile, or the attacker itself               |
| `static DamageSource Of(DamageCause cause)`                                          | A source of a cause with no entity responsible, such as a fall or magic |
| `Vector3? Origin`                                                                    | Where the push comes from, or `null`                                    |
| `static DamageSource Projectile(Entity projectile, Entity? shooter)`                 | The source of a projectile and who shot it                              |

`DamageCause`: What hurts an entity.

| Member             | What it is                                                                |
|--------------------|---------------------------------------------------------------------------|
| `Attack = 0`       | Another entity hit                                                        |
| `Projectile = 1`   | A projectile hit it                                                       |
| `Fall = 2`         | It fell                                                                   |
| `Void = 3`         | It is below the world                                                     |
| `Fire = 4`         | It burns                                                                  |
| `Lava = 5`         | It is in lava                                                             |
| `Drowning = 6`     | It ran out of air                                                         |
| `Suffocation = 7`  | It is inside a block                                                      |
| `Starvation = 8`   | It is starving                                                            |
| `Contact = 9`      | It touches a cactus or a berry bush                                       |
| `Explosion = 10`   | An explosion                                                              |
| `Magic = 11`       | Magic, such as a potion of harming                                        |
| `Poison = 12`      | The poison effect                                                         |
| `Wither = 13`      | The wither effect                                                         |
| `Kill = 14`        | A command or plugin killed it at once                                     |
| `Custom = 15`      | A plugin hurt it                                                          |
| `Lightning = 16`   | A lightning bolt struck it                                                |
| `WorldBorder = 17` | It stayed outside the world border                                        |
| `InFire = 18`      | It stands in fire, such as a fire block; Fire is the burning that follows |
| `Thorns = 19`      | It hit armor with thorns                                                  |
