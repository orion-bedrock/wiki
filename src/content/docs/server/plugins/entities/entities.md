---
title: "Entities"
description: "Orion server plugins: spawning, finding and changing entities; riding, visibility, data and properties."
sidebar:
  order: 1
---

Everything that lives in a world and moves is an entity: players, mobs, items on the ground, arrows, minecarts. A
plugin spawns entities, finds them, moves and pushes them, names them, hides them from some players, seats them on
each other and keeps data on them. The types are in `Orion.Sdk.Server.Entities`.

## The classes of entities

`Entity` is the base of every entity; each kind adds its own members:

| Class                            | Derives from   | What it is                                                       | Page                                             |
|----------------------------------|----------------|------------------------------------------------------------------|--------------------------------------------------|
| `Entity`                         | —              | Any entity: position, motion, name tag, visibility, riding, data | This page                                        |
| `LivingEntity`                   | `Entity`       | What lives: health, effects, damage, equipment                   | [Damage, healing and death](../damage/), [Effects and potions](../effects/) |
| `Player`                         | `LivingEntity` | A player                                                         | [Players](../../players/players/)                         |
| `Mob`                            | `LivingEntity` | A mob of the game or of a plugin: goals, target, navigation      | [AI and goals](../ai-and-goals/)               |
| `HumanNpc`                       | `Mob`          | A mob that looks like a player                                   | [NPCs](../npcs/)                               |
| `Projectile`                     | `Entity`       | Arrows, snowballs, ender pearls, thrown potions…                 | [Projectiles](../projectiles/)                 |
| `ItemEntity`, `Tnt`, `Minecart`… | `Entity`       | Items on the ground, lit TNT, minecarts, orbs, clouds, lightning | [Kinds of entities](../entity-kinds/)               |

An entity the SDK gives you (from an event, a search, a spawn) is always an object of its most precise class, so plain
C# tells its kind: `if (e.Entity is Player player)`, `entities.OfType<Mob>()`. Two objects of the same entity are equal
(`==`) whatever their class.

## Spawn an entity

```csharp
Entity zombie = world.Entities.Spawn(EntityIds.Zombie, new Vector3(0.5f, 64, 0.5f), EntitySpawnMode.None, yaw: 0, pitch: 0);
var guard = (Mob)world.Entities.Spawn(EntityIds.IronGolem, world.Spawn, EntitySpawnMode.Persistent, 180, 0);
Entity statue = world.Entities.Spawn(EntityIds.ArmorStand, new Vector3(5, 64, 5), EntitySpawnOptions.Npc with { Yaw = 90 });
```

| `EntitySpawnMode` | The entity                                 |
|-------------------|--------------------------------------------|
| `None`            | Spawns as the game spawns it               |
| `Persistent`      | Is saved with its chunk and never despawns |
| `Static`          | Never moves by itself: no gravity, no push |
| `Invulnerable`    | Takes no damage                            |
| `Npc`             | `Static` and `Invulnerable`                |

The modes are flags (`EntitySpawnMode.Persistent | EntitySpawnMode.Npc`). `EntitySpawnOptions` is the same as a record
(`Default`, `Npc`, changed with `with { IsPersistent = true, Yaw = 90 }`). An identifier the server does not know throws
`PluginException`; `EntityIds` (namespace `Bedrock.Identifiers`) has those of the game, and mobs of your own are custom
content ([Custom content](../../platform/custom-content/)). `EntitySpawnedEvent` comes for every entity that comes into a world,
spawned or loaded with its chunk (`Cause`).

## Find entities

```csharp
IReadOnlyList<Entity> near = world.Entities.InRadius(player.Position, 10);
IReadOnlyList<Entity> inBox = world.Entities.InBox(new Vector3(-10, 60, -10), new Vector3(10, 80, 10));
Entity? closestZombie = world.Entities.Nearest(player.Position, 32, EntityIds.Zombie);   // null: any kind
Entity? byId = world.Entities.Find("4f1a7c2e-9b3d-4e8f-a6c5-1d2b3e4f5a6b");
foreach (Mob mob in world.Entities.All.OfType<Mob>().ToList())                            // copy it to change the world
{
    mob.Remove();
}
```

