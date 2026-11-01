---
title: "World queries"
description: "Orion server plugins: ray casts, collisions, redstone power, chunks, vibrations and scheduled block ticks."
sidebar:
  order: 3
---

Beyond reading blocks one by one, a world answers questions about its space: what a ray hits, whether a box is free,
how much redstone power a block takes, which chunks are in memory. It also lets a plugin make the world react: tell
neighbors of a change, schedule a tick for a block, make a vibration that sculk sensors hear. Everything here runs on
the thread of the world ([Threads and async code](../../basics/threads/)).

## Ray casts

`world.RayCast` finds the first thing a ray from a point hits within a distance: the collision shape of a block (what
physics and projectiles hit: not air, grass or flowers), water or lava, or the box of an entity.

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Entities;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public sealed partial class WandPlugin : ServerPlugin
{
    // A blaze rod breaks the block a player looks at, or lifts the entity it looks at.
    [EventHandler]
    public static void OnUse(ItemUseEvent e)
    {
        if (e.Item.Id != ItemIds.BlazeRod || e.Player.World is not { } world)
        {
            return;
        }

        RayCastHit hit = world.RayCast(e.Player.EyePosition, e.Player.LookDirection, 20, RayCastFilter.Solid, e.Player);
        switch (hit.Kind)
        {
            case RayCastHitKind.Block:
                world.Blocks.Break(hit.Block, e.Player);
                break;
            case RayCastHitKind.Entity when hit.Entity is LivingEntity target:
                target.Effects.Add(EffectIds.Levitation, 60, 0, true);
                break;
        }
    }
}
```

| `RayCastFilter` | Stops at                                                  |
|-----------------|-----------------------------------------------------------|
| `Blocks`        | Collision shapes of blocks                                |
| `Liquids`       | Water and lava, water inside a waterlogged block too      |
| `Entities`      | Boxes of entities, players included                       |
| `Solid`         | Blocks and entities: what a projectile hits (the default) |
| `All`           | Blocks, liquids and entities                              |
| `None`          | Nothing                                                   |

The last argument is an entity the ray ignores, usually the player it starts from. A chunk that is not loaded has
nothing to hit. The hit (`RayCastHit`, a record) has its `Kind`, the `Point` and its `Distance`, and the `Block` and
`Face` it entered through, or the `Entity`.

## Collisions

`world.Collisions` answers what physics sees of the blocks: whether a box is free (an entity could stand there), on the
ground or in a liquid, and how a block moves what touches it.

```csharp
var feet = new Vector3(10.5f, 64, 3.5f);
var min = new Vector3(feet.X - 0.3f, feet.Y, feet.Z - 0.3f);
var max = new Vector3(feet.X + 0.3f, feet.Y + 1.8f, feet.Z + 0.3f);     // a box the size of a player
bool fits = world.Collisions.IsFree(min, max);
bool standing = world.Collisions.IsOnGround(min, max);
BlockSurface surface = world.Collisions.GetSurface(new BlockPosition(10, 63, 3));
bool slippery = surface.Friction < 0.1f;                                 // ice
```

A box is given by its two corners, the lowest first. `GetShapeTop` gives the top of the shape of a block (1 for a full
block, 0.5 for a slab, 1.5 for a fence), `GetClimbSpeed` how fast a ladder or vine is climbed, `GetMotionFactor` how a
cobweb or powder snow slows what moves inside it.

## Redstone power

`world.Redstone` reads the power blocks take and tells components when a plugin changed something they should notice:

```csharp
var door = new BlockPosition(5, 64, 5);
if (world.Redstone.IsPowered(door))
{
    int power = world.Redstone.GetPower(door);                           // 0 to 15, from any side
}

