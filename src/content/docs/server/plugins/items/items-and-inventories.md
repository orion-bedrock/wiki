---
title: "Items and inventories"
description: "Orion server plugins: item stacks, enchanted and named items, inventories, armor and the offhand."
sidebar:
  order: 1
---

An `ItemStack` is items of one type in a slot: a diamond sword with a name and enchantments, 32 arrows. An `Inventory`
is slots that hold stacks: the inventory, armor and offhand of a player, the slots of a chest or a minecart, a menu of
your plugin. The types are in `Orion.Sdk.Server.Items` and `Orion.Sdk.Server.Inventories`.

## Item stacks

A stack is a value (a `struct`), like a number: you make one, change it with `With…` methods that give a new stack,
and put it in a slot. Changing a stack you read from an inventory changes nothing until you set it back.

```csharp
ItemStack sword = new ItemStack(ItemIds.DiamondSword)
    .WithName("§bExcalibur")
    .WithLore("A sword of legends.", "§7Soulbound")
    .WithEnchantment(EnchantmentIds.Sharpness, 5)
    .WithUnbreakable();

ItemStack arrows = new ItemStack(ItemIds.Arrow, 32);
ItemStack worn = new ItemStack(ItemIds.IronPickaxe).WithDamage(100);
ItemStack shiny = new ItemStack(ItemIds.Stick).WithGlint();

player.Inventory.Add(sword);
```

| Read                                 | What it is                                                                                 |
|--------------------------------------|--------------------------------------------------------------------------------------------|
| `Id`, `Count`                        | The item (`null` for the empty stack) and how many                                         |
| `IsEmpty`                            | Whether it is the stack of an empty slot, `ItemStack.Empty` (also `default`)               |
| `Damage`                             | How worn it is: 0 for a new item                                                           |
| `Name`, `Lore`                       | The name it shows instead of the one of its item (or `null`), and the lines under it       |
| `Enchantments`, `GetEnchantment(id)` | Its enchantments (`ItemEnchantment`: `Id`, `Level`), the level of one (0 when it has none) |
| `IsUnbreakable`, `HasGlint`          | Whether it never wears, whether it shines                                                  |
| `Block`                              | For a block item, the block state it places when it is not the default one, as text        |
| `Metadata`                           | The old auxiliary value of the item, 0 for most items                                      |

A stack read from Orion and given back unchanged is the same stack, whatever it carries that the SDK does not show (a
name translated by the server, data of another plugin). Two stacks compare by value (`==`); `IsStackableWith` tells
whether two stacks are the same items and can merge (all but the count equal).

`ItemIds` (namespace `Bedrock.Identifiers`) has the identifier of every item of the game, and `EnchantmentIds` those of
the enchantments. Items of your plugin are custom content ([Custom content](../../platform/custom-content/)); custom
enchantments go on a stack the same way, by their identifier.

## Item types

`GameServer.Current.Items` is the catalog of every item type:

```csharp
ItemType sword = GameServer.Current.Items.Find(ItemIds.DiamondSword)!;
int durability = sword.MaxDurability;                                   // how much it wears before it breaks
bool isSword = sword.HasTag("minecraft:is_sword");
ItemStack many = GameServer.Current.Items.Stack(ItemIds.Cobblestone, 64);

BlockState stone = GameServer.Current.Blocks.Find(BlockIds.Stone)!.DefaultState;
ItemType pickaxe = GameServer.Current.Items.Find(ItemIds.IronPickaxe)!;
bool drops = pickaxe.CanHarvest(stone);                                // mining stone with it drops it
float speed = pickaxe.GetMiningSpeed(stone);
```

## Inventories

Every inventory has the same members: read and set slots, add and remove items, count them. Slots are numbered from 0.

```csharp
PlayerInventory inventory = player.Inventory;                          // 36 slots: the hotbar is 0 to 8
ItemStack left = inventory.Add(new ItemStack(ItemIds.Bread, 16));     // what did not fit, or empty
if (!left.IsEmpty)
{
    player.World?.DropItem(left, player.Position);
}

int bread = inventory.Count(ItemIds.Bread);
if (inventory.Contains(ItemIds.Emerald, 5))
{
    inventory.Remove(ItemIds.Emerald, 5);                               // takes up to 5
    inventory.Add(new ItemStack(ItemIds.DiamondSword));
}

inventory.Set(0, new ItemStack(ItemIds.Compass).WithName("Servers"));
inventory.HeldSlot = 0;                                                // the slot of the hotbar it holds
ItemStack held = inventory.HeldItem;
```