`world.Entities` holds every entity of the world but players (`world.Players`). `All` changes as entities spawn and are
removed, so copy it (`ToList()`) before removing or spawning while you go through it.

## Move and push

```csharp
entity.Teleport(new Vector3(0.5f, 70, 0.5f));                     // keeping where it looks
entity.TeleportLooking(new Vector3(0.5f, 70, 0.5f), 0, 90);        // pitch, yaw
entity.LookAt(player.EyePosition);
entity.Launch(new Vector3(0, 1.2f, 0));                            // a launch pad: the velocity becomes this one
entity.Velocity = new Vector3(entity.Velocity.X, 0.8f, entity.Velocity.Z);   // keep the horizontal momentum
entity.HasGravity = false;
entity.Scale = 2;                                                   // twice as big; its box grows with it
```

`Position` is the middle of its feet, `EyePosition` where it looks from, `LookDirection` the direction it looks (with
`EyePosition`, the ray of what it sees). `Yaw` is where its body faces (0 south, 90 west), `Pitch` up or down (-90 up),
`HeadYaw` where its head turns. `Velocity` is in blocks per tick. `IsStatic` keeps the world from moving it at all.

## Name tags and visibility

```csharp
entity.NameTag = Text.Lang("arena::shopkeeper");                   // in the language of each player
entity.NameTagVisibility = NameTagVisibility.Always;               // Hidden, WhenLooking or Always
entity.InteractText = "Trade";                                     // the button players on touch screens see
entity.HideFrom(player);                                           // this player stops seeing it
entity.ShowTo(player);
bool visible = entity.IsVisibleTo(player);
entity.IsInvisible = true;                                         // everyone sees through it
```

`HideFrom` lasts until `ShowTo` or until the player leaves the world; `Viewers` are the players who see the entity now.

## Riding

```csharp
Entity boat = world.Entities.Spawn(EntityIds.Minecart, player.Position, EntitySpawnMode.None, 0, 0);
if (player.Ride(boat))
{
    player.SendMessage("All aboard!");
}

entity.Dismount();                                                 // gets off its vehicle
boat.EjectPassengers();                                            // everyone gets off
```

`Vehicle` is what an entity rides and `Passengers` what rides it, the one that steers first; `MaxPassengers` how many
fit. `EntityRideEvent` and `EntityDismountEvent` come first and may cancel.

## Data on an entity

`entity.Data` keeps typed values of your plugin by key, saved with the entity when it is persistent:

```csharp
mob.Data.SetLong("arena:team", 2);
mob.Data.SetText("arena:owner", player.Uuid);
long team = mob.Data.GetLong("arena:team", fallback: 0);
string? owner = mob.Data.GetText("arena:owner");
if (mob.Data.Has("arena:owner"))
{
    mob.Data.Remove("arena:owner");
}
```

Put the id of your plugin in front of your keys: every plugin shares the data of an entity. See
[Keeping data](../../platform/persistence/).

## Properties, appearance and animations

```csharp
entity.Properties.SetBool("minecraft:has_nectar", true);        // a property of its type (a bee), read by its resource pack
entity.Appearance.IsBaby = true;                                 // the variant, markings, skin, colors its model draws
entity.Appearance.Variant = 2;
entity.PlayGesture(EntityGesture.SwingArm);                      // SwingArm, CriticalHit, MagicCriticalHit, Hurt, TotemUse
entity.PlayAnimation("animation.armor_stand.wiggle");
entity.PlayAnimation(EntityAnimation.Of("animation.zombie.attack") with { BlendOutTime = 0.2f });
entity.AnimateFor(EntityAnimation.Of("animation.player.wave"), player);   // for one player only
```

The names of properties and animations are those of the resource pack of the entity (the game's, or a pack of your
plugin). A property the type does not have throws `PluginException`.

## Fire

```csharp
entity.Fire.Ignite(100);                                         // burns for at least 5 seconds
entity.Fire.Extinguish();
entity.Fire.IsImmune = true;                                     // fire and lava never hurt it
```

## Remove an entity

