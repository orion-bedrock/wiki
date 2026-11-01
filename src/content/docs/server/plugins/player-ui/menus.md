---
title: "Menus"
description: "Orion server plugins: chest menus with buttons, and menus with pages."
sidebar:
  order: 2
---

A menu is a chest screen (or a hopper, a dispenser, a double chest) whose items are buttons: a server selector, a
shop, a kit picker. Players click items instead of pressing form buttons, and see icons, names and lore. A menu is an
`Inventory` of the plugin, so it has every member of inventories too. The types are in `Orion.Sdk.Server.Menus`.

## Build and open a menu

```csharp
Menu selector = Menu.Create(MenuType.Chest)                                   // keep it, and Dispose it when done
    .WithTitle(Text.Lang("lobby::servers"))
    .Button(11, new ItemStack(ItemIds.DiamondSword).WithName("§cArena"), click => click.Player.RunCommand("/arena join"))
    .Button(15, new ItemStack(ItemIds.GrassBlock).WithName("§aSurvival"), click => click.Player.TransferToServer("survival.example.com", 19132))
    .OnClose(p => p.SendMessage("See you!"));
selector.Fill(new ItemStack(ItemIds.GrayStainedGlassPane).WithName(" "));   // the empty slots
selector.Open(player);
```

| `MenuType`    | Screen              | Slots |
|---------------|---------------------|-------|
| `Chest`       | Three rows of nine  | 27    |
| `DoubleChest` | Six rows of nine    | 54    |
| `Hopper`      | One row of five     | 5     |
| `Dispenser`   | Three rows of three | 9     |

A menu is read-only: players cannot take or put items, and a click on a button runs its action. `Editable()` lets
players move items as in a chest (buttons still only run). A menu belongs to the plugin until you dispose it, which
closes it for everyone; the menus a plugin keeps close when it is disabled. Keep a menu you show often (a selector) and
open it to each player; make one per player when its items depend on the player.

## Buttons: lambdas or named methods

The action of a button gets a `MenuClick`: the `Player`, the `Menu`, the `Slot`, the `Stack` it showed and how the
player clicked (`Action`). Lambdas suit short actions; named methods keep a big menu readable:

```csharp
using Bedrock.Identifiers;
using Orion.Sdk.Server.Items;
using Orion.Sdk.Server.Menus;
using Orion.Sdk.Server.Players;

namespace Lobby;

// A shop as a class: its menu, and a method per button.
public sealed class Shop : IDisposable
{
    private readonly Menu _menu;

    public Shop()
    {
        _menu = Menu.Create(MenuType.Hopper).WithTitle("Shop")
            .Button(0, new ItemStack(ItemIds.Bread, 8).WithLore("5 emeralds"), BuyBread)
            .Button(4, new ItemStack(ItemIds.Barrier).WithName("Close"), Close);
    }

    public void Open(Player player) => _menu.Open(player);

    public void Dispose() => _menu.Dispose();

    private static void BuyBread(MenuClick click)
    {
        Player player = click.Player;
        if (player.Inventory.Remove(ItemIds.Emerald, 5) == 5)
        {
            player.Inventory.Add(click.Stack.WithLore());
        }
        else
        {
            player.SendMessage("You need 5 emeralds.");
        }
    }

    private static void Close(MenuClick click) => click.Menu.Close(click.Player);
}
```

Taking items before checking is a simplification here: a real shop checks `Contains` first. A button action runs on the
thread of the world of the player; one that throws is a fault of the plugin, and the click does nothing.
`RemoveButton(slot)` turns a button back into a plain slot.

## Menus with pages

`PagedMenu` spreads entries over pages of a chest (18 a page) or a double chest (45 a page), with buttons that turn the
pages in its last row. Each player gets a menu of its own when you open one, which Orion releases once the player
closes it:

```csharp
PagedMenu warps = PagedMenu.Create(MenuType.DoubleChest)
    .WithTitle("Warps")
    .WithNavigation(new ItemStack(ItemIds.Arrow).WithName("Previous"), new ItemStack(ItemIds.Arrow).WithName("Next"),
        filler: new ItemStack(ItemIds.BlackStainedGlassPane).WithName(" "));
foreach (string name in new[] { "spawn", "arena", "shop", "farm" })
{
    warps.Add(new ItemStack(ItemIds.EnderPearl).WithName(name), click => click.Player.RunCommand("/warp " + name));
}

warps.Open(player, page: 0);
```

`Count` is the number of entries, `PageSize` how many fit a page and `PageCount` the pages.

## The menu a player has open

