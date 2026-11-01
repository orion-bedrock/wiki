---
title: "Block entities"
description: "Orion server plugins: chests, furnaces, signs, banners and the other blocks that keep data."
sidebar:
  order: 5
---

Some blocks keep data beyond their state: the items of a chest, the text of a sign, the patterns of a banner, what a
furnace is smelting. That data is the block entity of the block. `world.Blocks.GetEntity(position)` gives it as the
class of its kind, so a plugin tests it with `is`. The types are in `Orion.Sdk.Server.Blocks`.

## Get the block entity of a block

```csharp
var position = new BlockPosition(10, 64, 10);
switch (world.Blocks.GetEntity(position))
{
    case Chest chest:
        chest.Inventory.Add(new ItemStack(ItemIds.Diamond, 3));
        chest.CustomName = Text.Lang("loot::chest");
        break;
    case Furnace furnace:
        furnace.Fuel = new ItemStack(ItemIds.Coal, 8);
        break;
    case Sign sign:
        sign.Front.Text = "Arena\nRound 1";
        break;
    case null:
        // the block has no block entity
        break;
}
```

`GetEntity` loads the chunk if needed, and creates the block entity of a block that should have one. A block entity
whose block was replaced, or whose chunk unloaded, is `IsRemoved` and changes nothing any more: get it again rather than
keeping it for long.

| Class                      | Blocks                                                                       | Members                                                                                                                     |
|----------------------------|------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `Container`                | Barrels, dispensers, droppers, shulker boxes, and the base of the next three | `Inventory`, `CustomName`, `Viewers`, `Open(player)`, `CloseAll()`                                                          |
| `Chest : Container`        | Chests and trapped chests                                                    | `Pair`, `PairWith(other)`, `Unpair()`                                                                                       |
| `Furnace : Container`      | Furnaces, blast furnaces, smokers                                            | `Input`, `Fuel`, `Output`, `CookTime`, `CookDuration`, `BurnTime`, `BurnDuration`, `IsLit`, `StoredExperience`, `RecipeTag` |
| `Hopper : Container`       | Hoppers                                                                      | `TransferCooldown`                                                                                                          |
| `Sign`                     | Signs and hanging signs                                                      | `Front`, `Back` (`SignSide`: `Text`, `Color`, `IsGlowing`), `IsWaxed`, `OpenEditor`                                         |
| `Banner`                   | Standing and wall banners                                                    | `BaseColor`, `Patterns`, `Layers`, `IsOminous`                                                                              |
| `Bell`                     | Bells                                                                        | `Ring(direction)`, `IsRinging`, `Ticks`, `Direction`                                                                        |
| `NoteBlock`                | Note blocks                                                                  | `Note`                                                                                                                      |
| `Skull`                    | Skulls and heads                                                             | `Rotation`, `IsMouthMoving`                                                                                                 |
| `Bed`                      | Beds                                                                         | `Color`                                                                                                                     |
| `EnchantingTable`          | Enchanting tables                                                            | `CustomName`                                                                                                                |
| `Comparator`               | Comparators                                                                  | `OutputSignal`                                                                                                              |
| `PistonArm`, `MovingBlock` | Pistons, and the blocks they move                                            | Read-only: where the head is, what moves                                                                                    |
| `RawBlockEntity`           | A block entity the server does not know                                      | Those of every block entity                                                                                                 |

Every block entity has its `Id`, `World` and `Position`.

## Containers

