---
title: "Sidebars and scoreboards"
description: "Orion server plugins: sidebars, scoreboards and objectives."
sidebar:
  order: 5
---

Two kinds of boards show numbers and lines at the side of the screen:

| Kind         | What it is                                                                                               | Use it for                                        |
|--------------|----------------------------------------------------------------------------------------------------------|---------------------------------------------------|
| `Sidebar`    | Lines of text with a title, up to 15: you write each line                                                | The status of a round, server info, a lobby board |
| `Scoreboard` | Objectives with a score per player, entity or name, shown at the side, in the player list or below names | Kills, points, health below names, rankings       |

Both are shared by the players they are shown to, belong to the plugin that created them, and can be used from any
thread. A player sees one sidebar and one scoreboard at a time. The types are in `Orion.Sdk.Server.Scoreboards`.

## Sidebars

```csharp
Sidebar board = Sidebar.Create("§6§lARENA");
board.SetLines("Players: 8", "Round: 1", "", "play.example.com");     // every line at once
board.AddViewer(player);
board.SetLine(1, "Round: 2");                                          // only that line is sent
board.SetLine(2, null);                                                // removes a line
board.Title = Text.Lang("arena::board_title");
board.Dispose();                                                       // hidden from everyone and released
```

Lines are numbered from the top, from 0 to `Sidebar.MaxLines - 1` (15 lines). Every line and the title are `Text`s,
shown in the language of each viewer: one sidebar serves players of every language.

### A sidebar of each player

When the lines differ for every player (its own coins, its own kills), `ShowPersonalSidebar` gives one player a
sidebar of its own:

```csharp
Sidebar mine = player.Scoreboards.ShowPersonalSidebar("Profile", $"Coins: {coins}", $"Rank: {rank}");
mine.SetLine(0, $"Coins: {coins + 10}");
```

Keep it to update its lines, and dispose it when the player no longer needs it.

### A sidebar as a class

```csharp
using Orion.Sdk.Server.Players;
using Orion.Sdk.Server.Scoreboards;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public sealed class ArenaBoard(World arena) : IDisposable
{
    private readonly Sidebar _sidebar = Sidebar.Create("§c§lARENA");

    public void Show(Player player) => _sidebar.AddViewer(player);

    public void Refresh(int round, int secondsLeft) => _sidebar.SetLines(
        $"Round {round}",
        $"Time: {secondsLeft / 60}:{secondsLeft % 60:00}",
        $"Alive: {arena.Players.Count}");

    public void Dispose() => _sidebar.Dispose();
}
```

## Scoreboards and objectives

```csharp
Scoreboard board = Scoreboard.Create();
Objective kills = board.AddObjective("kills", Text.Lang("arena::kills"));
kills.SetScore(player, 3);                                  // a player, an entity or a name holds a score
kills.AddScore(player, 1);
kills.SetScore("Red team", 10);
board.Display(ScoreboardSlot.Sidebar, kills, ScoreSortOrder.Descending);
board.Display(ScoreboardSlot.BelowName, kills, ScoreSortOrder.Descending);
board.AddViewer(player);                                    // or player.Scoreboards.ShowScoreboard(board)

foreach ((ScoreHolder holder, int score) in kills.Scores)
{
    Context.Logger.LogInformation("{Holder}: {Score}", holder, score);
}
```

| `ScoreboardSlot` | Where the objective shows                                                                            |
|------------------|------------------------------------------------------------------------------------------------------|
| `Sidebar`        | At the side of the screen, highest first (`ScoreSortOrder.Descending`) or lowest first (`Ascending`) |
| `List`           | In the player list, beside each name                                                                 |
| `BelowName`      | Below the names of players                                                                           |

A `ScoreHolder` is a player, an entity (by its `UniqueId`) or a name that is no entity (a team, a line), which converts
from a `Player`, an `Entity` or a `string`, or is made with `ScoreHolder.Of(entity)` and `ScoreHolder.Named(text)`.