`player.OpenMenu` is the menu a player has open, or `null`. `InventoryOpenEvent` and `InventoryClosedEvent` come for
menus too, and `Viewers` are the players who have a menu open.

## Reference

`Menu` derives from `Inventory`: `Get`, `Set`, `Add`, `Remove`, `Clear`, `Count`, snapshots
([Items and inventories](../../items/items-and-inventories/)).

`Menu`: A screen of slots shown to players, whose items are buttons; an inventory of the plugin.

| Member                                                              | What it is                                                                                                                                                  |
|---------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `Menu Button(int slot, ItemStack stack, Action<MenuClick> onClick)` | Makes a slot a button: it shows a stack, and a click runs an action, on the thread of the world                                                             |
| `bool Close(Player player)`                                         | Closes the menu for a player                                                                                                                                |
| `void CloseAll()`                                                   | Closes the menu for every viewer it has now                                                                                                                 |
| `static Menu Create(MenuType type)`                                 | Creates a menu of the plugin, empty, read-only and without title                                                                                            |
| `void Dispose()`                                                    | Closes a menu of the plugin for every viewer and releases it in Orion; afterwards its members throw PluginObjectGoneException. Disposing again does nothing |
| `Menu Editable(bool editable = true)`                               | Lets players take and put items, as in a chest; buttons still only run                                                                                      |
| `Menu Fill(ItemStack stack)`                                        | Puts a stack in every empty slot, such as glass panes behind the buttons                                                                                    |
| `bool IsEditable`                                                   | Whether players may take and put items, as in a chest                                                                                                       |
| `Menu OnClose(Action<Player> onClose)`                              | Adds an action that runs when a viewer closes the menu, or it closes for that viewer                                                                        |
| `bool Open(Player player)`                                          | Opens the menu to a player, as `InventoryOpenEvent` decides; the screen it had open closes                                                                  |
| `bool RemoveButton(int slot)`                                       | Stops a slot from being a button, its stack kept; its callback goes                                                                                         |
| `void SetEditable(bool editable)`                                   | Lets players take and put items, as in a chest, or makes the menu read-only again                                                                           |
| `void SetTitle(Text title)`                                         | Sets the title, shown in the language of each viewer when it opens the menu                                                                                 |
| `Text? Title`                                                       | The title, or null for the name of the screen                                                                                                               |
| `MenuType Type`                                                     | The screen the menu opens as                                                                                                                                |
| `IReadOnlyList<Player> Viewers`                                     | The players who have the menu open, in a new list each time                                                                                                 |
| `Menu WithTitle(Text title)`                                        | Sets the title, shown in the language of each viewer when it opens the menu                                                                                 |

`PagedMenu`: Entries spread over pages of a chest or a double chest, with buttons that turn the pages: each player gets
a menu of its own when it opens one (`Open`), which Orion releases once it is closed.

| Member                                                                                     | What it is                                                                                       |
|--------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `PagedMenu Add(ItemStack stack, Action<MenuClick>? onClick = null)`                        | Adds an entry: a stack and, for a button, what its click does                                    |
| `int Count`                                                                                | The number of entries                                                                            |
| `static PagedMenu Create(MenuType type)`                                                   | Creates a paged menu                                                                             |
| `Menu? Open(Player player, int page = 0)`                                                  | Opens a page to a player, in a menu of its own that Orion releases once the player closed it     |
| `int PageCount`                                                                            | The number of pages, at least one                                                                |
| `int PageSize`                                                                             | The number of entries of a page: every row but the last                                          |
| `MenuType Type`                                                                            | The screen of its pages                                                                          |
| `PagedMenu WithNavigation(ItemStack previous, ItemStack next, ItemStack filler = default)` | Sets the buttons that turn the pages, at the ends of the last row, and what fills the rest of it |
| `PagedMenu WithTitle(Text title)`                                                          | Sets the title of every page                                                                     |

`MenuClick`: A click on a button of a menu; valid during the call of the button.

| Member                        | What it is                  |
|-------------------------------|-----------------------------|
| `InventoryClickAction Action` | How the player clicked      |
| `Menu Menu`                   | The menu                    |
| `Player Player`               | The player who clicked      |
| `int Slot`                    | The slot clicked            |
| `ItemStack Stack`             | The stack the button showed |

`MenuType`: The screen a Menu opens as, and its number of slots.

| Member            | What it is                                 |
|-------------------|--------------------------------------------|
| `Chest = 0`       | A chest: three rows of nine, 27 slots      |
| `DoubleChest = 1` | A double chest: six rows of nine, 54 slots |
| `Hopper = 2`      | A hopper: one row of five slots            |
| `Dispenser = 3`   | A dispenser: three rows of three, 9 slots  |
