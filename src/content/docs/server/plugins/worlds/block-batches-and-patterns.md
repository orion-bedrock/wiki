---
title: "Block batches, copies and patterns"
description: "Orion server plugins: large changes over several ticks, copies of areas, and patterns players build."
sidebar:
  order: 6
---

Changing a few blocks is instant; changing a million at once would freeze a world for every player in it. This page
covers the tools for large changes, which spread their work over several ticks, copies of areas that rebuild an arena,
and patterns: shapes of blocks players build, such as an altar or a portal frame.

## Large changes over several ticks

| Member                                                     | What it does                                                                |
|------------------------------------------------------------|-----------------------------------------------------------------------------|
| `world.Blocks.FillAsync(from, to, state, blocksPerTick)`   | Fills a box, a number of blocks per tick                                    |
| `world.Blocks.CopyAsync(from, to)`                         | Copies the blocks of a box into a `BlockSnapshot`                           |
| `world.Blocks.PasteAsync(snapshot, origin, blocksPerTick)` | Puts a copy back, its lowest corner at `origin`                             |
| `world.Blocks.CreateBatch()`                               | Gathers many changes of any kind, then applies them in order (`ApplyAsync`) |

They can be started from any thread; their tasks complete on the thread of the world, once every block is placed, with
the number of blocks changed. A budget of a few thousand blocks per tick keeps a world smooth; 32768 is the default of a
batch.

## Copy and paste: an arena that rebuilds itself

```csharp
using Orion.Sdk;
using Orion.Sdk.Server.Blocks;
using Orion.Sdk.Server.Positions;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public sealed class ArenaMap(World world, BlockPosition min, BlockPosition max) : IDisposable
{
    private BlockSnapshot? _original;

    // Once, before the first round: the arena as it was built.
    public async Task SaveAsync() => _original = await world.Blocks.CopyAsync(min, max);

    // After each round: every block the players changed comes back, 8192 a tick.
    public async Task<long> ResetAsync() =>
        _original is null ? 0 : await world.Blocks.PasteAsync(_original, min, 8192);

    public void Dispose() => _original?.Dispose();
}
```

A `BlockSnapshot` holds the blocks in Orion until you dispose it (or the plugin is disabled): `Min`, `Max`, `SizeX`,
`SizeY`, `SizeZ`, `Count`, and `Get(x, y, z)` reads a block by its offset from `Min`. Paste a snapshot as often and
wherever you like, in the world it came from or another.

## Batches

A batch gathers changes (set, fill, clear, remove, paste) and applies them in the order they were added, over several
ticks. Dispose it once applied; changes under way go on.

```csharp
BlockState glass = GameServer.Current.Blocks.Find(BlockIds.Glass)!.DefaultState;
BlockState stone = GameServer.Current.Blocks.Find(BlockIds.Stone)!.DefaultState;

using BlockBatch batch = world.Blocks.CreateBatch()
    .Fill(new BlockPosition(-50, 60, -50), new BlockPosition(50, 60, 50), stone)       // the floor
    .Clear(new BlockPosition(-50, 61, -50), new BlockPosition(50, 80, 50))             // the air above it
    .Fill(new BlockPosition(-50, 81, -50), new BlockPosition(50, 81, 50), glass)       // a glass roof
    .Set(new BlockPosition(0, 61, 0), GameServer.Current.Blocks.Find(BlockIds.Beacon)!.DefaultState);
long changed = await batch.ApplyAsync(4096);
```

`Count` is the most blocks the batch changes. Like `Set`, a batch, `FillAsync` and `PasteAsync` raise no events
([Blocks](../blocks/)).

## Patterns of blocks

A pattern is a shape the server recognizes when a player completes it: the block a player places that finishes the
shape raises `BlockPatternCompleteEvent`. Patterns are custom content: describe them in `OnLoad`
([Custom content](../../platform/custom-content/)).

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Blocks;
using Orion.Sdk.Server.Content;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Positions;

namespace Arena;

