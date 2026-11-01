---
title: "World rules"
description: "Orion server plugins: game rules, difficulty, combat, explosions, experience, enchanting, redstone and crafting."
sidebar:
  order: 2
---

Each world has its own rules: the game rules of Minecraft and the difficulty, and the rules of Orion for combat,
explosions, experience, enchanting, redstone, crafting, time and weather. An arena can have fast PvP and TNT that breaks
nothing while the lobby next to it keeps the game as it is. Players see changes at once.

## Game rules and difficulty

```csharp
world.Rules.SetBool("pvp", false);
world.Rules.SetBool("keepinventory", true);
world.Rules.SetInt("randomtickspeed", 0);
bool mobs = world.Rules.GetBool("domobspawning");
world.Rules.Difficulty = Difficulty.Hard;
```

Rule names are those of the game, in any case: `commandblockoutput`, `dodaylightcycle`, `doentitydrops`, `dofiretick`,
`doimmediaterespawn`, `doinsomnia`, `domobloot`, `domobspawning`, `dotiledrops`, `doweathercycle`, `drowningdamage`,
`falldamage`, `firedamage`, `freezedamage`, `keepinventory`, `locatorbar`, `mobgriefing`, `naturalregeneration`,
`playerssleepingpercentage`, `pvp`, `randomtickspeed`, `recipesunlock`, `sendcommandfeedback`, `showcoordinates`,
`showdaysplayed`, `showdeathmessages`, `showtags`, `spawnradius`, `tntexplodes`. A name the server does not know, or a
value of the wrong kind, throws `PluginException`. `GameRuleChangedEvent` and `DifficultyChangedEvent` come when code or
a command changes them. New worlds take rules from the start with `WithBoolRule` and `WithIntRule`
([Worlds](../worlds/)).

## The rules of Orion as records

The other rules are records: values you read from the world, change with `with`, and set back whole. Orion checks every
field of what you set and throws `PluginException` with the reason when a value is out of range. Presets give the
values of the game and others ready to use.

```csharp
world.Combat = CombatRules.Competitive;                                           // a preset
world.Combat = world.Combat with { HitDelayTicks = 4, Knockback = KnockbackProfile.Competitive };
world.Explosions = world.Explosions with { Tnt = world.Explosions.Tnt with { FuseTicks = 40, BreaksBlocks = false } };
world.Experience = world.Experience with { MobDeath = false };
world.Enchanting = EnchantingRules.Disabled;
world.Redstone.Rules = world.Redstone.Rules with { Except = new HashSet<string> { BlockIds.Observer } };
world.Features = world.Features with { Time = false, Weather = false };
```

| Property of `World` | Record            | What it rules                                                                            |
|---------------------|-------------------|------------------------------------------------------------------------------------------|
| `Combat`            | `CombatRules`     | The delay between hits, knockback, critical hits, reach, projectile speeds               |
| `Explosions`        | `ExplosionRules`  | TNT and the shaking of cameras                                                           |
| `Experience`        | `ExperienceRules` | Which sources give experience                                                            |
| `Enchanting`        | `EnchantingRules` | Whether enchantments work, and the enchanting table, anvil and grindstone                |
| `Redstone.Rules`    | `RedstoneRules`   | Which families of redstone work, their timings, pistons, dispensers, minecarts and sculk |
| `Features`          | `WorldFeatures`   | Whether time and weather run in this world (`null`: as the server says)                  |

Every world starts with the defaults of the server (`bedrock.json`). These records are not saved with the world: set
them again when the world loads (`WorldLoadedEvent`), as in the example below. Game rules and the difficulty are saved
with the world.

### Combat

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Rules;

namespace Arena;

