---
title: "Blocks"
description: "Orion server plugins: block types and states, reading and changing blocks."
sidebar:
  order: 4
---

A block of a world is a `BlockState`: a block type (`minecraft:oak_log`) with a value for each of its properties (which
way the log lies). A plugin reads the block at a position, sets, places and breaks blocks, fills boxes and reacts to
what players do with blocks. The types are in `Orion.Sdk.Server.Blocks`, positions in `Orion.Sdk.Server.Positions`.

## Block types and states

`GameServer.Current.Blocks` is the catalog of every block type of the server:

```csharp
BlockCatalog blocks = GameServer.Current.Blocks;
BlockState stone = blocks.Find(BlockIds.Stone)!.DefaultState;
BlockState log = blocks.Parse("minecraft:oak_log[pillar_axis=x]");      // a state by its text
if (BlockState.TryParse(blocks, "minecraft:stone_slab[top_slot_bit=true]", out BlockState slab))
{
    Context.Logger.LogInformation("Slab: {State}", slab.Text);
}

BlockType? wool = blocks.Find("minecraft:white_wool");
bool isLog = blocks.Find(BlockIds.OakLog)!.HasTag("log");
```

A `BlockState` is a value (a `struct`), copied freely and compared with `==`. Its properties are read and changed by
name; every `With…` gives a new state:

```csharp
BlockState wheat = GameServer.Current.Blocks.Find(BlockIds.Wheat)!.DefaultState;
BlockState ripe = wheat.WithInt("growth", 7);
BlockState door = world.Blocks.Get(new BlockPosition(4, 64, 2));
if (door.Has("open_bit"))
{
    world.Blocks.Set(new BlockPosition(4, 64, 2), door.WithBool("open_bit", !door.GetBool("open_bit")));
}
```

The names and values of the properties are those of the game (`open_bit`, `growth`, `pillar_axis`,
`minecraft:cardinal_direction`…): `state.Text` shows them, such as `minecraft:oak_log[pillar_axis=y]`.
`BlockIds` (namespace `Bedrock.Identifiers`) has the identifier of every block of the game.

`state.Key` identifies a state the same way on every start of the server: store it, or store `state.Text`, to keep a
block in a file ([Keeping data](../../platform/persistence/)).

## Read and change blocks

```csharp
var position = new BlockPosition(0, 64, 0);
BlockState here = world.Blocks.Get(position);                           // loads the chunk if needed
if (here.IsAir)
{
    world.Blocks.Set(position, GameServer.Current.Blocks.Find(BlockIds.GoldBlock)!.DefaultState);
}
```

| Member                                | What it does                                                            | Raises            | Use it for                                                                   |
|---------------------------------------|-------------------------------------------------------------------------|-------------------|------------------------------------------------------------------------------|
| `Set(position, state)`                | Sets the block, nothing else: no drops, no reactions of the neighbors   | —                 | Building from code: maps, structures                                         |
| `Place(position, state)`              | Places the block as the game does, without a player                     | `BlockPlaceEvent` | Placing that other plugins should see                                        |
| `Break(position, player?)`            | Breaks the block as a player (or by itself): drops, effects, experience | `BlockBreakEvent` | Mining from code, a tool of your own                                         |
| `Fill(from, to, state)`               | Sets every block of a box at once; gives how many changed               | —                 | Small boxes                                                                  |
| `FillAsync(from, to, state, perTick)` | The same over several ticks                                             | —                 | Large boxes ([Block batches, copies and patterns](../block-batches-and-patterns/)) |

`Set` and `Fill` change blocks silently: when the neighbors should react (a torch on a block you removed),
call `world.Blocks.Updates.NotifyNeighbors(position)` ([World queries](../world-queries/)). `Fill` changes every block
in one tick: keep it to boxes of a few thousand blocks, and use `FillAsync` or a batch beyond.

`BlockPosition` is three whole numbers (`X`, `Y`, `Z`), `Vector3` three decimals. A block at `Y` below `world.MinY`
or from `world.MaxY` on is out of the world.

## React to what players do