`entity.Remove()` removes it from its world at the end of the tick; `IsRemoved` is then `true`, and it changes nothing
any more. `EntityRemovedEvent` comes for every entity that leaves a world (`Reason`: `Removed`, `Died` or `Unloaded`).
An entity that is not persistent (`IsPersistent`) disappears when its chunk unloads.

## Reference

`Entity`: Something that lives in a world and players see: a mob, an NPC, another player.

| Member                                                           | What it is                                                                                                                                                       |
|------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `long Age`                                                       | The ticks since it spawned                                                                                                                                       |
| `void Animate(EntityAnimation animation)`                        | Plays an animation of the resource pack on the entity, for every player who sees it                                                                              |
| `void AnimateFor(EntityAnimation animation, Player viewer)`      | Plays an animation of the resource pack on the entity, for one player                                                                                            |
| `EntityAppearance Appearance`                                    | What its model draws: variant, markings, skin, colors and whether it is a baby                                                                                   |
| `Vector3 BoxMax`                                                 | The corner of the box of the entity with the highest coordinates                                                                                                 |
| `Vector3 BoxMin`                                                 | The corner of the box of the entity with the lowest coordinates                                                                                                  |
| `EntityData Data`                                                | The data plugins keep on the entity, saved with it when it is persistent                                                                                         |
| `bool Dismount()`                                                | Takes it off its vehicle, if `EntityDismountEvent` lets it: it is put where the vehicle says                                                                     |
| `void EjectPassengers()`                                         | Takes off everything that rides it, each as Dismount does                                                                                                        |
| `Vector3 EyePosition`                                            | Where its eyes are: what it looks from, and what others look at                                                                                                  |
| `float FallDistance`                                             | The height it fell since it last stood on the ground, in blocks                                                                                                  |
| `EntityFire Fire`                                                | Its fire: whether and how long it burns, and whether fire hurts it                                                                                               |
| `bool HasGravity`                                                | Whether gravity pulls it down when it has Physics; settable                                                                                                      |
| `float HeadYaw`                                                  | Where its head looks, in degrees                                                                                                                                 |
| `float Height`                                                   | The height of its box, in blocks: the height of its type times its scale                                                                                         |
| `void HideFrom(Player player)`                                   | Hides it from a player until ShowTo or until the player leaves the world: the player stops seeing it at the end of the tick                                      |
| `Text? InteractText`                                             | The text of the button players use it with on touch screens, in the language of each player, or null for none; settable                                          |
| `bool IsInvisible`                                               | Whether players see through it (its name tag too); settable                                                                                                      |
| `bool IsPersistent`                                              | Whether it is saved with its chunk and comes back when the chunk loads again; one that is not disappears when its chunk unloads; settable                        |
| `bool IsRemoved`                                                 | Whether it was removed from its world; it changes nothing anymore                                                                                                |
| `bool IsStatic`                                                  | Whether the world never moves it: no gravity and no push; settable                                                                                               |
| `bool IsVisibleTo(Player player)`                                | Tells whether it is not hidden from a player; the player sees it when its chunk is in its view                                                                   |
| `void Launch(Vector3 velocity)`                                  | Pushes it, as a launch pad or a hit does: its velocity becomes this one (add to Velocity to keep its momentum)                                                   |
| `void LookAt(Vector3 point)`                                     | Turns its head and body towards a point                                                                                                                          |
| `Vector3 LookDirection`                                          | The direction the entity looks at, from its pitch and yaw: with its eyes, the ray of what it looks at                                                            |
| `int MaxPassengers`                                              | How many can ride it at once: 1 unless its class says otherwise; 0 lets nothing ride it                                                                          |
| `Text? NameTag`                                                  | Its name tag, shown in the language of each player, or null for none (a player shows its name); settable                                                         |
| `NameTagVisibility NameTagVisibility`                            | When its name tag shows; settable                                                                                                                                |
| `bool OnGround`                                                  | Whether it stands on the ground                                                                                                                                  |
| `IReadOnlyList<Entity> Passengers`                               | What rides it, the one that steers first                                                                                                                         |
| `float Pitch`                                                    | Where it looks up or down, in degrees (-90 up, 90 down)                                                                                                          |
| `void PlayAnimation(string name)`                                | Plays an animation by the short name its resource pack gives it (such as `roar` for `animation.dragon.roar`), or by its identifier, for every player who sees it |
| `void PlayAnimation(EntityAnimation animation)`                  | Plays an animation of the resource pack on the entity, for every player who sees it                                                                              |
| `void PlayGesture(EntityGesture gesture)`                        | Shows a gesture of the game at once, for every player who sees it (and itself, for a player)                                                                     |
| `Vector3 Position`                                               | Its position: the middle of its feet                                                                                                                             |
| `EntityProperties Properties`                                    | The values of the properties of its type (Properties), which its resource pack reads with query.property: Properties.Set("bedrock:phase", 2)                     |
| `void Remove()`                                                  | Removes it from its world: the players who see it stop seeing it at the end of the tick                                                                          |
| `bool Ride(Entity vehicle)`                                      | Seats it on a vehicle, if `EntityRideEvent` lets it: it follows the vehicle (its physics stop) until it gets off, and the players who see both see it ride       |
| `float Scale`                                                    | Its scale: 1 is the size of its type; its box grows with it; settable                                                                                            |
| `void ShowTo(Player player)`                                     | Lets a player see it again when its chunk is in the view of the player                                                                                           |
| `bool Teleport(Vector3 position)`                                | Moves it at once to a position, keeping where it looks                                                                                                           |
| `bool TeleportLooking(Vector3 position, float pitch, float yaw)` | Moves and turns the entity within its world                                                                                                                      |
| `EntityType Type`                                                | Its type                                                                                                                                                         |
| `long UniqueId`                                                  | The unique ID of the entity, which the scores of a scoreboard name it by                                                                                         |
| `string Uuid`                                                    | The UUID of the entity, as text                                                                                                                                  |
| `string? VariantId`                                              | The identifier of the variant the entity was spawned as, such as minecraft:husk, or null                                                                         |
| `Entity? Vehicle`                                                | What it rides, or null                                                                                                                                           |
| `Vector3 Velocity`                                               | Its velocity, in blocks per tick; settable                                                                                                                       |
| `IReadOnlyList<Player> Viewers`                                  | The players who see it now; the set changes at the end of each tick                                                                                              |
| `float Width`                                                    | The width of its box, in blocks: the width of its type times its scale                                                                                           |
| `World? World`                                                   | The world it is in, or null                                                                                                                                      |
| `float Yaw`                                                      | Where its body looks, in degrees (0 south, 90 west)                                                                                                              |