int fill = world.Redstone.GetComparatorOutput(new BlockPosition(6, 64, 5));   // how full a container is
world.Redstone.NotifyContentChanged(new BlockPosition(6, 64, 5));        // after changing its items from code
```

| Member                                  | When to use it                                                                      |
|-----------------------------------------|-------------------------------------------------------------------------------------|
| `GetPower`, `GetPowerFrom`, `IsPowered` | Read the power a block takes, from every side or through one face                   |
| `GetComparatorOutput`                   | What a comparator would read from a block                                           |
| `NotifyPowerChanged`                    | A block of yours became a source of power, or stopped being one                     |
| `NotifyContentChanged`                  | What comparators read changed without a change of the block state (container items) |
| `Evaluate`                              | Ask the component at a position to look at its power again                          |

The rules of redstone of a world (which families work, their timings) are in [World rules](../world-rules/).

## Chunks

```csharp
var chunk = new ChunkPosition(0, 0);
if (!world.Chunks.IsLoaded(chunk))
{
    Chunk loaded = await world.Chunks.GetAsync(chunk);                   // read or generated off the world thread
}

int inMemory = world.Chunks.LoadedCount;
```

`GetAsync` completes on the thread of the world. `ChunkLoadedEvent` comes when a chunk enters memory (`IsNew` when it
was just generated) and `ChunkUnloadEvent` before one leaves it (writable `Save`, cancelable to keep it).

## Block updates and scheduled ticks

Blocks react to their neighbors: a block that changes tells the six blocks around it. `world.Blocks.Updates` does what
placing and breaking do, for changes a plugin made with `Set`, and lets a block ask for a tick later:

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Game;

namespace Arena;

public sealed partial class CrumblePlugin : ServerPlugin
{
    // Gravel placed in the arena crumbles two seconds later.
    [EventHandler(EventPriority.Monitor)]
    public static void OnPlace(BlockPlaceEvent e)
    {
        if (e.Outcome == EventOutcome.Done && e.State.Id == BlockIds.Gravel && e.World.Name == "arena")
        {
            e.World.Blocks.Updates.ScheduleTick(e.Position, 40, 0);
        }
    }

    [EventHandler]
    public static void OnTick(BlockScheduledTickEvent e)
    {
        if (e.State.Id == BlockIds.Gravel && e.World.Name == "arena")
        {
            e.World.Blocks.Set(e.Position, GameServer.Current.Blocks.Air);
            e.World.Blocks.Updates.NotifyNeighbors(e.Position);
        }
    }
}
```

A scheduled tick runs only if a block of the same type is still there; `BlockScheduledTickEvent` comes first and may
cancel it. `BlockNeighborChangedEvent` comes when a block that reacts to its neighbors hears of a change.

## Vibrations

Sculk sensors and shriekers hear vibrations, as in the game; a plugin makes its own:

```csharp
world.Vibrations.Emit(VibrationKind.BlockActivate, new Vector3(0, 64, 0), player);
```

`EmitFromBlock` makes the vibration of a block (wool and carpets muffle it). `VibrationKind` has every event of the game
sculk hears, each with its frequency, and the resonances of amethyst.

## How busy a world is

`world.LastTickMilliseconds` is how long the last tick took, `world.AverageTickMilliseconds` the mean over about a
minute: a tick has 50 ms. Use them to scale down the work of a plugin in a busy world.

## Reference

`RayCastHit`: What a ray cast of a world hit first (`RayCast`): the kind, the point and its distance from the origin,
the block and the face the ray entered through (a block or a liquid) or the entity.

| Member                | What it is                                    |
|-----------------------|-----------------------------------------------|
| `BlockPosition Block` | The block hit, for a block or a liquid        |
| `float Distance`      | How far the point is from the origin          |
| `Entity? Entity`      | The entity hit, or `null`                     |
| `BlockFace Face`      | The face of the block the ray entered through |
| `RayCastHitKind Kind` | What was hit                                  |
| `Vector3 Point`       | Where the ray hit                             |

`RayCastFilter`: What a ray cast of a world (`RayCast`) stops at; the values combine.

| Member         | What it is                                                                                      |
|----------------|-------------------------------------------------------------------------------------------------|
| `None = 0`     | Nothing: the ray never hits                                                                     |
| `Blocks = 1`   | The collision shapes of blocks, as physics and projectiles see them (not air, grass or flowers) |
| `Liquids = 2`  | Water and lava, also water inside a waterlogged block                                           |
| `Entities = 4` | The boxes of entities, players included                                                         |
| `Solid = 5`    | Blocks and entities, what a projectile hits                                                     |
| `All = 7`      | Blocks, liquids and entities                                                                    |

`RayCastHitKind`: What a ray cast hit first.

