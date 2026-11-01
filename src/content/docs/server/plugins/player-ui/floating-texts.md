---
title: "Floating texts"
description: "Orion server plugins: texts that float in a world, for everyone or for each player."
sidebar:
  order: 6
---

A floating text is a line of text that hangs in the air of a world: the name of a hub portal, a counter of players
online, the statistics of the player who looks at it, a leaderboard. Each one is shown in the language of each player
who sees it. The types are in `Orion.Sdk.Server.FloatingTexts`.

| Kind                    | Created with                                | Shows                                                |
|-------------------------|---------------------------------------------|------------------------------------------------------|
| `FloatingText`          | `world.FloatingTexts.Spawn(position, text)` | A text that stays as it is                           |
| `UpdatableFloatingText` | `SpawnUpdatable(position, text)`            | A text you change (`SetText`): a counter, a timer    |
| `PlayerFloatingText`    | `SpawnPerPlayer(position, function)`        | Its own text for each player, asked of your function |
| `StackedFloatingText`   | `SpawnStacked(top, lineSpacing, lines…)`    | Lines stacked from the top down, each one updatable  |

## Fixed and updatable texts

```csharp
FloatingText title = world.FloatingTexts.Spawn(new Vector3(0.5f, 66, 5.5f), Text.Lang("lobby::arena_portal"));
UpdatableFloatingText online = world.FloatingTexts.SpawnUpdatable(new Vector3(0.5f, 65.5f, 5.5f), "0 online");
Context.Scheduler.Every(20, _ => online.SetText($"{GameServer.Current.PlayerCount} online"), world);
```

Viewers get a new text at the end of the tick. Dispose a text to remove it; the texts a plugin did not remove go when it
is disabled.

## A text for each player

`SpawnPerPlayer` asks a function for the text of each player when it first sees it, and again every `RefreshTicks` (20
by default) or when you call `Refresh` or `RefreshFor(player)`. The function runs on the thread of the world; returning
`null` shows that player nothing.

**A lambda** for a short text:

```csharp
PlayerFloatingText stats = world.FloatingTexts.SpawnPerPlayer(new Vector3(-3.5f, 66, 2.5f),
    p => Text.Lang("lobby::coins", ("coins", p.Data.GetLong("lobby:coins", 0))));
stats.RefreshTicks = 100;                                   // every five seconds
```

**A method** of a class that holds the data:

```csharp
using Orion.Sdk.Server.FloatingTexts;
using Orion.Sdk.Server.Lang;
using Orion.Sdk.Server.Math;
using Orion.Sdk.Server.Players;
using Orion.Sdk.Server.Worlds;

namespace Lobby;

public sealed class StatsHologram : IDisposable
{
    private readonly Dictionary<string, int> _wins;
    private readonly PlayerFloatingText _text;

    public StatsHologram(World world, Vector3 position, Dictionary<string, int> wins)
    {
        _wins = wins;
        _text = world.FloatingTexts.SpawnPerPlayer(position, TextFor);
    }

    public void Changed(Player player) => _text.RefreshFor(player);

    public void Dispose() => _text.Dispose();

    private Text? TextFor(Player player) =>
        _wins.TryGetValue(player.Uuid, out int wins) ? $"§aYour wins: {wins}" : "§7Play a round to get on the board!";
}
```

A function that throws is a fault of the plugin, and that player sees no text.

## Stacks of lines

```csharp
StackedFloatingText top = world.FloatingTexts.SpawnStacked(new Vector3(10.5f, 68, 0.5f), 0.3f,
    "§6§lTOP PLAYERS", "1. Steve - 42", "2. Alex - 37", "3. Sam - 21");
top.Line(1).SetText("1. Alex - 43");                         // each line is an UpdatableFloatingText
top.Add("4. Kai - 20");
top.RemoveAt(4);
```

## Attach, move and choose who sees it