| Event                | When                                                      | Notable fields                                                                          |
|----------------------|-----------------------------------------------------------|-----------------------------------------------------------------------------------------|
| `BlockMiningEvent`   | A player in survival or adventure starts breaking a block | Writable `Ticks` (how long it takes), `ShowCracks`, `PlayHits`                          |
| `BlockBreakEvent`    | A block is about to break                                 | `State`, `Tool`, `Player?`; writable `Allowed`, `Experience`, `WearTool`, `ShowEffects` |
| `BlockPlaceEvent`    | A block is about to be placed                             | `Clicked`, `Face`, `Item?`; writable `State`, `UseUpItem`, `PlaySound`                  |
| `BlockInteractEvent` | A player uses a block (a door, a chest, a button)         | `State`, `Face`, `Item`                                                                 |
| `SignEditEvent`      | A player wrote on a sign                                  | Writable `Text` ([Block entities](../block-entities/))                                |

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Game;
using Orion.Sdk.Server.Positions;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public sealed partial class OrePlugin : ServerPlugin
{
    // Diamond ore takes twice as long to mine, gives more experience, and leaves stone behind.
    [EventHandler]
    public static void OnMining(BlockMiningEvent e)
    {
        if (e.State.Id == BlockIds.DiamondOre)
        {
            e.Ticks *= 2;
        }
    }

    [EventHandler]
    public static void OnBreak(BlockBreakEvent e)
    {
        if (e.State.Id != BlockIds.DiamondOre)
        {
            return;
        }

        e.Experience += 10;
        BlockPosition position = e.Position;
        World world = e.World;
        world.Post(() => world.Blocks.Set(position, GameServer.Current.Blocks.Find(BlockIds.Stone)!.DefaultState));
    }

    // No placing TNT outside the arena.
    [EventHandler]
    public static void OnPlace(BlockPlaceEvent e)
    {
        if (e.State.Id == BlockIds.Tnt && e.World.Name != "arena")
        {
            e.IsCanceled = true;
            e.Player?.SendMessage("TNT only works in the arena.");
        }
    }
}
```

The block is still there while `BlockBreakEvent` runs: the handler posts the change for after the break
(`world.Post` runs at the next opportunity of the world).

## Reference

`BlockCatalog` (`GameServer.Current.Blocks`): the block types and states of the server.

| Member                           | What it is                                                        |
|----------------------------------|-------------------------------------------------------------------|
| `BlockState Air`                 | The state of air                                                  |
| `BlockType? Find(string id)`     | Finds a block type by its identifier, for example minecraft:stone |
| `BlockState Parse(string text)`  | A state by its text, as TryParse reads it                         |
| `IReadOnlyList<BlockType> Types` | The block types, air first                                        |

`BlockType`: a block type and its states.

| Member                             | What it is                                                                     |
|------------------------------------|--------------------------------------------------------------------------------|
| `BlockState DefaultState`          | The state a block of this type has when it is placed without other information |
| `bool HasTag(string tag)`          | Tells whether the block type has a tag, such as wood                           |
| `string Id`                        | The identifier of the block type, for example minecraft:stone                  |
| `IReadOnlyList<BlockState> States` | Every state of the block type                                                  |

`BlockState`: One state of a block type: a value for each of its properties.

| Member                                                                          | What it is                                                                                            |
|---------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `bool GetBool(string property)`                                                 | The value of a property that is on or off                                                             |
| `int GetInt(string property)`                                                   | The value of a property that is a number                                                              |
| `string GetText(string property)`                                               | The value of a property that is a word                                                                |
| `bool Has(string property)`                                                     | Tells whether the state has a property                                                                |
| `string Id`                                                                     | The identifier of the block type, for example minecraft:stone                                         |
| `bool IsAir`                                                                    | Whether the state is air                                                                              |
| `bool IsDefault`                                                                | Whether this is the default state of its block type                                                   |
| `uint Key`                                                                      | The key of the value in Orion, the same for every plugin and every start of Orion                     |
| `string Text`                                                                   | The state as text, its identifier and properties, for example minecraft:stone_slab[top_slot_bit=true] |
| `override string ToString()`                                                    |                                                                                                       |
| `static bool TryParse(BlockCatalog catalog, string text, out BlockState state)` | Reads a state from its text, such as minecraft:stone_slab[top_slot_bit=true], if the server has it    |
| `BlockType Type`                                                                | The block type of the state                                                                           |
| `BlockState WithBool(string property, bool value)`                              | The state with a property on or off                                                                   |
| `BlockState WithInt(string property, int value)`                                | The state with a property set to a number                                                             |
| `BlockState WithText(string property, string value)`                            | The state with a property set to a word                                                               |

`WorldBlocks`: The blocks of a world: reading, setting, filling, breaking and placing them, and batches of many changes.

| Member                                                                                            | What it is                                                                                                                                                              |
|---------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `bool Break(BlockPosition position, Player? player)`                                              | Breaks a block, as a player would or by itself, if `BlockBreakEvent` lets it                                                                                            |
| `int CompletePatterns(BlockPosition position, Player? player)`                                    | Looks for the registered patterns a block at a position may complete, as after a player places it, and completes those found as `BlockPatternCompleteEvent` decides     |
| `Task<BlockSnapshot> CopyAsync(BlockPosition from, BlockPosition to)`                             | Copies the blocks between two corners, from any thread                                                                                                                  |
| `BlockBatch CreateBatch()`                                                                        | Creates a batch of block changes of the plugin (Set, Fill, Clear, Paste, then ApplyAsync), placed over several ticks so the world never stalls; dispose it once applied |
| `int Fill(BlockPosition from, BlockPosition to, BlockState state)`                                | Sets every block between two corners, both included, at once                                                                                                            |
| `Task<long> FillAsync(BlockPosition from, BlockPosition to, BlockState state, int blocksPerTick)` | Sets every block between two corners over several ticks, a number per tick, from any thread                                                                             |
| `BlockPatternMatch? FindPattern(string patternId, BlockPosition position)`                        | Looks for a registered pattern with a block at a position as one of its blocks, without raising events                                                                  |
| `BlockState Get(BlockPosition position)`                                                          | The block at a position, loading its chunk if needed                                                                                                                    |
| `BlockEntity? GetEntity(BlockPosition position)`                                                  | The block entity of the block at a position, creating it when its block has one (a sign, a banner, a block variant with its own), and loading its chunk if needed       |
| `Sign? GetSign(BlockPosition position)`                                                           | The sign at a position                                                                                                                                                  |
| `Task<long> PasteAsync(BlockSnapshot snapshot, BlockPosition origin, int blocksPerTick)`          | Pastes a copy with its lowest corner at a position, over several ticks, from any thread                                                                                 |
| `bool Place(BlockPosition position, BlockState state)`                                            | Places a block as `BlockPlaceEvent` decides, without a player                                                                                                           |
| `bool Set(BlockPosition position, BlockState state)`                                              | Sets the block at a position, without events, drops or reactions                                                                                                        |
| `IReadOnlyList<BlockPatternMatch> TrackedPatterns`                                                | The tracked patterns complete in the world (see IsTracked)                                                                                                              |
| `bool Untrack(BlockPatternMatch match)`                                                           | Stops watching a tracked pattern, without raising `BlockPatternBrokenEvent`                                                                                             |
| `WorldBlockUpdates Updates`                                                                       | How the blocks react to each other: neighbors that hear of a change, and ticks scheduled by blocks                                                                      |

`BlockPosition`: The position of a block: three whole coordinates.

| Member                               | What it is               |
|--------------------------------------|--------------------------|
| `BlockPosition(int x, int y, int z)` | A new `BlockPosition`    |
| `override string ToString()`         |                          |
| `int X`                              | The X coordinate (east)  |
| `int Y`                              | The Y coordinate (up)    |
| `int Z`                              | The Z coordinate (south) |

`BlockFace`: A face of a block, the direction it looks to: `Down`, `Up`, `North`, `South`, `West`, `East`.