public sealed partial class AltarPlugin : ServerPlugin
{
    public override void OnLoad() => Context.Content
        // Two gold blocks on top of an obsidian pillar, facing any way.
        .Pattern("arena:altar", pattern => pattern
            .Layer("O")
            .Layer("O")
            .Layer("G")
            .Where('O', BlockMatch.Of(BlockIds.Obsidian))
            .Where('G', BlockMatch.Of(BlockIds.GoldBlock))
            .Rotations(0, 1, 2, 3)
            .Tracked())
        // A rectangle of crying obsidian around air, standing up, 2×3 to 10×10 inside.
        .Frame("arena:portal", frame => frame
            .Border(BlockMatch.Of(BlockIds.CryingObsidian))
            .Size(2, 3, 10, 10)
            .Tracked());

    [EventHandler]
    public static void OnComplete(BlockPatternCompleteEvent e)
    {
        switch (e.Match.Pattern.Id)
        {
            case "arena:altar":
                e.Player?.SendMessage("The altar awakens!");
                break;
            case "arena:portal":
                foreach (BlockPosition inside in e.Match.PositionsOf(BlockPatternMatch.InteriorKey))
                {
                    e.World.Particles.Spawn(ParticleIds.PortalReverseParticle, new(inside.X + 0.5f, inside.Y + 0.5f, inside.Z + 0.5f));
                }

                break;
        }
    }