| Inventory            | Of                                                                 | Its own members                                        |
|----------------------|--------------------------------------------------------------------|--------------------------------------------------------|
| `PlayerInventory`    | `player.Inventory`: 36 slots                                       | `HeldSlot`, `HeldItem` (settable)                      |
| `ArmorInventory`     | `player.Armor`: 4 slots                                            | `Helmet`, `Chestplate`, `Leggings`, `Boots` (settable) |
| `OffhandInventory`   | `player.Offhand`: 1 slot                                           | `Item` (settable)                                      |
| `ContainerInventory` | A chest, barrel, furnace… ([Block entities](../../worlds/block-entities/)) | `Container`: its block entity                          |
| `MinecartInventory`  | A chest or hopper minecart                                         | —                                                      |
| `Menu`               | A menu of the plugin ([Menus](../../player-ui/menus/))                        | Buttons, title, viewers                                |

```csharp
player.Armor.Helmet = new ItemStack(ItemIds.DiamondHelmet);
player.Offhand.Item = new ItemStack(ItemIds.Shield);
```

An armor slot takes only armor worn there, which Orion checks (`PluginException` otherwise). To keep or give back a
whole inventory at once, take a snapshot ([Inventory snapshots](../inventory-snapshots/)).

## Item events

| Event                                                                         | When                                                        | Cancel to                     |
|-------------------------------------------------------------------------------|-------------------------------------------------------------|-------------------------------|
| `ItemUseEvent`                                                                | A player uses the item it holds in the air                  | Do nothing                    |
| `ItemUseOnBlockEvent`                                                         | A player uses the item it holds on a block                  | Do nothing                    |
| `ItemReleaseEvent`                                                            | A player released an item it was charging (a bow)           | Not shoot                     |
| `ItemConsumeStartEvent`, `ItemConsumeEvent`                                   | A player starts, then finishes, eating or drinking          | Not eat                       |
| `ItemDropEvent`, `ItemPickupEvent`                                            | A player drops items, picks up an item lying in the world   | Keep the items where they are |
| `ItemWearEvent`                                                               | An item a player holds or wears is about to wear (`Amount`) | Not wear                      |
| `HeldItemChangeEvent`                                                         | A player selects another hotbar slot                        | Stay on the slot              |
| `ArmorEquipEvent`                                                             | A player puts armor on                                      | Keep it off                   |
| `InventoryOpenEvent`, `InventoryClickEvent`, `InventoryClosedEvent`           | A player opens a screen, moves items in it, closes it       | Not open; not move            |
| `ItemCraftEvent`, `ItemEnchantEvent`, `ItemAnvilEvent`, `ItemGrindstoneEvent` | Crafting, enchanting, an anvil, a grindstone                | Not make it                   |

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;

namespace Arena;

public sealed partial class KitRules : ServerPlugin
{
    // The compass of the lobby opens the server selector and can never be dropped or moved.
    [EventHandler]
    public static void OnUse(ItemUseEvent e)
    {
        if (e.Item.Id == ItemIds.Compass && e.Item.Name == "Servers")
        {
            e.Player.RunCommand("/servers");
            e.IsCanceled = true;
        }
    }

    [EventHandler]
    public static void OnDrop(ItemDropEvent e) => e.IsCanceled |= e.Item.Name == "Servers";

    [EventHandler]
    public static void OnClick(InventoryClickEvent e) => e.IsCanceled |= e.Item.Name == "Servers";

