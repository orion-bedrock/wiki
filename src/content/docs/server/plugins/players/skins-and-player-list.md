---
title: "Skins and the player list"
description: "Orion server plugins: skins, and what each player sees in its player list."
sidebar:
  order: 3
---

A plugin makes skins from PNG images, puts them on players and human NPCs, and decides what each player sees in its
player list (the list of the pause menu): it hides players from it and adds entries of its own. The types are in
`Orion.Sdk.Server.Players`.

## Make a skin

`SkinFactory` makes a `Skin` from a PNG (its bytes or a file) or from raw RGBA pixels. A skin is 64×32, 64×64 or
128×128 pixels; `slim` gives it the thin arms of the Alex model.

```csharp
Skin guard = SkinFactory.LoadPng(Path.Combine(Context.DataDirectory, "skins", "guard.png"), slim: false);
Skin fromBytes = SkinFactory.FromPng(File.ReadAllBytes(Path.Combine(Context.DataDirectory, "skins", "alex.png")), slim: true);

byte[] pixels = new byte[64 * 64 * 4];             // four bytes a pixel, row by row
Array.Fill(pixels, (byte)255);
Skin white = SkinFactory.FromRgba(64, 64, pixels, slim: false);
```

A skin that is not one of those sizes, or a file that is not a PNG, throws `PluginException` with the reason. Use a skin
for a human NPC ([NPCs](../../entities/npcs/)) or give it to a player.

## Change the skin of a player

`player.Skin` is the skin it wears. `player.ChangeSkin(skin)` gives it another one, through `PlayerSkinChangeEvent`
(which a handler may cancel); every client that lists the player gets the new one.

```csharp
Skin disguise = SkinFactory.LoadPng(Path.Combine(Context.DataDirectory, "skins", "guard.png"), slim: false);
if (player.ChangeSkin(disguise))
{
    player.SendMessage("You are disguised as a guard.");
}
```

When a player logs in, `PlayerSkinEvent` comes with the skin it brought; `Problem` says what is wrong with it, if
anything (`null` when it is fine). Cancel the event, with a `RefusalMessage`, to refuse the player:

```csharp
[EventHandler]
public static void OnSkin(PlayerSkinEvent e)
{
    if (e.Problem is not null)
    {
        e.RefusalMessage = "Your skin could not be read: " + e.Problem;
        e.IsCanceled = true;
    }
}
```

## Hide players from a list

Each player has its own list (`player.ListView`): every player in the game, minus those hidden from it, plus the
entries plugins added.

```csharp
[EventHandler]
public static void OnJoin(PlayerJoinEvent e)
{
    foreach (Player other in GameServer.Current.Players)
    {
        if (other != e.Player && other.HasPermission("arena.staff"))
        {
            e.Player.ListView.Hide(other);            // staff stays out of the lists of others
        }
    }
}
```

A hidden player stays hidden until `Show`, or until either of the two leaves. The list only changes what the pause menu
shows: to make a player invisible in the world, see `Entity.HideFrom` ([Entities](../../entities/entities/)).

## Add entries of your own

`PlayerListEntry.Create(name, skin?)` makes an entry that is no player, such as a header or a bot of a minigame. Add it
to the lists you want; dispose it to remove it from every list:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Players;

namespace Arena;

public sealed partial class ListPlugin : ServerPlugin
{
    private PlayerListEntry? _header;

    public override void OnEnable() => _header = PlayerListEntry.Create("§6== Arena ==");

    [EventHandler]
    public void OnJoin(PlayerJoinEvent e) => e.Player.ListView.Add(_header!);

    public override void OnDisable() => _header?.Dispose();
}
```

The name of an entry is shown as it is (a `string`, not a translated `Text`). What the plugin did not dispose leaves
every list when the plugin is disabled.

`PlayerListedEvent` comes when a player that is about to enter its first world is added to the lists; cancel it to keep
the player out of the player lists.

## Reference

| Member of `Player`           | What it is                                                                                 |
|------------------------------|--------------------------------------------------------------------------------------------|
| `Skin Skin`                  | The skin it wears                                                                          |
| `bool ChangeSkin(Skin skin)` | Gives it another skin, through `PlayerSkinChangeEvent`; `false` when a handler canceled it |
| `PlayerListView ListView`    | What it sees in its player list                                                            |

| Event                   | What                                                                                         |
|-------------------------|----------------------------------------------------------------------------------------------|
| `PlayerSkinEvent`       | A player logged in with a skin: `Problem` (or `null`), writable `RefusalMessage`; cancelable |
| `PlayerSkinChangeEvent` | A player in the game is about to wear another skin (`ChangeSkin`); cancelable                |
| `PlayerListedEvent`     | A player about to enter its first world is listed; cancelable                                |

`Skin`: a skin, made by a plugin or worn by a player or a human NPC.

| Member        | What it is                         |
|---------------|------------------------------------|
| `int Height`  | The height of the image, in pixels |
| `string Id`   | The identifier of the skin         |
| `bool IsSlim` | Whether the arms are slim          |
| `int Width`   | The width of the image, in pixels  |

`SkinFactory`: Skins for human NPCs, from the bytes of a PNG, a PNG file or RGBA pixels: 64×32, 64×64 or 128×128.

| Member                                                                            | What it is                                           |
|-----------------------------------------------------------------------------------|------------------------------------------------------|
| `static Skin FromPng(ReadOnlySpan<byte> png, bool slim)`                          | A skin from the bytes of a PNG                       |
| `static Skin FromRgba(int width, int height, ReadOnlySpan<byte> rgba, bool slim)` | A skin from RGBA pixels, four bytes each, row by row |
| `static Skin LoadPng(string path, bool slim)`                                     | A skin from a PNG file                               |

`PlayerListView`: What one player sees in its player list (the pause menu): every player in the game, minus those hidden
from it, plus the items plugins add.

| Member                               | What it is                                                                |
|--------------------------------------|---------------------------------------------------------------------------|
| `bool Add(PlayerListEntry entry)`    | Adds an entry of a plugin to this list                                    |
| `void Hide(Player player)`           | Hides a player from this list, until `Show` or until either player leaves |
| `bool IsHidden(Player player)`       | Tells whether a player is hidden from this list                           |
| `bool Remove(PlayerListEntry entry)` | Removes an entry of a plugin from this list                               |
| `void Show(Player player)`           | Shows a player hidden with `Hide` again                                   |

`PlayerListEntry` (`IDisposable`): an entry a plugin adds to player lists: a name, shown as it is, with a skin and a
UUID of its own.

| Member                                                          | What it is                                                                                                                |
|-----------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `static PlayerListEntry Create(string name, Skin? skin = null)` | Creates an entry of the plugin, in no list yet (`player.ListView.Add(entry)`); dispose it to remove it from every list    |
| `void Dispose()`                                                | Removes the entry from every list; afterwards its members throw `PluginObjectGoneException`. Disposing again does nothing |
| `string Name`                                                   | The name shown                                                                                                            |
| `string Uuid`                                                   | The UUID of the entry, as text                                                                                            |