| Member       | What it is                     |
|--------------|--------------------------------|
| `None = 0`   | Nothing within the distance    |
| `Block = 1`  | The collision shape of a block |
| `Liquid = 2` | Water or lava                  |
| `Entity = 3` | An entity                      |

`WorldCollisions`: The blocks of a world as physics sees them: the collision shape, surface and medium of each block.

| Member                                            | What it is                                                                                                        |
|---------------------------------------------------|-------------------------------------------------------------------------------------------------------------------|
| `float GetClimbSpeed(BlockPosition position)`     | How fast entities climb the block at a position, such as a ladder; 0 when it is not climbable                     |
| `Vector3 GetMotionFactor(BlockPosition position)` | How the block at a position slows what moves inside it, per axis: 1 for none, as cobwebs or powder snow change it |
| `float GetShapeTop(BlockPosition position)`       | The top of the collision shape of the block at a position: 1 for a full block, 0.5 for a slab, 1.5 for a fence    |
| `BlockSurface GetSurface(BlockPosition position)` | How entities move on the block at a position: its friction, speed, jump and bounce                                |
| `bool IsFree(Vector3 min, Vector3 max)`           | Tells whether a box touches no block, such as the box of an entity at a place it could stand                      |
| `bool IsInLiquid(Vector3 min, Vector3 max)`       | Tells whether a box touches water or lava, also water inside a waterlogged block                                  |
| `bool IsLiquid(BlockPosition position)`           | Tells whether the block at a position is water or lava, or holds water                                            |
| `bool IsOnGround(Vector3 min, Vector3 max)`       | Tells whether a box rests on a block: a block is right under it                                                   |
| `bool IsPassable(BlockPosition position)`         | Tells whether entities go through the block at a position: it has no collision shape, as air, grass or water      |

`BlockSurface`: How entities move on a block: its friction, the factors of their speed and jump, how much they bounce
and whether it slows walking.

| Member                                                                                               | What it is                                                      |
|------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| `BlockSurface(float friction, float speedFactor, float jumpFactor, float bounce, bool slowsWalking)` | A new `BlockSurface`                                            |
| `float Bounce`                                                                                       | How much entities bounce on it                                  |
| `float Friction`                                                                                     | How much it holds back what moves on it: lower is more slippery |
| `float JumpFactor`                                                                                   | How much it changes the jump of entities on it                  |
| `bool SlowsWalking`                                                                                  | Whether it slows walking, as soul sand does                     |
| `float SpeedFactor`                                                                                  | How much it changes the speed of entities on it                 |
| `override string ToString()`                                                                         |                                                                 |

`WorldRedstone`: The redstone of a world (`world.Redstone`): its rules, what power each block takes, and the work of
telling the components when it changes.

| Member                                                     | What it is                                                                                                                                                                                         |
|------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `void Evaluate(BlockPosition position)`                    | Makes the component at a position look again at the power it takes, now or after what is under way                                                                                                 |
| `int GetComparatorOutput(BlockPosition position)`          | What a comparator reads from the block at a position: how full a container is, how much is left of a cake                                                                                          |
| `int GetPower(BlockPosition position)`                     | The highest power the block at a position takes from any side, as a lamp or a door would                                                                                                           |
| `int GetPowerFrom(BlockPosition position, BlockFace face)` | The power the block at a position takes through one face only                                                                                                                                      |
| `bool IsEnabled`                                           | Whether redstone works here                                                                                                                                                                        |
| `bool IsPowered(BlockPosition position)`                   | Tells whether the block at a position takes power                                                                                                                                                  |
| `void NotifyContentChanged(BlockPosition position)`        | Tells the comparators that read the block at a position that what they read changed without a change of its state, such as the items of a container; they look again in the next tick of the world |
| `void NotifyPowerChanged(BlockPosition position)`          | Tells the components a source at a position may reach that its power changed: those next to it, and those next to the solid blocks next to it                                                      |
| `RedstoneRules Rules`                                      | What redstone does here; settable                                                                                                                                                                  |

`WorldChunks`: The chunks of a world in memory: loaded from its storage, or generated, when first needed.

