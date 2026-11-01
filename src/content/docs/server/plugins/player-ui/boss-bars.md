---
title: "Boss bars"
description: "Orion server plugins: boss bars."
sidebar:
  order: 4
---

A boss bar is the bar at the top of the screen: a title, how full it is, a color and notches. Plugins use them for
timers, the health of a boss, the progress of a round or an announcement. A bar is one object shared by the players it
is shown to. The types are in `Orion.Sdk.Server.BossBars`.

## Show a bar

```csharp
BossBar bar = BossBar.Create("Round 1", progress: 1, BossBarColor.Red, BossBarOverlay.Notched10);
bar.AddViewer(player);
bar.Progress = 0.5f;                                        // from 0 to 1
bar.Title = Text.Lang("arena::time_left", ("seconds", 30));  // in the language of each viewer
bar.Color = BossBarColor.Yellow;
bar.RemoveViewer(player);
bar.Dispose();                                              // hidden from everyone and released
```

A bar belongs to the plugin that created it. `Dispose` hides it from everyone; its members then throw
`PluginObjectGoneException`, and disposing again does nothing. The bars a plugin did not dispose are hidden and
released when it is disabled. A player sees every bar it was added to, one under the other, in the order they were
shown. Bars can be used from any thread.

## A bar with a timer, as a class

A class that owns its bar and its task keeps a timer in one place:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server.BossBars;
using Orion.Sdk.Server.Players;
using Orion.Sdk.Server.Scheduling;
using Orion.Sdk.Server.Worlds;

namespace Arena;

public sealed class RoundTimer : IDisposable
{
    private readonly BossBar _bar = BossBar.Create("Time left", 1, BossBarColor.Green, BossBarOverlay.Progress);
    private readonly ScheduledTask _task;
    private readonly int _total;
    private int _left;

    public RoundTimer(ServerScheduler scheduler, World world, int seconds)
    {
        _total = _left = seconds;
        foreach (Player player in world.Players)
        {
            _bar.AddViewer(player);
        }

        _task = scheduler.Every(20, _ => Tick(), world);
    }

    public void Dispose()
    {
        _task.Cancel();
        _bar.Dispose();
    }

    private void Tick()
    {
        _left = Math.Max(0, _left - 1);
        _bar.Progress = (float)_left / _total;
        _bar.Title = $"Time left: {_left / 60}:{_left % 60:00}";
        _bar.Color = _left < 30 ? BossBarColor.Red : BossBarColor.Green;
    }
}
```

## Reference

`BossBar` (`IDisposable`): a bar at the top of the screen that a plugin creates: its title plain or translated for each
player, shown to the players added to it.

| Member                                                                                          | What it is                                                                                                                          |
|-------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
| `bool AddViewer(Player player)`                                                                 | Shows it to a player                                                                                                                |
| `BossBarColor Color`                                                                            | Its color; settable                                                                                                                 |
| `static BossBar Create(Text title, float progress, BossBarColor color, BossBarOverlay overlay)` | Creates a boss bar of the plugin, shown to nobody yet; dispose it to hide and release it                                            |
| `void Dispose()`                                                                                | Hides the bar from everyone and releases it; afterwards its members throw `PluginObjectGoneException`. Disposing again does nothing |
| `bool IsViewer(Player player)`                                                                  | Tells whether a player sees it                                                                                                      |
| `BossBarOverlay Overlay`                                                                        | The notches drawn over it; settable                                                                                                 |
| `float Progress`                                                                                | How full it is, from 0 to 1; settable                                                                                               |
| `void RemoveAllViewers()`                                                                       | Hides it from everyone                                                                                                              |
| `bool RemoveViewer(Player player)`                                                              | Hides it from a player                                                                                                              |
| `Text Title`                                                                                    | The title; settable                                                                                                                 |
| `IReadOnlyList<Player> Viewers`                                                                 | The players who see it, at this moment                                                                                              |

`BossBarColor`: The color of a boss bar: `Pink`, `Blue`, `Red`, `Green`, `Yellow`, `Purple`, `RebeccaPurple`, `White`.

`BossBarOverlay`: The notches drawn over a boss bar: `Progress`, `Notched6`, `Notched10`, `Notched12`, `Notched20`.