```csharp
FloatingText label = world.FloatingTexts.Spawn(mob.Position, "§eShopkeeper");
label.AttachTo(mob);                                          // follows it, above its head
label.AttachToBlock(new BlockPosition(0, 64, 0));             // stands on a block; goes when the block is broken
label.Detach();
label.Teleport(new Vector3(0.5f, 70, 0.5f));
label.ViewDistance = 32;                                      // blocks; 64 by default
label.ShowOnlyTo(player);                                     // HideFrom, ShowTo, HideFromEveryone, ShowToEveryone
```

`AttachTo` and `AttachToBlock` take an optional height (`FloatingText.DefaultEntityHeight` above a head,
`DefaultBlockHeight` above the bottom of a block). A text attached to an entity or a block is removed with it.

## Reference

`WorldFloatingTexts`: The floating texts of a world.

| Member                                                                                              | What it is                                                                                                                                                                                                     |
|-----------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `IReadOnlyList<FloatingText> All`                                                                   | The texts of the world, at this moment                                                                                                                                                                         |
| `int Count`                                                                                         | The number of texts of the world                                                                                                                                                                               |
| `FloatingText Spawn(Vector3 position, Text text)`                                                   | Spawns a text that keeps its text; dispose it to remove it                                                                                                                                                     |
| `PlayerFloatingText SpawnPerPlayer(Vector3 position, Func<Player, Text?> content)`                  | Spawns a text that shows each player its own text, asked of a function on the thread of the world when the player first sees it and every RefreshTicks (20 by default), or at Refresh; dispose it to remove it |
| `StackedFloatingText SpawnStacked(Vector3 top, float lineSpacing, params ReadOnlySpan<Text> lines)` | Spawns lines stacked from the top down, each one updatable; dispose the stack to remove it                                                                                                                     |
| `UpdatableFloatingText SpawnUpdatable(Vector3 position, Text text)`                                 | Spawns a text whose text changes, such as a counter (SetText); dispose it to remove it                                                                                                                         |

`FloatingText`: A text that floats in a world, shown in the language of each player who sees it.

| Member                                                  | What it is                                                                                                               |
|---------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `const float DefaultEntityHeight = 0.3f`                | How far above the head of an entity a text floats by default, in blocks                                                  |
| `const float DefaultBlockHeight = 1.3f`                 | How far above the bottom of a block a text floats by default, in blocks                                                  |
| `const float DefaultViewDistance = 64`                  | The distance players see a text from by default, in blocks                                                               |
| `BlockPosition AttachedBlock`                           | The block it stands on; the origin when it stands on none                                                                |
| `Entity? AttachedEntity`                                | The entity it follows, or null                                                                                           |
| `void AttachTo(Entity entity, float height)`            | Makes it follow an entity, a height above its head                                                                       |
| `void AttachTo(Entity entity)`                          | Makes it follow an entity, DefaultEntityHeight above its head                                                            |
| `void AttachToBlock(BlockPosition block, float height)` | Makes it stand on a block, a height above its bottom; it goes when the block is broken                                   |
| `void AttachToBlock(BlockPosition block)`               | Makes it stand on a block, DefaultBlockHeight above its bottom; it goes when the block is broken                         |
| `void Detach()`                                         | Stops following what it was attached to; it stays where it is                                                            |
| `void Dispose()`                                        | Removes the text and releases it; afterwards its members throw `PluginObjectGoneException`. Disposing again does nothing |
| `void HideFrom(Player player)`                          | Hides it from a player, until ShowTo                                                                                     |
| `void HideFromEveryone()`                               | Hides it from every player, until it is shown to some                                                                    |
| `bool IsOnBlock`                                        | Whether it stands on a block                                                                                             |
| `bool IsRemoved`                                        | Whether it was removed, by Remove, what it was attached to, or its world                                                 |
| `bool IsVisibleTo(Player player)`                       | Tells whether its audience lets a player see it, wherever the player is                                                  |
| `Vector3 Position`                                      | Where it floats                                                                                                          |
| `void Remove()`                                         | Removes the text; the same as Dispose()                                                                                  |
| `void ShowOnlyTo(params ReadOnlySpan<Player> players)`  | Shows it to these players only                                                                                           |
| `void ShowTo(Player player)`                            | Shows it to a player again; when it is shown only to some players, the player joins them                                 |
| `void ShowToEveryone()`                                 | Shows it to every player again, as when it was spawned                                                                   |
| `void Teleport(Vector3 position)`                       | Moves it, and stops following what it was attached to                                                                    |
| `Text Text`                                             | The text: plain, or a key of the translations, shown in the language of each player                                      |
| `float ViewDistance`                                    | How far players see it, in blocks; settable                                                                              |
| `IReadOnlyList<Player> Viewers`                         | The players who see it now                                                                                               |
| `World World`                                           | The world it floats in                                                                                                   |