A `Sidebar` shows over the `Sidebar` slot of the scoreboard a player sees.

## Reference

`Sidebar`: Lines of text at the side of the screen, with a title.

| Member                                            | What it is                                                                                                                              |
|---------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|
| `bool AddViewer(Player player)`                   | Shows the sidebar to a player, in place of the one it saw                                                                               |
| `void Clear()`                                    | Removes every line                                                                                                                      |
| `static Sidebar Create(Text title)`               | Creates a sidebar of the plugin, shown to nobody yet; dispose it to hide and release it                                                 |
| `void Dispose()`                                  | Hides the sidebar from everyone and releases it; afterwards its members throw `PluginObjectGoneException`. Disposing again does nothing |
| `Text? GetLine(int line)`                         | A line, or null for none                                                                                                                |
| `bool IsViewer(Player player)`                    | Tells whether a player sees the sidebar                                                                                                 |
| `static int MaxLines`                             | The most lines a sidebar has                                                                                                            |
| `void RemoveAllViewers()`                         | Hides the sidebar from everyone                                                                                                         |
| `bool RemoveViewer(Player player)`                | Hides the sidebar from a player                                                                                                         |
| `void SetLine(int line, Text? text)`              | Sets a line, or removes it with null; only that line is sent                                                                            |
| `void SetLines(params ReadOnlySpan<Text?> lines)` | Sets every line at once: the first lines, the others removed (a `null` line is removed too)                                             |
| `Text Title`                                      | The title; settable                                                                                                                     |
| `IReadOnlyList<Player> Viewers`                   | The players that see the sidebar, at this moment                                                                                        |

`PlayerScoreboards`: The scoreboard and the sidebar a player sees: one of each at a time.

| Member                                                                      | What it is                                                                           |
|-----------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| `void HideAll()`                                                            | Hides the scoreboard and the sidebar the player sees                                 |
| `bool HideScoreboard(Scoreboard scoreboard)`                                | Hides a scoreboard from the player                                                   |
| `bool HideSidebar(Sidebar sidebar)`                                         | Hides a sidebar from the player                                                      |
| `Scoreboard? Scoreboard`                                                    | The scoreboard the player sees, or null                                              |
| `Sidebar ShowPersonalSidebar(Text title, params ReadOnlySpan<Text?> lines)` | Shows a sidebar of the plugin to the player alone; dispose it to hide and release it |
| `bool ShowScoreboard(Scoreboard scoreboard)`                                | Shows a scoreboard to the player, in place of the one it sees                        |
| `bool ShowSidebar(Sidebar sidebar)`                                         | Shows a sidebar to the player, in place of the one it sees                           |
| `Sidebar? Sidebar`                                                          | The sidebar the player sees, or null                                                 |

`Scoreboard`: Objectives and their scores, shown to the players added as viewers.

| Member                                                                         | What it is                                                                                                                                 |
|--------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------|
| `Objective AddObjective(string name, Text displayName)`                        | Adds an objective                                                                                                                          |
| `bool AddViewer(Player player)`                                                | Shows the scoreboard to a player, in place of the one it sees                                                                              |
| `void ClearDisplay(ScoreboardSlot slot)`                                       | Shows nothing in a slot                                                                                                                    |
| `static Scoreboard Create()`                                                   | Creates a scoreboard of the plugin, shown to nobody yet (AddViewer, or player.Scoreboards.ShowScoreboard)                                  |
| `void Display(ScoreboardSlot slot, Objective objective, ScoreSortOrder order)` | Shows an objective in a slot, in place of the one shown there                                                                              |
| `void Display(ScoreboardSlot slot, Objective objective)`                       | Shows an objective in a place of the screen, its highest score first                                                                       |
| `void Dispose()`                                                               | Hides the scoreboard from everyone and releases it; afterwards its members throw `PluginObjectGoneException`. Disposing again does nothing |
| `Objective? FindObjective(string name)`                                        | Finds an objective by name                                                                                                                 |
| `Objective? GetDisplayed(ScoreboardSlot slot)`                                 | The objective shown in a slot                                                                                                              |
| `bool IsViewer(Player player)`                                                 | Whether a player sees the scoreboard                                                                                                       |
| `IReadOnlyList<Objective> Objectives`                                          | The objectives, at this moment                                                                                                             |
| `void RemoveAllViewers()`                                                      | Hides the scoreboard from every player                                                                                                     |
| `bool RemoveObjective(Objective objective)`                                    | Removes an objective, with its scores and the slots that show it                                                                           |
| `bool RemoveViewer(Player player)`                                             | Hides the scoreboard from a player                                                                                                         |
| `IReadOnlyList<Player> Viewers`                                                | The players that see the scoreboard, at this moment                                                                                        |