| Member                                         | What it is                                                                      |
|------------------------------------------------|---------------------------------------------------------------------------------|
| `Task<Chunk> GetAsync(ChunkPosition position)` | A chunk, reading or generating it on the chunk threads when it is not in memory |
| `Chunk? GetLoaded(ChunkPosition position)`     | A chunk that is in memory, without loading it                                   |
| `bool IsLoaded(ChunkPosition position)`        | Tells whether a chunk is in memory                                              |
| `int LoadedCount`                              | The number of chunks in memory                                                  |
| `int LoadingCount`                             | The number of chunks being read or generated                                    |

`Chunk`: A 16-block-wide column of a world: its sub-chunks from the bottom to the top of the dimension.

| Member                   | What it is                                           |
|--------------------------|------------------------------------------------------|
| `ChunkPosition Position` | The position of the chunk                            |
| `int Version`            | A number that changes with every change of the chunk |

`ChunkPosition`: The position of a chunk: its X and Z, in chunks of 16 blocks.

| Member                        | What it is               |
|-------------------------------|--------------------------|
| `ChunkPosition(int x, int z)` | A new `ChunkPosition`    |
| `override string ToString()`  |                          |
| `int X`                       | The X coordinate (east)  |
| `int Z`                       | The Z coordinate (south) |

`WorldVibrations`: The vibrations of a world (`world.Vibrations`), which sculk sensors and shriekers hear.

| Member                                                                                       | What it is                                                                                                  |
|----------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------|
| `void Emit(VibrationKind kind, Vector3 position, Entity? source)`                            | Makes a vibration, which sculk sensors and shriekers in range hear, as the game does when something happens |
| `void EmitFromBlock(VibrationKind kind, Vector3 position, BlockState block, Entity? source)` | Makes a vibration of a block (placed, broken, stepped on): wool and carpets muffle it                       |
| `int TravelingCount`                                                                         | The number of vibrations on their way to a block that heard them                                            |

`WorldBlockUpdates`: how the blocks of a world react to each other (`world.Blocks.Updates`): a block that changes tells
its six neighbors, and a block can ask for a tick some ticks later.

| Member                                                               | What it is                                                                                                                                             |
|----------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------|
| `bool IsTickScheduled(BlockPosition position)`                       | Tells whether the block type at a position has a tick scheduled there                                                                                  |
| `void NotifyNeighbors(BlockPosition position)`                       | Tells the six blocks next to a position that it changed, as placing or breaking does; they react before this returns, or after the reactions under way |
| `int ScheduledTickCount`                                             | How many scheduled ticks the loaded chunks hold                                                                                                        |
| `bool ScheduleTick(BlockPosition position, int delay, int priority)` | Asks for a tick of the block at a position some ticks from now; it runs (`BlockScheduledTickEvent`) if a block of the same type is still there         |
`VibrationKind`: what made a vibration: the events of the game sculk sensors hear, each with its frequency, and the two
only sculk shriekers hear.