`LivingEntity`: An entity that lives: a mob or a player.

| Member                                                           | What it is                                                                                                  |
|------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `float Absorption`                                               | The extra health that damage takes before Health, the yellow hearts of absorption, in half hearts; settable |
| `int ArmorPoints`                                                | The armor points of what it wears (each is half a chestplate icon), which reduce most damage                |
| `bool Damage(float amount, DamageCause cause, Entity? attacker)` | Hurts the entity, if `EntityDamageEvent` lets it                                                            |
| `bool Damage(float amount, DamageSource source)`                 | Damages the entity from a source, as EntityDamageEvent decides: armor, enchantments and resistance count    |
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

`WorldEntities`: The entities of a world that are not players: spawning them, finding them, and showing them to the
players whose view has their chunk.

| Member                                                                                            | What it is                                                                                                                              |
|---------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `IReadOnlyList<Entity> All`                                                                       | The entities; the list changes as they spawn and are removed, so copy it to change them while going through it                          |
| `int Count`                                                                                       | The number of entities                                                                                                                  |
| `void DropExperience(Vector3 position, int points)`                                               | Drops experience as orbs, split as the game splits it (2477, 1237, 617… 7, 3 and 1 points each), with the small random jump of the game |
| `Entity? Find(string uuid)`                                                                       | Finds an entity of the world by its UUID                                                                                                |
| `IReadOnlyList<Entity> InBox(Vector3 min, Vector3 max)`                                           | The entities whose boxes touch a box                                                                                                    |
| `IReadOnlyList<Entity> InRadius(Vector3 center, float radius)`                                    | The entities within a distance of a point                                                                                               |
| `Entity? Nearest(Vector3 point, float range, string? kind)`                                       | The nearest entity of a kind within a distance of a point                                                                               |
| `Entity Spawn(string id, Vector3 position, EntitySpawnMode flags, float yaw, float pitch)`        | Spawns an entity by the identifier of its type                                                                                          |
| `Entity Spawn(string id, Vector3 position, EntitySpawnOptions options)`                           | Spawns an entity with options: persistence, physics, invulnerability and rotation                                                       |
| `HumanNpc SpawnHuman(Skin skin, Vector3 position, EntitySpawnMode flags, float yaw, float pitch)` | Spawns a human NPC with a skin                                                                                                          |