`Objective`: An objective of a scoreboard: a title and the scores of its holders.

| Member                                                  | What it is                                                                   |
|---------------------------------------------------------|------------------------------------------------------------------------------|
| `int AddScore(ScoreHolder holder, int amount)`          | Adds to the score of a holder, from 0 when it has none                       |
| `void ClearScores()`                                    | Removes every score                                                          |
| `int Count`                                             | How many scores the objective has                                            |
| `Text DisplayName`                                      | The title shown over the scores, raw or translated for each viewer; settable |
| `int GetScore(ScoreHolder holder)`                      | The score of a holder                                                        |
| `bool HasScore(ScoreHolder holder)`                     | Tells whether a holder has a score                                           |
| `IReadOnlyList<(ScoreHolder Holder, int Score)> Scores` | The scores, at this moment: each holder with its score                       |
| `bool IsRemoved`                                        | Whether the objective was removed from its scoreboard                        |
| `string Name`                                           | The name, unique in its scoreboard                                           |
| `bool RemoveScore(ScoreHolder holder)`                  | Removes the score of a holder                                                |
| `Scoreboard Scoreboard`                                 | The scoreboard of the objective                                              |
| `void SetScore(ScoreHolder holder, int score)`          | Sets the score of a holder                                                   |

`ScoreHolder`: Who holds a score of an Objective: a player, an entity (by its unique ID) or a name that is no entity,
such as a team or a line, as a Text shown in the language of each viewer.

| Member                                                  | What it is                                                               |
|---------------------------------------------------------|--------------------------------------------------------------------------|
| `ScoreHolderKind Kind`                                  | Who holds the score                                                      |
| `Text? Name`                                            | The name, or `null` for a player or entity                               |
| `static ScoreHolder Named(Text name)`                   | Returns the holder of a name that is no entity                           |
| `static ScoreHolder Of(Entity entity)`                  | Returns the holder of the scores of a player or an entity                |
| `static implicit operator ScoreHolder?(Entity? entity)` | Converts a player or an entity to the holder of its scores               |
| `static implicit operator ScoreHolder?(string? name)`   | Converts a string to the holder of a name                                |
| `override string ToString()`                            | Returns the name, or the kind and unique ID, for logs                    |
| `long UniqueId`                                         | The unique ID of the player or entity (Entity.UniqueId), or 0 for a name |

`ScoreboardSlot`: Where an objective of a Scoreboard is shown.

| Member          | What it is                           |
|-----------------|--------------------------------------|
| `Sidebar = 0`   | At the side of the screen            |
| `List = 1`      | In the player list, beside each name |
| `BelowName = 2` | Below the names of players           |

`ScoreSortOrder`: The order of the scores of a shown objective.

| Member           | What it is              |
|------------------|-------------------------|
| `Descending = 0` | The highest score first |
| `Ascending = 1`  | The lowest score first  |

`ScoreHolderKind`: Who holds a score.

| Member       | What it is                               |
|--------------|------------------------------------------|
| `Player = 0` | A player, shown by its name              |
| `Entity = 1` | An entity that is not a player           |
| `Name = 2`   | A name that is no entity, shown as it is |
