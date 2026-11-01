---
title: "Effects and potions"
description: "Orion server plugins: status effects and potions."
sidebar:
  order: 6
---

Status effects (speed, poison, regeneration…) are on every living entity, players included. A plugin gives and takes
effects, reads those an entity has, and reacts when one is given or ends. Potions are the bottles of the game that give
effects when drunk, splashed or shot on an arrow. The types are in `Orion.Sdk.Server.Effects` and
`Orion.Sdk.Server.Potions`.

## Give and take effects

```csharp
player.Effects.Add(EffectIds.Speed, duration: 20 * 30, amplifier: 1, showParticles: true);   // Speed II for 30 s
player.Effects.Add(EffectIds.NightVision, EntityEffect.Infinite, 0, false);                 // never ends
if (player.Effects.Has(EffectIds.Poison))
{
    player.Effects.Remove(EffectIds.Poison);
}

player.Effects.Cure();                                    // what milk cures
int removed = player.Effects.Clear();                     // every effect, as /effect clear
```

The duration is in ticks (20 a second), the amplifier 0 for level I. `Add` goes through `EntityEffectEvent`, which may
change or cancel it, and gives `false` when it did not apply; a stronger or longer effect of the same type replaces the
one an entity has (`EffectEndReason.Replaced`).
`EffectIds` (namespace `Bedrock.Identifiers`) has the effects of the game; effects of your own are custom content
([Custom content](../../platform/custom-content/)) and are given the same way, by identifier.

## Read the effects of an entity

```csharp
foreach (EntityEffect effect in player.Effects.All)
{
    player.SendMessage($"{effect.Id} {effect.Level}: {(effect.IsInfinite ? "forever" : effect.Duration / 20 + " s")}");
}

if (player.Effects.Find(EffectIds.Strength) is { } strength && strength.Amplifier >= 1)
{
    player.SendMessage("You are strong.");
}
```

`EntityEffect` is a value: `Id`, `Amplifier`, `Level` (the amplifier plus 1), `Duration` (ticks left), `ShowParticles`,
`IsInfinite`.

## Effect events

| Event                      | When                                                                                     | Writable                                                         |
|----------------------------|------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| `EntityEffectEvent`        | An entity is about to get an effect                                                      | `Amplifier`, `Duration`, `ShowParticles`, `IsImmune`; cancelable |
| `EntityEffectRemovedEvent` | An entity lost an effect (`Reason`: `Expired`, `Removed`, `Cleared`, `Died`, `Replaced`) | —                                                                |
| `PotionSplashEvent`        | A splash potion breaks                                                                   | `Radius`, `Potion`; cancelable                                   |
| `AreaEffectCloudEvent`     | The cloud of a lingering potion is about to give its effects to an entity                | `Potion`; cancelable                                             |

```csharp
[EventHandler]
public static void OnEffect(EntityEffectEvent e)
{
    if (e.Effect.Id == EffectIds.Invisibility && e.World.Name == "arena")
    {
        e.IsCanceled = true;                              // no invisibility in the arena
    }
    else if (e.Effect.Kind == EffectKind.Harmful)
    {
        e.Duration /= 2;                                  // bad effects last half as long
    }
}
```

## Effect types

`GameServer.Current.Effects` lists every effect of the server, those of the game and those of plugins:

```csharp
EffectType? speed = GameServer.Current.Effects.Find(EffectIds.Speed);
foreach (EffectType type in GameServer.Current.Effects.All.Where(t => t.Kind == EffectKind.Beneficial))
{
    Context.Logger.LogInformation("{Effect} instant: {Instant}", type.Id, type.IsInstant);
}
```

## Potions

`GameServer.Current.Potions` lists the potions: what each gives, and the items it comes as.

```csharp
PotionType? healing = GameServer.Current.Potions.Find(PotionIds.StrongHealing);
if (healing is not null)
{
    player.Inventory.Add(healing.CreateStack(PotionDelivery.Splash, 3));      // three splash potions of it
    int given = healing.Apply(player, PotionDelivery.Drink, potency: 1);       // its effects, as if drunk
}

PotionType? held = GameServer.Current.Potions.Of(player.Inventory.HeldItem);  // the potion a stack holds
```

| `PotionDelivery` | The effects last                                                       |
|------------------|------------------------------------------------------------------------|
| `Drink`          | Their full time                                                        |
| `Splash`         | Less, and instant ones act less, the farther the entity is (`potency`) |
| `Lingering`      | A quarter of their time, from the cloud                                |
| `Arrow`          | An eighth of their time, from a tipped arrow                           |

`PotionIds` (namespace `Bedrock.Identifiers`) has the potions of the game. An arrow or a thrown potion carries its
`Potion` ([Projectiles](../projectiles/)), and so does a cloud ([Kinds of entities](../entity-kinds/)).

## Reference

| Member of `LivingEntity` | What it is                       |
|--------------------------|----------------------------------|
| `EntityEffects Effects`  | The status effects of the entity |

`EntityEffects`: The status effects of a living entity.

| Member                                                                       | What it is                                                  |
|------------------------------------------------------------------------------|-------------------------------------------------------------|
| `bool Add(string effectId, int duration, int amplifier, bool showParticles)` | Gives the entity an effect, if `EntityEffectEvent` lets it  |
| `IReadOnlyList<EntityEffect> All`                                            | The effects the entity has, as values                       |
| `int Clear()`                                                                | Takes every effect away (Cleared), as /effect clear does    |
| `int Count`                                                                  | The number of effects                                       |
| `int Cure()`                                                                 | Takes away the effects milk cures (IsCurable), with Cleared |
| `EntityEffect? Find(string effectId)`                                        | An effect of the entity                                     |
| `bool Has(string effectId)`                                                  | Tells whether it has an effect                              |
| `bool Remove(string effectId)`                                               | Takes an effect away (Removed)                              |