`EntitySpawnMode` (flags): how an entity spawned by a plugin starts.

| Member             | What it is                                    |
|--------------------|-----------------------------------------------|
| `None = 0`         | As the game spawns it                         |
| `Persistent = 1`   | Saved with its chunk and never despawned      |
| `Static = 2`       | Never moves by itself: no gravity, no pushing |
| `Invulnerable = 4` | Takes no damage                               |
| `Npc = 6`          | Static and invulnerable, as an NPC            |

`EntitySpawnOptions`: How an entity spawns: whether it is saved and whether it moves, and where it looks.

| Member                              | What it is                                                                                                              |
|-------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `static EntitySpawnOptions Default` | The options of an entity that spawns as the game would: not saved, moving, looking south                                |
| `bool IsInvulnerable`               | Whether it takes no damage                                                                                              |
| `bool IsPersistent`                 | Whether it is saved with its chunk                                                                                      |
| `bool IsStatic`                     | Whether the world never moves it                                                                                        |
| `static EntitySpawnOptions Npc`     | The options of an NPC: an entity that is never moved by the world (no gravity, no push), is never hurt and is not saved |
| `float Pitch`                       | Where it looks up or down, in degrees                                                                                   |
| `float Yaw`                         | Where it faces, in degrees (0 south, 90 west)                                                                           |

`EntityData`: the data plugins keep on an entity, typed values by key, saved with a persistent entity.

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

`EntityProperties`: The values of the properties of an entity (`Properties`), which its resource pack reads with
query.property: dragon.Properties.Set("bedrock:phase", 2).

| Member                                    | What it is                                |
|-------------------------------------------|-------------------------------------------|
| `int Count`                               | The number of properties                  |
| `bool GetBool(string name)`               | The value of a bool property              |
| `string GetEnum(string name)`             | The value of an enum property             |
| `float GetFloat(string name)`             | The value of a float property             |
| `int GetInt(string name)`                 | The value of an int property              |
| `void SetBool(string name, bool value)`   | Sets a property that is on or off         |
| `void SetEnum(string name, string value)` | Sets a property that is one of its values |
| `void SetFloat(string name, float value)` | Sets a decimal property                   |
| `void SetInt(string name, int value)`     | Sets a whole number property              |

`EntityFire`: The fire of an entity (`entity.Fire`): while it burns, a living entity loses one point of health every
second.

| Member                   | What it is                                                                                                                             |
|--------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `void Extinguish()`      | Puts it out                                                                                                                            |
| `bool Ignite(int ticks)` | Sets it alight for at least the ticks given: one burning longer keeps the longer time                                                  |
| `bool IsBurning`         | Whether it burns                                                                                                                       |
| `bool IsImmune`          | Whether fire and lava do not hurt it, and it never burns: those of the game that live in fire (blazes, striders…) unless set; settable |
| `int Ticks`              | The ticks it still burns for; 0 when it does not burn                                                                                  |

`EntityAppearance`: What an entity looks like beyond its type: the variant, markings, skin and colors its model draws,
and whether it is a baby.

| Member            | What it is                                                                               |
|-------------------|------------------------------------------------------------------------------------------|
| `byte Color`      | The main color, such as the wool of a sheep (a dye color from 0 to 15); settable         |
| `byte Color2`     | The second color, such as the pattern of a tropical fish; settable                       |
| `bool IsBaby`     | Whether it is drawn as a baby; settable                                                  |
| `int MarkVariant` | The second variant, such as the markings of a horse; settable                            |
| `int SkinId`      | The skin variant of models that have several, such as the biome of a villager; settable  |
| `int Variant`     | The variant of the model, such as the color of a horse or the type of villager; settable |