The `Inventory` of a container is an `Inventory` like any other ([Items and inventories](../../items/items-and-inventories/)):
`Add`, `Get`, `Set`, `Remove`, `Count`, `Clear`, snapshots. `Open(player)` shows its window to a player (through
`InventoryOpenEvent`), and `CustomName` sets the title of the window, a `Text` shown in the language of each player:

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Blocks;
using Orion.Sdk.Server.Items;
using Orion.Sdk.Server.Lang;
using Orion.Sdk.Server.Positions;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public static class Loot
{
    // Refills the loot chests of an arena at the start of a round.
    public static void Refill(World arena, IEnumerable<BlockPosition> chests)
    {
        foreach (BlockPosition position in chests)
        {
            if (arena.Blocks.GetEntity(position) is not Container container)
            {
                continue;
            }

            container.CloseAll();
            container.Inventory.Clear();
            container.Inventory.Add(new ItemStack(ItemIds.IronSword));
            container.Inventory.Add(new ItemStack(ItemIds.GoldenApple, Random.Shared.Next(1, 3)));
            container.CustomName = Text.Lang("arena::loot");
        }
    }
}
```

After changing the items of a container from code, `world.Redstone.NotifyContentChanged(position)` tells the comparators
that read it ([World queries](../world-queries/)). Two chests side by side make a double chest: `chest.Pair` is the
other half (or `null`), `PairWith` and `Unpair` join and split them. A furnace has its `RecipeTag`: `furnace`,
`blast_furnace` or `smoker`.

## Signs

A sign has two sides, each with its text (lines separated by `\n`), its color and whether it glows:

```csharp
if (world.Blocks.GetSign(new BlockPosition(0, 65, 3)) is { } sign)
{
    sign.Front.Text = Text.Lang("arena::sign", ("round", 2));      // in the language of each player who reads it
    sign.Front.Color = 0xFFFFAA00;                                  // ARGB
    sign.Front.IsGlowing = true;
    sign.IsWaxed = true;                                            // players cannot edit it
}
```

`sign.OpenEditor(player, front)` opens the editor of one side to a player, as the game does when one is placed; what
the player writes comes in `SignEditEvent`, whose `Text` a handler may change or cancel:

```csharp
[EventHandler]
public static void OnSignEdit(SignEditEvent e)
{
    if (e.Text.Contains("[shop]", StringComparison.OrdinalIgnoreCase) && !e.Player.HasPermission("arena.shops"))
    {
        e.IsCanceled = true;
        e.Player.SendMessage("Only staff can make shop signs.");
    }
}
```

## Banners

The patterns of a banner are records of a pattern of the game and a color, bottom layer first; the game draws 16 at
most:

```csharp
if (world.Blocks.GetEntity(new BlockPosition(2, 66, 0)) is Banner banner)
{
    banner.BaseColor = DyeColor.Red;
    banner.Patterns = [new BannerPattern("bo", DyeColor.Black), new BannerPattern("cr", DyeColor.White)];
}
```

Pattern codes are those of the game: `bo` (border), `cr` (cross), `ss` (stripe down the middle), `bts` (bottom
triangle sawtooth)… `Layers` is the same list as a record (`BannerLayers`), read and set at once.

## Other blocks

```csharp
if (world.Blocks.GetEntity(new BlockPosition(0, 64, 8)) is Bell bell)
{
    bell.Ring(direction: 0);                     // south 0, west 1, north 2, east 3
}