`EntityEffect`: An effect an entity has, by value: the identifier of its type, its amplifier, the ticks it has left and
its particles.

| Member                              | What it is                                    |
|-------------------------------------|-----------------------------------------------|
| `bool IsInfinite`                   | Whether the effect never ends                 |
| `int Level`                         | The level of the effect: its amplifier plus 1 |
| `const int Infinite = int.MaxValue` | The duration of an effect that never ends     |

`EffectCatalog`: The status effects of a game: those of the game and the custom ones of the server.

| Member                          | What it is                                                 |
|---------------------------------|------------------------------------------------------------|
| `IReadOnlyList<EffectType> All` | Every effect                                               |
| `EffectType? Find(string id)`   | Finds an effect by its identifier, such as minecraft:speed |

`EffectType`: A type of status effect, such as speed or poison: what it does to the entity that has it.

| Member            | What it is                                                                    |
|-------------------|-------------------------------------------------------------------------------|
| `string Id`       | The identifier, such as minecraft:speed                                       |
| `bool IsCurable`  | Whether milk takes it away; /effect clear takes every effect                  |
| `bool IsCustom`   | Whether a plugin added it: clients show it only through the swirls it borrows |
| `bool IsInstant`  | Whether it acts once when given and is not kept, such as instant health       |
| `EffectKind Kind` | Whether it helps or hurts                                                     |

`EffectKind`: Whether an effect helps or hurts the entity that has it.

| Member           | What it is                              |
|------------------|-----------------------------------------|
| `Beneficial = 0` | It helps, such as speed or regeneration |
| `Harmful = 1`    | It hurts, such as poison or slowness    |
| `Neutral = 2`    | Neither, such as the omens              |

`EffectEndReason`: Why an entity lost an effect.

| Member         | What it is                                                                  |
|----------------|-----------------------------------------------------------------------------|
| `Expired = 0`  | Its time ran out                                                            |
| `Removed = 1`  | Code or a command took it away                                              |
| `Cleared = 2`  | The effects were cleared: those milk cures, or every one with /effect clear |
| `Died = 3`     | The entity died                                                             |
| `Replaced = 4` | A stronger or longer effect of the same type took its place                 |

`PotionCatalog`: The potions of a game, those of the game and the custom ones of the server, by identifier, by the
auxiliary value of the potion items of the game and by stack.

| Member                            | What it is                                                                                                                                                                                      |
|-----------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `IReadOnlyList<PotionType> All`   | Every potion                                                                                                                                                                                    |
| `PotionType? Find(string id)`     | Finds a potion by its identifier, such as minecraft:strong_healing                                                                                                                              |
| `PotionType? Of(ItemStack stack)` | Returns the potion a stack holds: that of a potion, a splash or lingering potion of the game by its auxiliary value, of a tipped arrow by its value minus one, or of an item of a custom potion |

`PotionType`: A potion, such as swiftness or strong healing: the effects it gives when drunk, splashed or shot on an
arrow, and the items it comes as.

| Member                                                                   | What it is                                                                                                                                                                                             |
|--------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `int Apply(LivingEntity target, PotionDelivery delivery, float potency)` | Gives the effects to an entity, as the game does for a delivery: whole when drunk, an eighth of their time from an arrow, a quarter from a cloud, and three quarters scaled by potency when splashed   |
| `uint Color`                                                             | The color of its splash and its cloud, as ARGB: for a custom potion, that of `Look`                                                                                                                    |
| `ItemStack CreateStack(PotionDelivery form, int count)`                  | Creates a stack of the item of a form: a potion, splash or lingering potion of the game with the auxiliary value of the potion (a tipped arrow, one more), or the item of that form of a custom potion |
| `int DataValue`                                                          | The data value of the potion in the game, or -1 for a custom one (it borrows the item of its look)                                                                                                     |
| `IReadOnlyList<EntityEffect> Effects`                                    | The effects the potion gives; their durations are those of a drink                                                                                                                                     |
| `bool Has(PotionDelivery form)`                                          | Tells whether the potion comes as an item of a form                                                                                                                                                    |
| `string Id`                                                              | The identifier, such as minecraft:swiftness                                                                                                                                                            |
| `bool IsCustom`                                                          | Whether the server added it                                                                                                                                                                            |
| `PotionType Look`                                                        | The potion of the game clients draw it as, thrown, in a cloud or on an arrow: itself, or the one a custom potion borrows the look of                                                                   |

`PotionDelivery`: How a potion reaches an entity, which decides how long its effects last.

| Member          | What it is                                                                                                                          |
|-----------------|-------------------------------------------------------------------------------------------------------------------------------------|
| `Drink = 0`     | Drunk: the effects last their full time                                                                                             |
| `Splash = 1`    | Splashed: the effects last less and the instant ones act less the farther the entity is from the splash (`Apply` takes the potency) |
| `Lingering = 2` | From the cloud of a lingering potion: the effects last a quarter of their time                                                      |
| `Arrow = 3`     | From a tipped arrow: the effects last an eighth of their time                                                                       |