`EntityAnimation`: An animation of the resource pack an entity plays: its name, the state its controller goes to next,
the Molang expression that stops it (and its version), the controller and how long it blends out, in seconds.

| Member                                                                                                                                    | What it is                                                                                                                             |
|-------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------|
| `float BlendOutTime`                                                                                                                      | How long it blends out, in seconds                                                                                                     |
| `string Controller`                                                                                                                       | The animation controller it plays with                                                                                                 |
| `EntityAnimation(string name, string nextState, string stopExpression, int stopExpressionVersion, string controller, float blendOutTime)` | A new `EntityAnimation`                                                                                                                |
| `string Name`                                                                                                                             | The name of the animation                                                                                                              |
| `string NextState`                                                                                                                        | The state its controller goes to next                                                                                                  |
| `static EntityAnimation Of(string name)`                                                                                                  | An animation of the resource pack with the defaults of the server: back to the default state once it ends, with the runtime controller |
| `string StopExpression`                                                                                                                   | The Molang expression that stops it                                                                                                    |
| `int StopExpressionVersion`                                                                                                               | The version of that expression                                                                                                         |

`EntityGesture`: A gesture of the game that any entity shows, with PlayGesture.

| Member                 | What it is                                                     |
|------------------------|----------------------------------------------------------------|
| `SwingArm = 0`         | It swings its arm, as when it hits                             |
| `CriticalHit = 1`      | The particles of a critical hit around it                      |
| `MagicCriticalHit = 2` | The particles of an enchanted critical hit around it           |
| `Hurt = 3`             | It flashes red and plays its hurt sound, without losing health |
| `TotemUse = 4`         | The animation of a totem of undying saving it                  |

`NameTagVisibility`: When the name tag of an entity shows.

| Member            | What it is                                  |
|-------------------|---------------------------------------------|
| `Hidden = 0`      | Never                                       |
| `WhenLooking = 1` | When a player looks at the entity from near |
| `Always = 2`      | Always, through walls, as above players     |

`EntitySpawnCause` (the `Cause` of `EntitySpawnedEvent`): how an entity came into a world.

| Member        | What it is                                                                         |
|---------------|------------------------------------------------------------------------------------|
| `Spawned = 0` | It spawned: by code, by the game (a thrown snowball, a dropped item), by a command |
| `Loaded = 1`  | It was saved, and its chunk loaded                                                 |

`EntityRemoveReason` (the `Reason` of `EntityRemovedEvent`): why an entity left a world.

| Member         | What it is                                                                      |
|----------------|---------------------------------------------------------------------------------|
| `Removed = 0`  | It was removed: by code, by the game (a projectile that hit, an item picked up) |
| `Died = 1`     | It died, and its death animation ended                                          |
| `Unloaded = 2` | Its chunk unloaded; a persistent entity comes back with it                      |

`EntityRideCause` (the `Cause` of `EntityRideEvent`): Why an entity gets on a vehicle.

| Member         | What it is                                                          |
|----------------|---------------------------------------------------------------------|
| `Plugin = 0`   | Code seated it with `Ride`                                          |
| `Interact = 1` | A player used the vehicle (right click, or a tap)                   |
| `Pickup = 2`   | The vehicle picked it up as it went by, as a minecart picks up mobs |

`EntityDismountCause` (the `Cause` of `EntityDismountEvent`): Why an entity gets off its vehicle.

| Member        | What it is                                                               |
|---------------|--------------------------------------------------------------------------|
| `Plugin = 0`  | Code took it off with `Dismount` or `EjectPassengers`                    |
| `Player = 1`  | A player got off: it sneaked, or pressed the button to leave             |
| `Ejected = 2` | The vehicle threw it off, as a minecart on a powered activator rail does |

`EquipmentSlot`: Where a living entity holds or wears an item.

| Member         | What it is                                                  |
|----------------|-------------------------------------------------------------|
| `MainHand = 0` | The hand it hits with: the selected hotbar slot of a player |
| `OffHand = 1`  | The other hand                                              |
| `Head = 2`     | The head                                                    |
| `Chest = 3`    | The chest                                                   |
| `Legs = 4`     | The legs                                                    |
| `Feet = 5`     | The feet                                                    |