if (world.Blocks.GetEntity(new BlockPosition(1, 64, 8)) is NoteBlock note)
{
    note.Note = 12;                              // 0 (F♯) to 24, two octaves up
}
```

## Reference

`BlockEntity`: The extra data of a block at one position, such as the text of a sign or the patterns of a banner.

| Member                   | What it is                                                                       |
|--------------------------|----------------------------------------------------------------------------------|
| `string Id`              | The identifier of the block entity, such as `Chest`                              |
| `bool IsRemoved`         | Whether its block was replaced or its chunk unloaded; it changes nothing anymore |
| `BlockPosition Position` | The position of its block                                                        |
| `World World`            | The world                                                                        |

`Container`: a block that keeps items: a barrel, hopper, dispenser, dropper or shulker box, and the base of `Chest` and
`Furnace`.

| Member                          | What it is                                                                                                            |
|---------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `void CloseAll()`               | Closes it for every player who has it open                                                                            |
| `Text? CustomName`              | The title of its window (in the language of each player when translated), or null for the name of the block; settable |
| `ContainerInventory Inventory`  | Its slots                                                                                                             |
| `bool Open(Player player)`      | Opens it to a player, as `InventoryOpenEvent` decides; the screen the player had open closes                          |
| `IReadOnlyList<Player> Viewers` | The players who have it open, in a new list each time                                                                 |

`Chest`: A chest or trapped chest.

| Member                       | What it is                                                                                                       |
|------------------------------|------------------------------------------------------------------------------------------------------------------|
| `Chest? Pair`                | The other half of its double chest, or null when it is single or the other half is in a chunk that is not loaded |
| `bool PairWith(Chest other)` | The same as the overload of `Pair` that takes them                                                               |
| `bool Unpair()`              | Splits its double chest; each half keeps its items and closes for whoever had it open                            |

`Furnace`: A furnace, blast furnace or smoker: its ingredient, fuel and result.

| Member                   | What it is                                                             |
|--------------------------|------------------------------------------------------------------------|
| `int BurnDuration`       | The ticks the fuel burning burns in all                                |
| `int BurnTime`           | The ticks the fuel burning still burns; 0 when it is not lit           |
| `int CookDuration`       | The ticks one item takes: 200, or 100 for a blast furnace or a smoker  |
| `int CookTime`           | The ticks the item being smelted has cooked                            |
| `ItemStack Fuel`         | The fuel; settable                                                     |
| `ItemStack Input`        | What is to be smelted; settable                                        |
| `bool IsLit`             | Whether it burns                                                       |
| `ItemStack Output`       | The result, which players only take; settable                          |
| `string RecipeTag`       | The tag of its recipes: `furnace`, `blast_furnace` or `smoker`         |
| `float StoredExperience` | The experience of what it made, dropped when a player takes the result |

`Hopper`: A hopper: it pushes one item into the container it points at, and pulls one from the container above it or
picks up the items lying on it, then rests.

| Member                 | What it is                                       |
|------------------------|--------------------------------------------------|
| `int TransferCooldown` | The ticks it rests before it moves an item again |

`Sign`: A sign or a hanging sign: its two sides and whether it is waxed (players cannot edit it).

| Member                                       | What it is                                                                           |
|----------------------------------------------|--------------------------------------------------------------------------------------|
| `SignSide Back`                              | The back side                                                                        |
| `SignSide Front`                             | The front side, the one a player faces when placing it                               |
| `bool IsWaxed`                               | Whether it is waxed: players cannot edit it; settable                                |
| `bool OpenEditor(Player player, bool front)` | Opens the editor of one side to a player, as the game does for whoever places a sign |

`SignSide`: One side of a sign: its text (lines separated by \n), its color and whether it glows.

| Member           | What it is                                                   |
|------------------|--------------------------------------------------------------|
| `uint Color`     | The color of the text as ARGB; settable                      |
| `bool IsGlowing` | Whether the text glows (a glow ink sac); settable            |
| `Text Text`      | The text of the side: lines separated by new lines; settable |

`Banner`: A standing or wall banner: its base color and the patterns painted over it, bottom layer first.

| Member                                  | What it is                                                          |
|-----------------------------------------|---------------------------------------------------------------------|
| `DyeColor BaseColor`                    | The color of the cloth; settable                                    |
| `bool IsOminous`                        | Whether it is the banner of a raid; settable                        |
| `BannerLayers Layers`                   | The patterns, bottom layer first; the game draws up to 16; settable |
| `IReadOnlyList<BannerPattern> Patterns` | The patterns, bottom layer first; the game draws up to 16; settable |

`BannerPattern`: One layer of a banner: a pattern of the game in a color.

| Member                                          | What it is                                        |
|-------------------------------------------------|---------------------------------------------------|
| `BannerPattern(string pattern, DyeColor color)` | A new `BannerPattern`                             |
| `DyeColor Color`                                | The color                                         |
| `string Pattern`                                | The code of the pattern of the game, such as `bo` |

`BannerLayers`: The layers of a banner as plugins read and set them at once: its patterns, bottom layer first.

| Member                                                | What it is                       |
|-------------------------------------------------------|----------------------------------|
| `BannerLayers(IReadOnlyList<BannerPattern> patterns)` | A new `BannerLayers`             |
| `IReadOnlyList<BannerPattern> Patterns`               | The patterns, bottom layer first |

`Bell`: A bell: whether it is ringing, for how long, and which way it swings; the client draws it from this.

| Member                     | What it is                                             |
|----------------------------|--------------------------------------------------------|
| `int Direction`            | Which way it swings (south 0, west 1, north 2, east 3) |
| `bool IsRinging`           | Whether it is ringing                                  |
| `void Ring(int direction)` | Rings the bell, swinging one way                       |
| `int Ticks`                | The ticks it has been ringing                          |

`NoteBlock`: a note block: the note it plays, from 0 to 24.

| Member     | What it is                                             |
|------------|--------------------------------------------------------|
| `int Note` | The note, from 0 (F♯) to 24 (two octaves up); settable |

`Skull`: A skull or head: where a standing one faces and whether its mouth moves (dragon heads).

| Member               | What it is                                                                                            |
|----------------------|-------------------------------------------------------------------------------------------------------|
| `bool IsMouthMoving` | Whether the mouth moves, as a powered dragon head does; settable                                      |
| `float Rotation`     | Where a standing skull faces, in degrees (0 south, 90 west); wall skulls follow their block; settable |

`Bed`: A bed: its color.

| Member           | What it is                              |
|------------------|-----------------------------------------|
| `DyeColor Color` | The color; red when never set; settable |

`EnchantingTable`: An enchanting table: clients draw its book and open its window only where they know one, and show its
name there.

| Member             | What it is                                                                                                            |
|--------------------|-----------------------------------------------------------------------------------------------------------------------|
| `Text? CustomName` | The title of its window (in the language of each player when translated), or null for the name of the block; settable |

`Comparator`: A comparator: the level it gives, which its state does not show.

| Member             | What it is                                   |
|--------------------|----------------------------------------------|
| `int OutputSignal` | The level the comparator gives, from 0 to 15 |

`PistonArm`: A piston or sticky piston: where its head is, how far it moved (the client draws it from this), and the
blocks it is moving.

| Member                                        | What it is                                  |
|-----------------------------------------------|---------------------------------------------|
| `IReadOnlyList<BlockPosition> AttachedBlocks` | The moving blocks it moves, where they go   |
| `IReadOnlyList<BlockPosition> BreakBlocks`    | The blocks it broke when it started to move |
| `bool IsMoving`                               | Whether the head is moving                  |
| `float LastProgress`                          | How far out the head was the tick before    |
| `PistonArmState NewState`                     | Where the head goes                         |
| `float Progress`                              | How far out the head is, from 0 to 1        |
| `PistonArmState State`                        | Where the head is                           |

`MovingBlock`: A block a piston is moving (`minecraft:moving_block`): what it is, what its block entity held, and the
piston.

| Member                         | What it is                                                 |
|--------------------------------|------------------------------------------------------------|
| `bool IsExpanding`             | Whether the piston pushes it out rather than pulling it in |
| `BlockState MovingState`       | The block being moved                                      |
| `BlockPosition PistonPosition` | The piston that moves it                                   |

`RawBlockEntity`: A block entity the server does not know, kept as it was read.

| Member | What it is |
|--------|------------|

`ContainerInventory`: The slots of a container block (`Inventory`): saved with its chunk and shown to whoever has it
open.

| Member                | What it is                             |
|-----------------------|----------------------------------------|
| `Container Container` | The block entity whose slots these are |

`DyeColor`: The sixteen colors of the dyes, in the order of the game.

| Member          | What it is |
|-----------------|------------|
| `White = 0`     | White      |
| `Orange = 1`    | Orange     |
| `Magenta = 2`   | Magenta    |
| `LightBlue = 3` | Light blue |
| `Yellow = 4`    | Yellow     |
| `Lime = 5`      | Lime       |
| `Pink = 6`      | Pink       |
| `Gray = 7`      | Gray       |
| `LightGray = 8` | Light gray |
| `Cyan = 9`      | Cyan       |
| `Purple = 10`   | Purple     |
| `Blue = 11`     | Blue       |
| `Brown = 12`    | Brown      |
| `Green = 13`    | Green      |
| `Red = 14`      | Red        |
| `Black = 15`    | Black      |

`PistonArmState`: Where the head of a piston is.

| Member           | What it is |
|------------------|------------|
| `Retracted = 0`  | In         |
| `Extending = 1`  | Going out  |
| `Extended = 2`   | Out        |
| `Retracting = 3` | Coming in  |