    // Golden apples feed more in the arena.
    [EventHandler]
    public static void OnEat(ItemConsumeEvent e)
    {
        if (e.Item.Id == ItemIds.GoldenApple && e.Player.World?.Name == "arena")
        {
            e.Nutrition += 4;
        }
    }
}
```

`InventoryClickEvent` comes once per action of a request of the client (`Action`: `Move`, `Swap`, `Drop`, `Destroy`,
`CreativeTake`), with the `Item` moved and the `SourceInventory` and `SourceSlot` it comes from; writable `Allowed`.

## Reference

`ItemStack` (a `struct`): items of one type in a slot, by value. Every `With…` gives a new stack.

| Member                                                       | What it is                                                                                       |
|--------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `string? Block`                                              | The block state a block item places, as text, when it is not the default one of its block        |
| `int Count`                                                  | How many items the stack holds                                                                   |
| `int Damage`                                                 | How worn the item is: 0 for a new one                                                            |
| `static ItemStack Empty`                                     | The stack of an empty slot                                                                       |
| `IReadOnlyList<ItemEnchantment> Enchantments`                | The enchantments of the stack                                                                    |
| `int GetEnchantment(string enchantmentId)`                   | The level of an enchantment of the stack                                                         |
| `bool HasGlint`                                              | Whether the item shines as an enchanted one does                                                 |
| `string? Id`                                                 | The identifier of the item, or `null` for the empty stack                                        |
| `bool IsEmpty`                                               | Whether the stack is the one of an empty slot                                                    |
| `bool IsStackableWith(ItemStack other)`                      | Tells whether two stacks hold the same items and can be one stack: all but the count is the same |
| `bool IsUnbreakable`                                         | Whether the item never wears                                                                     |
| `ItemStack(string id, int count = 1)`                        | A new `ItemStack`: items of a type                                                               |
| `IReadOnlyList<string> Lore`                                 | The lines shown under the name                                                                   |
| `int Metadata`                                               | The variant of the item in older data (its auxiliary value), 0 for most items                    |
| `string? Name`                                               | The name the stack shows instead of the one of its item, or `null`                               |
| `override string ToString()`                                 | A text of it, for logs                                                                           |
| `ItemStack WithCount(int count)`                             | The stack with another count                                                                     |
| `ItemStack WithDamage(int damage)`                           | The stack worn to another damage                                                                 |
| `ItemStack WithEnchantment(string enchantmentId, int level)` | The stack with an enchantment at a level; level 0 removes it                                     |
| `ItemStack WithGlint(bool glint = true)`                     | The stack shining as an enchanted one does, or not                                               |
| `ItemStack WithLore(params string[] lines)`                  | The stack with lines of lore; none removes them                                                  |
| `ItemStack WithName(string? name)`                           | The stack with a name of its own, or with the name of its item again                             |
| `ItemStack WithUnbreakable(bool unbreakable = true)`         | The stack of an item that never wears, or that wears again                                       |

`ItemEnchantment`: An enchantment of a stack: its identifier, such as `minecraft:sharpness`, and its level.

| Member | What it is |
|--------|------------|

`ItemCatalog` (`GameServer.Current.Items`): the item types of the server.

| Member                                  | What it is                                                                |
|-----------------------------------------|---------------------------------------------------------------------------|
| `static ItemStack Empty`                | The stack of an empty slot                                                |
| `ItemType? Find(string id)`             | Finds an item type by its identifier, for example minecraft:diamond_sword |
| `ItemStack Stack(string id, int count)` | Creates a stack of an item by its identifier                              |
| `IReadOnlyList<ItemType> Types`         | The item types in the order of the data                                   |

`ItemType`: an item type and its data.

| Member                                   | What it is                                                                                                                                                                                                          |
|------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `int AttackDamage`                       | The damage a hit with the item deals, in half hearts; 1 for items that are not weapons or tools                                                                                                                     |
| `bool CanHarvest(BlockState state)`      | Tells whether mining a block with the item drops it, as a pickaxe does stone                                                                                                                                        |
| `ItemStack CreateStack(int count)`       | Creates a stack of this item type, without components; minecraft:air gives Empty                                                                                                                                    |
| `float GetMiningSpeed(BlockState state)` | How fast the item mines a block: 1 by hand, higher for the right tool                                                                                                                                               |
| `bool HasTag(string tag)`                | Tells whether the item type has a tag, such as minecraft:is_sword                                                                                                                                                   |
| `string Id`                              | The identifier of the item type, for example minecraft:diamond_sword                                                                                                                                                |
| `bool IsBlock`                           | Whether the item places a block                                                                                                                                                                                     |
| `bool IsRepairedBy(ItemStack material)`  | Tells whether a material repairs the item at an anvil, a quarter of its durability each: iron ingots for iron tools and armor, planks for wooden ones, and so on for the items of the game; nothing for other items |
| `int MaxDurability`                      | How much the item wears before it breaks, or 0 for an item that does not wear                                                                                                                                       |
| `int MaxStackSize`                       | The most items of this type one stack holds                                                                                                                                                                         |

`Inventory` (abstract): slots that hold item stacks: the inventory, armor and offhand of a player, containers of blocks
and minecarts, menus.

| Member                                                      | What it is                                                                                  |
|-------------------------------------------------------------|---------------------------------------------------------------------------------------------|
| `ItemStack Add(ItemStack stack)`                            | Adds a stack: first onto the stacks it can merge with, then into empty slots, in slot order |
| `bool CanAdd(ItemStack stack)`                              | Tells whether a whole stack fits, merged and in empty slots, as Add would put it            |
| `void Clear()`                                              | Empties every slot                                                                          |
| `bool Contains(string itemId, int count)`                   | Tells whether the inventory holds at least a number of an item                              |
| `int Count(string itemId)`                                  | Counts the items of a type in the inventory                                                 |
| `int FirstEmpty()`                                          | The first empty slot                                                                        |
| `ItemStack Get(int slot)`                                   | The stack of a slot                                                                         |
| `int IndexOf(string itemId)`                                | The first slot with an item                                                                 |
| `bool IsEmpty`                                              | Whether every slot is empty                                                                 |
| `int Remove(string itemId, int count)`                      | Removes up to a number of items of a type                                                   |
| `ItemStack RemoveAt(int slot)`                              | Empties a slot                                                                              |
| `void Restore(InventorySnapshot snapshot)`                  | Puts back the stacks of a snapshot of an inventory of the same size                         |
| `void Set(int slot, ItemStack stack)`                       | Sets the stack of a slot                                                                    |
| `void SetRange(int start, InventorySnapshot stacks)`        | Sets slots from one on, in order, as one change                                             |
| `void SetRange(int start, IReadOnlyList<ItemStack> stacks)` | Sets slots from one on, in order, as one change                                             |
| `int Size`                                                  | The number of slots                                                                         |
| `InventorySnapshot Snapshot()`                              | Copies the stacks of every slot, as a value a plugin may keep                               |
| `void Swap(int first, int second)`                          | Swaps the stacks of two slots                                                               |
| `bool TryAdd(ItemStack stack)`                              | Adds a whole stack, as Add does, or nothing when it does not fit                            |

`PlayerInventory`: The 36 slots of a player: the hotbar (slots 0 to 8) and the rest of its inventory (9 to 35).

| Member               | What it is                                                             |
|----------------------|------------------------------------------------------------------------|
| `ItemStack HeldItem` | The stack in the held slot; settable                                   |
| `int HeldSlot`       | The hotbar slot the player holds; the client is told at once; settable |

`ArmorInventory`: The armor a player wears: one item in each of its four slots, each taking only armor worn there.

| Member                 | What it is               |
|------------------------|--------------------------|
| `ItemStack Boots`      | The boots; settable      |
| `ItemStack Chestplate` | The chestplate; settable |
| `ItemStack Helmet`     | The helmet; settable     |
| `ItemStack Leggings`   | The leggings; settable   |

`OffhandInventory`: The offhand of a player: one slot, held in its other hand.

| Member           | What it is                         |
|------------------|------------------------------------|
| `ItemStack Item` | The stack in the offhand; settable |

`MinecartInventory`: The slots of a chest or hopper minecart.

| Member | What it is |
|--------|------------|

`InventoryClickAction`: What a player does with the items of an inventory screen.

| Member             | What it is                                                              |
|--------------------|-------------------------------------------------------------------------|
| `Move = 0`         | Moves items from one slot to another, merging them with the items there |
| `Swap = 1`         | Swaps the stacks of two slots                                           |
| `Drop = 2`         | Drops items into the world                                              |
| `Destroy = 3`      | Destroys items (the trash of the creative inventory)                    |
| `CreativeTake = 4` | Takes items from the creative inventory                                 |

`ArmorEquipCause` (the `Cause` of `ArmorEquipEvent`): how a player puts armor on, or has it put on.

| Member          | What it is                                             |
|-----------------|--------------------------------------------------------|
| `Use = 0`       | It used the armor in the air                           |
| `Inventory = 1` | It moved the armor to its slot in the inventory screen |
| `Dispenser = 2` | A dispenser it stood in front of put the armor on it   |

`ItemWearCause` (the `Cause` of `ItemWearEvent`): why an item wears.

| Member            | What it is                                                             |
|-------------------|------------------------------------------------------------------------|
| `Plugin = 0`      | Code wore it                                                           |
| `BlockBroken = 1` | It broke a block                                                       |
| `Attack = 2`      | It hit an entity                                                       |
| `Use = 3`         | It was used, such as a hoe tilling or flint and steel lighting         |
| `Damaged = 4`     | It is armor that took part of a hit its wearer took                    |
| `Enchantment = 5` | An enchantment of it wore it, as thorns does when it hurts an attacker |