public sealed partial class PvpPlugin : ServerPlugin
{
    [EventHandler]
    public static void OnWorld(WorldLoadedEvent e)
    {
        if (e.World.Name.StartsWith("duel-", StringComparison.Ordinal))
        {
            e.World.Combat = CombatRules.Competitive with { Reach = 3.2f, CriticalWhileSprinting = false };
        }
    }
}
```

| Record             | Fields                                                                                                                                                          | Presets                                                  |
|--------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------|
| `CombatRules`      | `HitDelayTicks`, `Knockback`, `CriticalMultiplier`, `CriticalWhileSprinting`, `Reach`, `CreativeReach`, `ReachTolerance`, `LagCompensationTicks`, `Projectiles` | `Vanilla`, `Competitive` (4 ticks between hits)          |
| `KnockbackProfile` | `Horizontal`, `Vertical`, `VerticalLimit`, `SprintBonus`, `EnchantmentBonus`, `AirHorizontalFactor`, `AirVerticalFactor`, `KeptVelocity`                        | `Vanilla`, `Competitive` (lower, the same for every hit) |
| `ProjectileSpeeds` | `SpeedMultiplier`, `Snowball`, `Egg`, `EnderPearl`, `SplashPotion`, `Arrow` (blocks per tick)                                                                   | `Vanilla`                                                |

### Explosions

| Record             | Fields                                                                                                                                                                                                                                         | Presets   |
|--------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------|
| `ExplosionRules`   | `Tnt`, `CameraShake`                                                                                                                                                                                                                           | `Vanilla` |
| `TntRules`         | `FuseTicks`, `Power`, `ChainFuseMinTicks`, `ChainFuseMaxTicks`, `Hop`, `DropChance`, `DropScatter`, `KnockbackMultiplier`, `MaxPerTick`, `BreaksBlocks`, `BreaksBlocksInWater`, `DamagesEntities`, `CausesFire`, `ShakesCamera`, `ShowsDebris` | `Vanilla` |
| `CameraShakeRules` | `Enabled`, `RangePerPower`, `IntensityPerPower`, `MaxIntensity`, `Seconds`, `SecondsPerPower`                                                                                                                                                  | `Default` |

### Experience and enchanting

| Record            | Fields                                            | Presets                                       |
|-------------------|---------------------------------------------------|-----------------------------------------------|
| `ExperienceRules` | `BlockBreak`, `MobDeath`, `PlayerDeath`, `Bottle` | `Vanilla`: every source on                    |
| `EnchantingRules` | `Effects`, `Table`, `Anvil`, `Grindstone`         | `Vanilla`: everything on; `Disabled`: all off |

### Redstone

```csharp
world.Redstone.Rules = world.Redstone.Rules with
{
    Families = RedstoneFamilies.All & ~(RedstoneFamilies.Pistons | RedstoneFamilies.Sculk),
    Pistons = world.Redstone.Rules.Pistons with { PushLimit = 6 },
};
```

| Record            | Fields                                                                                                                                                                                                                                                                                                                                                                                                                          | Presets               |
|-------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-----------------------|
| `RedstoneRules`   | `Enabled`, `Families`, `Except` (block identifiers left out), `MaxUpdatesPerTick`, `MaxHopperTransfersPerTick`, `Timings`, `Pistons`, `Dispensers`, `Minecarts`, `Sculk`                                                                                                                                                                                                                                                        | `Vanilla`, `Disabled` |
| `RedstoneTimings` | `TorchDelay`, `LampOffDelay`, `StoneButtonTicks`, `WoodenButtonTicks`, `RepeaterStepTicks`, `ComparatorDelay`, `ObserverDelay`, `ObserverPulseTicks`, `PistonMoveTicks`, `PressurePlateTicks`, `WeightedPlateTicks`, `TripwireTicks`, `TargetTicks`, `TargetArrowTicks`, `LightningRodTicks`, `DispenserDelay`, `HopperCooldown`, `DetectorRailTicks`, `TorchBurnoutToggles`, `TorchBurnoutWindow`, `TorchBurnoutTicks` (ticks) | `Default`             |
| `PistonRules`     | `PushLimit`, `MaxMovesPerTick`, `Immovable` (block identifiers), `SlimeLaunch`                                                                                                                                                                                                                                                                                                                                                  | `Default`             |
| `DispenserRules`  | `ArrowSpeed`, `ThrowSpeed`, `PotionSpeed`, `ItemSpeed`, `TntSpeed`                                                                                                                                                                                                                                                                                                                                                              | `Default`             |
| `MinecartRules`   | `MaxSpeed`, `PoweredBoost`, `SlopeAcceleration`, `Drag`, `RiderDrag`, `RiderPush`, `MaxPerChunk`, `TntFuse`, `PicksUpMobs`                                                                                                                                                                                                                                                                                                      | `Default`             |
| `SculkRules`      | `SensorRange`, `CalibratedRange`, `ShriekerRange`, `SensorActiveTicks`, `CalibratedActiveTicks`, `CooldownTicks`, `ShriekTicks`, `ShriekerPlayerCooldown`, `ShriekerDarkness`, `DarknessRadius`, `DarknessTicks`, `MaxVibrationsPerTick`, `Ignored` (`VibrationKind`s)                                                                                                                                                          | `Default`             |

`RedstoneFamilies` (flags): `Wire` (dust), `Logic` (torches, repeaters, comparators), `Sources` (blocks of redstone,
levers, buttons, pressure plates), `Pistons`, `Observers`, `Mechanisms` (lamps, doors, trapdoors, fence gates, TNT,
note blocks, bells), `Containers` (dispensers, droppers, hoppers, what comparators read), `Rails`, `Sensors`
(daylight detectors, tripwire, target blocks, lightning rods), `Sculk`; `None` and `All`. What the power of each block
is, and how to tell components of a change, is in [World queries](../world-queries/).

### Time and weather of one world

`World.Features` is a `WorldFeatures` record with `Time` and `Weather`, each `true`, `false` or `null` (as the server
says). `world.IsTimeEnabled` and `world.IsWeatherEnabled` tell what applies now.

## Crafting in one world

```csharp
world.IsCraftingEnabled = false;                                       // no crafting table or 2×2 grid here
world.IsSmeltingEnabled = true;
world.ExceptRecipes = new HashSet<string> { "minecraft:tnt", "minecraft:bow" };
world.OnlyRecipes = new HashSet<string> { "minecraft:stick", "minecraft:torch" };   // null: every recipe
```

`OnlyRecipes` limits a world to some recipes, which is also all its players see in their recipe book; `ExceptRecipes`
removes some. Recipes of the whole server, and recipes of your own, are custom content
([Custom content](../../platform/custom-content/)).

## Reference

| Member of `WorldRules`                  | What it does                  |
|-----------------------------------------|-------------------------------|
| `bool GetBool(string rule)`             | Gets a rule that is on or off |
| `int GetInt(string rule)`               | Gets a rule that is a number  |
| `void SetBool(string rule, bool value)` | Sets a rule that is on or off |
| `void SetInt(string rule, int value)`   | Sets a rule that is a number  |
| `Difficulty Difficulty`                 | The difficulty; settable      |

| Member of `World`                                              | What it is                                        |
|----------------------------------------------------------------|---------------------------------------------------|
| `Rules`                                                        | The game rules and the difficulty                 |
| `Combat`, `Explosions`, `Experience`, `Enchanting`, `Features` | The records above; settable                       |
| `Redstone.Rules`                                               | The `RedstoneRules`; settable                     |
| `IsTimeEnabled`, `IsWeatherEnabled`                            | Whether time and weather run here now             |
| `IsCraftingEnabled`, `IsSmeltingEnabled`                       | Whether crafting and smelting work here; settable |
| `OnlyRecipes`, `ExceptRecipes`                                 | Which recipes are made here; settable             |

| Enum               | Values                               |
|--------------------|--------------------------------------|
| `Difficulty`       | `Peaceful`, `Easy`, `Normal`, `Hard` |
| `RedstoneFamilies` | Above                                |

| Event                    | What                                                                     |
|--------------------------|--------------------------------------------------------------------------|
| `GameRuleChangedEvent`   | Code or a command changed a game rule (`RuleName`, `FromText`, `ToText`) |
| `DifficultyChangedEvent` | Code or a command changed the difficulty (`From`, `To`)                  |

Every record compares by value (two `CombatRules` with the same fields are equal), its sets by their elements.