    [EventHandler]
    public static void OnBroken(BlockPatternBrokenEvent e) =>
        e.World.Players.FirstOrDefault()?.SendMessage($"The {e.Match.Pattern.Id} at {e.Position} was broken.");
}
```

### Layers and matches

A pattern is layers of rows, bottom layer first; each row goes north to south, each character a block west to east,
and a space accepts any block. `Where` says what a character accepts, with a `BlockMatch`:

| `BlockMatch`                          | Accepts                                                                                               |
|---------------------------------------|-------------------------------------------------------------------------------------------------------|
| `BlockMatch.Of(ids…)`                 | Blocks of these types, in any state                                                                   |
| `BlockMatch.Tag(tag)`                 | Blocks of a tag, such as `minecraft:logs`                                                             |
| `BlockMatch.Any`, `BlockMatch.Air`    | Any block, air included; air only                                                                     |
| `.WithProperty(name, value)`          | Narrows a match to states with a property: `("pillar_axis", "y")`, `("open_bit", true)`, `("age", 7)` |
| `.Or(other)`, `.And(other)`, `.Not()` | Either, both, the opposite                                                                            |

A match is a value: each method gives a new one. Completion is looked for from blocks the pattern names by identifier
(`BlockMatch.Of`): placing a block matched only by a tag, `Any` or a `Not` does not complete a pattern.
`Rotations(0, 1, 2, 3)` also accepts the shape turned by quarter turns around the vertical axis.

### Frames

A frame is a rectangle of border blocks around an inside of any size within limits, as the portal of the Nether:
`Border` (required), `Interior` (air by default), `Size(minWidth, minHeight, maxWidth, maxHeight)` of the inside (1 to
21 by default, 64 at most), `Vertical()` (the default) or `Horizontal()` or both, and `RequireCorners()`. In its match,
`PositionsOf(BlockPatternMatch.BorderKey)` are the blocks of the border and `PositionsOf(BlockPatternMatch.InteriorKey)`
those of the inside (the keys `'B'` and `'I'`).

### Tracked patterns

A tracked pattern (`Tracked()`) is watched once complete: when one of its blocks changes to one the pattern does not
accept, `BlockPatternBrokenEvent` comes, and the world stops watching it. `world.Blocks.TrackedPatterns` are those
complete now, and `Untrack(match)` stops watching one without the event.

### Finding patterns from code

```csharp
BlockPatternMatch? altar = world.Blocks.FindPattern("arena:altar", new BlockPosition(0, 64, 0));
int completed = world.Blocks.CompletePatterns(new BlockPosition(0, 66, 0), player);   // as if the player placed it
```

`FindPattern` looks for a registered pattern with a block at a position as one of its blocks, without events;
`CompletePatterns` completes those found as placing would, with `BlockPatternCompleteEvent` (`Cause` is `Plugin`).

## Reference

`BlockBatch`: Many block changes for one world, placed and removed over several ticks so the world never stalls: build a
map, clear an arena, paste a structure.

| Member                                                                    | What it is                                                                                                                          |
|---------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| `Task<long> ApplyAsync(int blocksPerTick)`                                | Places the changes in the order they were added, at most a number of blocks per tick of the world                                   |
| `Task<long> ApplyAsync()`                                                 | Places the changes in the order they were added, 32768 blocks per tick of the world at most                                         |
| `BlockBatch Clear(BlockPosition from, BlockPosition to)`                  | Adds air at every block of a range, both corners included                                                                           |
| `long Count`                                                              | The number of blocks the batch changes at most (overlapping changes count once each)                                                |
| `void Dispose()`                                                          | Releases the batch; changes under way go on. Afterwards its members throw `PluginObjectGoneException`; disposing again does nothing |
| `BlockBatch Fill(BlockPosition from, BlockPosition to, BlockState state)` | Adds every block of a range, both corners included                                                                                  |
| `BlockBatch Paste(BlockSnapshot snapshot, BlockPosition origin)`          | Puts the blocks of a copy back, its lowest corner at a position                                                                     |
| `BlockBatch Remove(BlockPosition position)`                               | Removes a block: it becomes air                                                                                                     |
| `BlockBatch Set(BlockPosition position, BlockState state)`                | Sets a block                                                                                                                        |

`BlockSnapshot` (`IDisposable`): the blocks of a box copied from a world (`CopyAsync`), to put back later or elsewhere
(`PasteAsync`, `BlockBatch.Paste`).

| Member                                | What it is                                                                   |
|---------------------------------------|------------------------------------------------------------------------------|
| `long Count`                          | The number of blocks                                                         |
| `void Dispose()`                      | Lets go of the copy: Orion may free it, and this object no longer reaches it |
| `BlockState Get(int x, int y, int z)` | The state of a block, by its offset from `Min`                               |
| `BlockPosition Max`                   | The highest corner of the copy, where it was taken                           |
| `BlockPosition Min`                   | The lowest corner of the copy, where it was taken                            |
| `int SizeX`                           | The size east                                                                |
| `int SizeY`                           | The size up                                                                  |
| `int SizeZ`                           | The size south                                                               |

`PatternBuilder`: Describes a pattern of blocks of the plugin (`Context.Content.Pattern("arena:totem", pattern => …)`):
layers of rows, bottom layer first, a character per block and a space for any block, what each character accepts, and
the turns around the vertical axis it also matches. When a player places a block that completes it (or
World.Blocks.CompletePatterns finds it), BlockPatternCompleteEvent runs with the match; a tracked pattern is watched
afterwards, and breaking one of its blocks runs BlockPatternBrokenEvent.

| Member                                                | What it is                                                                                                            |
|-------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `PatternBuilder Layer(params string[] rows)`          | Adds a layer, above those added before: its rows, north to south, each character a block west to east                 |
| `PatternBuilder Rotations(params int[] quarterTurns)` | Sets the turns around the vertical axis the pattern also matches, in quarter turns (0 to 3); only as built by default |
| `PatternBuilder Tracked()`                            | Watches the pattern once complete (World.Blocks.TrackedPatterns), until one of its blocks breaks                      |
| `PatternBuilder Where(char key, BlockMatch match)`    | Says what a character of the layers accepts                                                                           |

`FrameBuilder`: Describes a frame of blocks of the plugin (`Context.Content.Frame("arena:portal", frame => …)`): a
rectangle of border blocks around an inside of any size within limits, standing or lying flat, as the portal of the
Nether. Completing one runs BlockPatternCompleteEvent with the match, as a pattern does.

| Member                                                                        | What it is                                                                           |
|-------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| `FrameBuilder Border(BlockMatch match)`                                       | Sets what the border accepts; required                                               |
| `FrameBuilder Horizontal()`                                                   | Accepts frames lying flat; with Vertical, both                                       |
| `FrameBuilder Interior(BlockMatch match)`                                     | Sets what the inside accepts; air by default                                         |
| `FrameBuilder RequireCorners()`                                               | Requires the four corners to be border blocks too; the portal of the Nether does not |
| `FrameBuilder Size(int minWidth, int minHeight, int maxWidth, int maxHeight)` | Sets the sizes of the inside it accepts, from 1 to 64; 1 to 21 by default            |
| `FrameBuilder Tracked()`                                                      | Watches the frame once complete, until one of its blocks breaks                      |
| `FrameBuilder Vertical()`                                                     | Accepts standing frames, the default                                                 |

`BlockMatch`: What a block of a pattern accepts (Where, Border): any block, air, blocks by identifier, a tag, any or all
of several, the opposite of one, each narrowed by properties of the block state. Immutable: each method returns a new
match.

| Member                                               | What it is                                                                                        |
|------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| `static BlockMatch Air`                              | A match of air                                                                                    |
| `BlockMatch And(BlockMatch other)`                   | Matches what both this match and another accept                                                   |
| `static BlockMatch Any`                              | A match of any block, air included                                                                |
| `BlockMatch Not()`                                   | Matches what this match does not accept                                                           |
| `static BlockMatch Of(params string[] blockIds)`     | Matches blocks of some types, in any state                                                        |
| `BlockMatch Or(BlockMatch other)`                    | Matches what this match or another accepts                                                        |
| `static BlockMatch Tag(string tag)`                  | Matches the blocks of a tag, such as minecraft:logs                                               |
| `BlockMatch WithProperty(string name, string value)` | Narrows the match to blocks whose state has a property with a value, such as ("pillar_axis", "y") |
| `BlockMatch WithProperty(string name, bool value)`   | Narrows the match to blocks whose state has a property with a value, such as ("open_bit", true)   |
| `BlockMatch WithProperty(string name, int value)`    | Narrows the match to blocks whose state has a property with a value, such as ("age", 7)           |

`BlockPattern`: a shape of blocks the server recognizes, such as an altar or a portal frame: layers (`Pattern`) or a
frame of variable size (`Frame`).

| Member           | What it is                                                                                                |
|------------------|-----------------------------------------------------------------------------------------------------------|
| `string Id`      | The identifier of the pattern, such as lobby:altar                                                        |
| `bool IsTracked` | Whether the world remembers the pattern once complete and raises `BlockPatternBrokenEvent` when it breaks |

`BlockPatternMatch`: A pattern found in a world: where, turned how, and the positions of each letter of its shape (for
frames, Border and Interior).

| Member                                               | What it is                                                                                                               |
|------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `const char BorderKey = 'B'`                         | The key of the border of a frame                                                                                         |
| `const char InteriorKey = 'I'`                       | The key of the inside of a frame                                                                                         |
| `bool Contains(BlockPosition position)`              | Tells whether a position is part of the shape                                                                            |
| `int Height`                                         | The size of the shape along its height: layers, or the inside of a frame                                                 |
| `BlockPosition Origin`                               | Where its first letter is: the first cell of the bottom layer, or for a frame its lowest interior corner                 |
| `BlockPattern Pattern`                               | The pattern                                                                                                              |
| `IReadOnlyList<BlockPosition> Positions`             | Every position of the shape                                                                                              |
| `IReadOnlyList<BlockPosition> PositionsOf(char key)` | The blocks of one key of the shape: a character of its layers, such as '#', or `BorderKey` and `InteriorKey` for a frame |
| `int Width`                                          | The size of the shape along its width: columns of a layer, or the inside of a frame                                      |
| `World World`                                        | The world                                                                                                                |

`BlockPatternCompleteCause` (the `Cause` of `BlockPatternCompleteEvent`): how a block pattern came to be
complete.

| Member         | What it is                                                         |
|----------------|--------------------------------------------------------------------|
| `Place = 0`    | A block of it was placed                                           |
| `Interact = 1` | A player used one of its blocks, such as putting an eye in a frame |
| `Plugin = 2`   | A plugin asked the world to look for patterns at a position        |