`UpdatableFloatingText`: A floating text whose text changes, such as a counter.

| Member                    | What it is                                                                      |
|---------------------------|---------------------------------------------------------------------------------|
| `void SetText(Text text)` | Changes the text; the players who see it get the new one at the end of the tick |

`PlayerFloatingText`: A floating text that shows each player its own text, asked of the plugin.

| Member                           | What it is                                                                                |
|----------------------------------|-------------------------------------------------------------------------------------------|
| `void Refresh()`                 | Asks the text of every player who sees it again, at the end of the tick                   |
| `void RefreshFor(Player player)` | Asks the text of one player again, at the end of the tick                                 |
| `int RefreshTicks`               | How many ticks pass between two askings of the text of every player who sees it; settable |

`StackedFloatingText`: Lines of floating text stacked from the top down, each one updatable.

| Member                                                  | What it is                                                                                         |
|---------------------------------------------------------|----------------------------------------------------------------------------------------------------|
| `UpdatableFloatingText Add(Text text)`                  | Adds a line at the bottom                                                                          |
| `Entity? AttachedEntity`                                | The entity it follows, or null                                                                     |
| `void AttachTo(Entity entity, float height)`            | Makes the stack follow an entity, its bottom line a height above its head                          |
| `void AttachTo(Entity entity)`                          | Makes the stack follow an entity, its bottom line DefaultEntityHeight above its head               |
| `void AttachToBlock(BlockPosition block, float height)` | Makes the stack stand on a block, its bottom line a height above the bottom of the block           |
| `void AttachToBlock(BlockPosition block)`               | Makes the stack stand on a block, its bottom line DefaultBlockHeight above the bottom of the block |
| `int Count`                                             | The number of lines                                                                                |
| `void Dispose()`                                        | Removes the stack and releases it. Disposing again does nothing                                    |
| `void HideFrom(Player player)`                          | Hides every line from a player                                                                     |
| `void HideFromEveryone()`                               | Hides every line from every player, until the stack is shown to some                               |
| `UpdatableFloatingText Insert(int index, Text text)`    | Inserts a line; the lines below it move down                                                       |
| `bool IsRemoved`                                        | Whether it was removed, by Remove or with what it was attached to                                  |
| `UpdatableFloatingText Line(int index)`                 | A line                                                                                             |
| `IReadOnlyList<UpdatableFloatingText> Lines`            | The lines, from the top down                                                                       |
| `float LineSpacing`                                     | The gap from one line to the next, in blocks                                                       |
| `Vector3 Position`                                      | Where the top line floats                                                                          |
| `void RemoveAt(int index)`                              | Removes a line; the lines below it move up                                                         |
| `void ShowOnlyTo(params ReadOnlySpan<Player> players)`  | Shows every line to these players only                                                             |
| `void ShowTo(Player player)`                            | Shows every line to a player again                                                                 |
| `void ShowToEveryone()`                                 | Shows every line to every player again                                                             |
| `void Teleport(Vector3 top)`                            | Moves the stack, with its top line at a position, and stops following what it was attached to      |