| Member                             | What it is                                                                                           |
|------------------------------------|------------------------------------------------------------------------------------------------------|
| `Step = 0`                         | An entity took a step (frequency 1)                                                                  |
| `Swim = 1`                         | An entity swam (frequency 1)                                                                         |
| `Flap = 2`                         | A flying entity flapped its wings (frequency 1)                                                      |
| `ProjectileLand = 3`               | A projectile landed on a block (frequency 2)                                                         |
| `HitGround = 4`                    | An entity hit the ground after a fall or a jump (frequency 2)                                        |
| `Splash = 5`                       | An entity splashed into a liquid (frequency 2)                                                       |
| `ItemInteractFinish = 6`           | An entity finished using an item over time (frequency 3)                                             |
| `ProjectileShoot = 7`              | A projectile was shot or thrown (frequency 3)                                                        |
| `InstrumentPlay = 8`               | An instrument, such as a goat horn, was played (frequency 3)                                         |
| `EntityAction = 9`                 | An entity did an action of its own (frequency 4)                                                     |
| `ElytraGlide = 10`                 | An entity glided with elytra (frequency 4)                                                           |
| `Unequip = 11`                     | An entity took off a piece of equipment (frequency 4)                                                |
| `EntityDismount = 12`              | An entity got off another one (frequency 5)                                                          |
| `Equip = 13`                       | An entity put on a piece of equipment (frequency 5)                                                  |
| `EntityMount = 14`                 | An entity got on another one (frequency 6)                                                           |
| `EntityInteract = 15`              | A player used an entity (frequency 6)                                                                |
| `Shear = 16`                       | Something was sheared (frequency 6)                                                                  |
| `EntityDamage = 17`                | An entity was hurt (frequency 7)                                                                     |
| `Drink = 18`                       | An entity drank (frequency 8)                                                                        |
| `Eat = 19`                         | An entity ate (frequency 8)                                                                          |
| `ContainerClose = 20`              | A container was closed (frequency 9)                                                                 |
| `BlockClose = 21`                  | A door, trapdoor or fence gate was closed (frequency 9)                                              |
| `BlockDeactivate = 22`             | A block was switched off: a lever, a button, a pressure plate, a piston that retracts (frequency 9)  |
| `BlockDetach = 23`                 | A block was detached, such as tripwire from its hooks (frequency 9)                                  |
| `ContainerOpen = 24`               | A container was opened (frequency 10)                                                                |
| `BlockOpen = 25`                   | A door, trapdoor or fence gate was opened (frequency 10)                                             |
| `BlockActivate = 26`               | A block was switched on: a lever, a button, a pressure plate, a piston that extends (frequency 10)   |
| `BlockAttach = 27`                 | A block was attached, such as tripwire to its hooks (frequency 10)                                   |
| `PrimeFuse = 28`                   | A fuse was lit: TNT, a TNT minecart (frequency 10)                                                   |
| `NoteBlockPlay = 29`               | A note block played (frequency 10)                                                                   |
| `BlockChange = 30`                 | A block changed by use: a cake eaten, a composter filled, a repeater set, a bell rung (frequency 11) |
| `BlockDestroy = 31`                | A block was broken (frequency 12)                                                                    |
| `FluidPickup = 32`                 | A fluid was picked up with a bucket (frequency 12)                                                   |
| `BlockPlace = 33`                  | A block was placed (frequency 13)                                                                    |
| `FluidPlace = 34`                  | A fluid was placed from a bucket (frequency 13)                                                      |
| `EntityPlace = 35`                 | An entity was placed, such as a minecart (frequency 14)                                              |
| `LightningStrike = 36`             | Lightning struck (frequency 14)                                                                      |
| `Teleport = 37`                    | An entity teleported (frequency 14)                                                                  |
| `EntityDie = 38`                   | An entity died (frequency 15)                                                                        |
| `Explode = 39`                     | Something exploded (frequency 15)                                                                    |
| `Resonate1 = 40`                   | A block of amethyst resonated with frequency 1                                                       |
| `Resonate2 = 41`                   | A block of amethyst resonated with frequency 2                                                       |
| `Resonate3 = 42`                   | A block of amethyst resonated with frequency 3                                                       |
| `Resonate4 = 43`                   | A block of amethyst resonated with frequency 4                                                       |
| `Resonate5 = 44`                   | A block of amethyst resonated with frequency 5                                                       |
| `Resonate6 = 45`                   | A block of amethyst resonated with frequency 6                                                       |
| `Resonate7 = 46`                   | A block of amethyst resonated with frequency 7                                                       |
| `Resonate8 = 47`                   | A block of amethyst resonated with frequency 8                                                       |
| `Resonate9 = 48`                   | A block of amethyst resonated with frequency 9                                                       |
| `Resonate10 = 49`                  | A block of amethyst resonated with frequency 10                                                      |
| `Resonate11 = 50`                  | A block of amethyst resonated with frequency 11                                                      |
| `Resonate12 = 51`                  | A block of amethyst resonated with frequency 12                                                      |
| `Resonate13 = 52`                  | A block of amethyst resonated with frequency 13                                                      |
| `Resonate14 = 53`                  | A block of amethyst resonated with frequency 14                                                      |
| `Resonate15 = 54`                  | A block of amethyst resonated with frequency 15                                                      |
| `SculkSensorTendrilsClicking = 55` | The tendrils of a sculk sensor clicked: it heard something                                           |
| `Shriek = 56`                      | A sculk shrieker shrieked                                                                            |
