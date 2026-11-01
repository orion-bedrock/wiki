---
title: "Inventory snapshots"
description: "Orion server plugins: saving everything a player carries and giving it back later."
sidebar:
  order: 2
---

A snapshot is a copy of the stacks of an inventory, or of everything a player carries, as a value your plugin keeps: in
memory for the length of a match, or as JSON in a file to give it back days later, after the server restarted. The
types are in `Orion.Sdk.Server.Inventories`.

## Save and give back what a player carries

`player.SnapshotInventory()` copies its inventory, armor, offhand, the stack under its cursor and its held slot;
`player.RestoreInventory(snapshot)` puts all of it back:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Inventories;
using Orion.Sdk.Server.Players;

namespace Arena;

public sealed class KitKeeper : ServerPlugin
{
    private readonly Dictionary<string, PlayerInventorySnapshot> _saved = [];

    // Before a match: keep what the player had, and empty its inventory for the kit of the arena.
    public void EnterArena(Player player)
    {
        _saved[player.Uuid] = player.SnapshotInventory();
        player.Inventory.Clear();
        player.Armor.Clear();
        player.Offhand.Clear();
    }

    // After the match: what it had comes back.
    public void LeaveArena(Player player)
    {
        if (_saved.Remove(player.Uuid, out PlayerInventorySnapshot? snapshot))
        {
            player.RestoreInventory(snapshot);
        }
    }
}
```

## Keep a snapshot in a file

`ToJson()` gives the JSON of a snapshot and `FromJson(json)` reads it back. Every stack is kept whole (names, lore,
enchantments and what else it carries), so a snapshot read back by another start of the server gives the same items:

```csharp
string path = Path.Combine(Context.DataDirectory, "inventories", player.Uuid + ".json");
Directory.CreateDirectory(Path.GetDirectoryName(path)!);
File.WriteAllText(path, player.SnapshotInventory().ToJson());

if (File.Exists(path))
{
    player.RestoreInventory(PlayerInventorySnapshot.FromJson(File.ReadAllText(path)));
}
```

A snapshot also fits in the data of an entity ([Keeping data](../../platform/persistence/)): `entity.Data.SetText("kit", json)`.

## Any inventory

Every `Inventory` (a chest, a minecart, a menu) takes and restores a snapshot of its slots, and sets a range of slots at
once:

```csharp
if (world.Blocks.GetEntity(new BlockPosition(0, 64, 0)) is Chest original &&
    world.Blocks.GetEntity(new BlockPosition(4, 64, 0)) is Chest copy)
{
    InventorySnapshot loot = original.Inventory.Snapshot();
    copy.Inventory.Restore(loot);                                      // an inventory of the same size
    player.Inventory.SetRange(9, loot.Stacks.Take(9).ToList());        // nine stacks from slot 9 on, as one change
}
```

`Restore` takes a snapshot of an inventory of the same size (`PluginException` otherwise). `SetRange(start, stacks)`
sets slots from `start` on in one change, from a list of stacks or from a snapshot.

## Reference

| Member                                                           | What it does                                                          |
|------------------------------------------------------------------|-----------------------------------------------------------------------|
| `Player.SnapshotInventory()`                                     | Copies everything the player carries into a `PlayerInventorySnapshot` |
| `Player.RestoreInventory(PlayerInventorySnapshot)`               | Puts back everything a snapshot holds                                 |
| `Inventory.Snapshot()`                                           | Copies the stacks of every slot into an `InventorySnapshot`           |
| `Inventory.Restore(InventorySnapshot)`                           | Puts back the stacks of a snapshot of an inventory of the same size   |
| `Inventory.SetRange(int start, InventorySnapshot stacks)`        | Sets slots from one on, in order, as one change                       |
| `Inventory.SetRange(int start, IReadOnlyList<ItemStack> stacks)` | The same, from a list                                                 |

`InventorySnapshot` (a record): the stacks of every slot of an inventory, as a value a plugin may store (a file, the
data of an entity) and give back to `Restore` later.

| Member                                               | What it is                                                                                       |
|------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| `static InventorySnapshot FromJson(string json)`     | Reads a snapshot from the JSON of ToJson                                                         |
| `InventorySnapshot(IReadOnlyList<ItemStack> stacks)` | A new `InventorySnapshot`                                                                        |
| `IReadOnlyList<ItemStack> Stacks`                    | The stacks of every slot, in order                                                               |
| `string ToJson()`                                    | The JSON of the snapshot, to store it (a file, data of an entity) and read it back with FromJson |

`PlayerInventorySnapshot`: Everything a player carries: its inventory, armor, offhand, the stack under its cursor and
its held slot.

| Member                                                                                                                                     | What it is                                                           |
|--------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|
| `InventorySnapshot Armor`                                                                                                                  | Its armor                                                            |
| `ItemStack Cursor`                                                                                                                         | The stack under its cursor                                           |
| `static PlayerInventorySnapshot FromJson(string json)`                                                                                     | Reads a snapshot from the JSON of ToJson                             |
| `int HeldSlot`                                                                                                                             | The hotbar slot it holds                                             |
| `InventorySnapshot Inventory`                                                                                                              | Its 36 slots                                                         |
| `InventorySnapshot Offhand`                                                                                                                | Its offhand                                                          |
| `PlayerInventorySnapshot(InventorySnapshot inventory, InventorySnapshot armor, InventorySnapshot offhand, ItemStack cursor, int heldSlot)` | A new `PlayerInventorySnapshot`                                      |
| `string ToJson()`                                                                                                                          | The JSON of the snapshot, to store it and read it back with FromJson |
