---
title: "The HUD"
description: "Orion server plugins: titles, the action bar, notifications and hiding parts of the HUD."
sidebar:
  order: 3
---

`player.Hud` is what a player sees over the game besides its bars and boards: titles in the middle of the screen, the
text over the hotbar (the action bar), notifications at the top, and which parts of the screen are hidden. The types
are in `Orion.Sdk.Server.Hud`. Boss bars, sidebars and scoreboards have pages of their own
([Boss bars](../boss-bars/), [Sidebars and scoreboards](../scoreboards/)).

## Titles

```csharp
player.Hud.ShowTitle("Round 2", "Fight!", fadeInTicks: 10, stayTicks: 60, fadeOutTicks: 10);
player.Hud.ShowTitle(Text.Lang("arena::winner", ("player", winner.Name)), null, 10, 80, 20);
player.Hud.ClearTitle();
```

Times are in ticks (20 a second). The subtitle is optional (`null`).

## The action bar

```csharp
player.Hud.ShowActionBar("+10 coins");                        // a few seconds
player.Hud.PinActionBar($"Kills: {kills}  ·  Deaths: {deaths}");   // until it is unpinned
player.Hud.UnpinActionBar();
```

A pinned text stays over the hotbar until `UnpinActionBar` (`PinnedActionBar` is the one shown); `ShowActionBar` shows
a text for a few seconds over it. Pin again to change the pinned text: a scoreboard of the round in one line.

## Notifications

```csharp
player.Hud.ShowToast("Achievement", "You won your first round!");
```

## Hide parts of the screen

```csharp
player.Hud.Hide(HudElement.Hunger);
player.Hud.Hide(HudElement.Health);
if (player.Hud.IsHidden(HudElement.Hunger))
{
    player.Hud.Show(HudElement.Hunger);
}

player.Hud.HideAll();                                         // for a cinematic or a screenshot
player.Hud.ShowAll();
```

Every text of the HUD is a `Text`, shown in the language of the player. `player.Hud` can be used from any thread; the
player sees each change with the next tick of its world.

## Reference

`PlayerHud`: What a player sees over the game besides its bars and scoreboards: titles in the middle of the screen, the
text over the hotbar, notifications, and which parts of the HUD are hidden.

| Member                                                                                         | What it is                                                          |
|------------------------------------------------------------------------------------------------|---------------------------------------------------------------------|
| `void ClearTitle()`                                                                            | Hides the title and subtitle shown                                  |
| `void Hide(HudElement element)`                                                                | Hides a part of the screen                                          |
| `void HideAll()`                                                                               | Hides every part of the screen                                      |
| `bool IsHidden(HudElement element)`                                                            | Tells whether a part of the screen is hidden                        |
| `void PinActionBar(Text text)`                                                                 | Keeps a text over the hotbar until it is unpinned                   |
| `Text? PinnedActionBar`                                                                        | The text kept over the hotbar, or null                              |
| `void Show(HudElement element)`                                                                | Shows a part of the screen again                                    |
| `void ShowActionBar(Text text)`                                                                | Shows a text over the hotbar for a few seconds                      |
| `void ShowAll()`                                                                               | Shows every part of the screen again                                |
| `void ShowTitle(Text title, Text? subtitle, int fadeInTicks, int stayTicks, int fadeOutTicks)` | Shows a title in the middle of the screen, with a subtitle under it |
| `void ShowToast(Text title, Text message)`                                                     | Shows a notification at the top of the screen                       |
| `void UnpinActionBar()`                                                                        | Lets the pinned text go                                             |

`HudElement`: A part of the screen of a player.

| Member               | What it is                   |
|----------------------|------------------------------|
| `PaperDoll = 0`      | The player in the corner     |
| `Armor = 1`          | The armor bar                |
| `ToolTips = 2`       | The tips                     |
| `TouchControls = 3`  | The touch controls           |
| `Crosshair = 4`      | The crosshair                |
| `HotBar = 5`         | The hotbar                   |
| `Health = 6`         | The hearts                   |
| `ProgressBar = 7`    | The experience bar           |
| `Hunger = 8`         | The hunger bar               |
| `AirBubbles = 9`     | The air bubbles              |
| `HorseHealth = 10`   | The health of a ridden horse |
| `StatusEffects = 11` | The effects                  |
| `ItemText = 12`      | The name of the item held    |
