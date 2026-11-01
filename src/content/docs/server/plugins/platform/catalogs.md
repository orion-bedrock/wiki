---
title: "Catalogs of the server"
description: "Orion server plugins: every block, item, entity type, effect, enchantment, potion, recipe and biome of the server."
sidebar:
  order: 2
---

`GameServer.Current` (namespace `Orion.Sdk.Server.Game`) is where a plugin starts: the players, the worlds, and the
catalogs of everything the server has, the game's and the custom content of every plugin. A catalog lists its entries
and finds one by identifier.

| Member of `GameServer`                       | Catalog                                                | Page                                                                                                     |
|----------------------------------------------|--------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `Blocks`                                     | `BlockCatalog`: block types and states                 | [Blocks](../../worlds/blocks/)                                                                                   |
| `Items`                                      | `ItemCatalog`: item types                              | [Items and inventories](../../items/items-and-inventories/)                                                     |
| `Entities`                                   | `EntityCatalog`: entity types                          | This page                                                                                                |
| `Effects`                                    | `EffectCatalog`: status effects                        | [Effects and potions](../../entities/effects/)                                                                                 |
| `Potions`                                    | `PotionCatalog`: potions                               | [Effects and potions](../../entities/effects/)                                                                                 |
| `Enchantments`                               | `EnchantmentCatalog`: enchantments                     | This page                                                                                                |
| `Recipes`                                    | `RecipeCatalog`: recipes, smelting and fuels           | This page                                                                                                |
| `Biomes`                                     | `BiomeCatalog`: biomes                                 | This page                                                                                                |
| `Creative`                                   | `CreativeInventory`: what the creative inventory shows | This page                                                                                                |
| `SoundIds`, `ParticleIds`, `CameraPresetIds` | Identifiers of sounds, particles and camera presets    | [Sounds and particles](../../player-ui/sounds-and-particles/), [Camera and cinematics](../../player-ui/camera-and-cinematics/) |

The catalogs are fixed once the server is built: content of plugins is described in `OnLoad`
([Custom content](../custom-content/)).

## Entity types

```csharp
EntityType? zombie = GameServer.Current.Entities.Find(EntityIds.Zombie);
if (zombie is { IsMob: true } && zombie.IsIn("undead"))
{
    Context.Logger.LogInformation("{Type}: {Width} x {Height}", zombie.Id, zombie.Width, zombie.Height);
}

foreach (EntityType type in GameServer.Current.Entities.Types.Where(t => t.IsCustom))
{
    Context.Logger.LogInformation("Custom entity: {Type}", type.Id);
}
```

`entity.Type` is the type of an entity. `IsIn(family)` tests the families of the game (`monster`, `undead`, `mob`…).

## Enchantments

```csharp
EnchantmentType sharpness = GameServer.Current.Enchantments.Find(EnchantmentIds.Sharpness)!;
ItemStack book = GameServer.Current.Enchantments.Book(sharpness, 5);           // an enchanted book of Sharpness V
ItemStack sword = new ItemStack(ItemIds.DiamondSword);
if (sharpness.CanEnchant(sword) && sharpness.MaxLevel >= 5)
{
    player.Inventory.Add(sword.WithEnchantment(sharpness.Id, 5));
}
```

`IsCompatibleWith(other)` tells whether two enchantments can be on one item, `IsTreasure` whether the enchanting table
never offers it, `IsCurse` whether a grindstone keeps it, and `DisplayName` the name of a custom one.

## Recipes

```csharp
RecipeCatalog recipes = GameServer.Current.Recipes;
if (recipes.Has("minecraft:stick"))
{
    IReadOnlyList<ItemStack> made = recipes.ResultsOf("minecraft:stick");    // 4 sticks
}

ItemStack? ingot = recipes.FindSmeltingResult("furnace", new ItemStack(ItemIds.RawIron));
int burn = recipes.BurnTicksOf(new ItemStack(ItemIds.Coal));                  // 1600
```

`Names` lists every recipe; the tags of `FindSmeltingResult` are `furnace`, `blast_furnace` and `smoker`.

## Biomes and the creative inventory

```csharp
Biome? plains = GameServer.Current.Biomes.Find(BiomeIds.Plains);
foreach (CreativeGroup group in GameServer.Current.Creative.Groups)
{
    Context.Logger.LogInformation("{Category} {Name}: {Count} items", group.Category, group.Name, group.ItemCount);
}
```

## The rest of GameServer

`GameServer.Current` exists from `OnEnable` on (it throws `InvalidOperationException` in `OnLoad`). Besides catalogs
it has the players ([Players](../../players/players/)), the worlds ([Worlds](../../worlds/worlds/)), the chat ([Chat](../../player-ui/chat/)),
`Capacity` (the most players at once; settable), `IsRunning` and `UnixTimeMilliseconds`, the clock of the game.

## Reference

`GameServer` (`GameServer.Current`): the game: its content, worlds and players.

| Member                                  | What it is                                                                                  |
|-----------------------------------------|---------------------------------------------------------------------------------------------|
| `BiomeCatalog Biomes`                   | The biomes of the game                                                                      |
| `BlockCatalog Blocks`                   | The block types and states                                                                  |
| `void Broadcast(Text message)`          | Shows a message in the chat of every player that spawned, plain or in the language of each  |
| `IReadOnlyList<string> CameraPresetIds` | The identifiers of the camera presets: those of the game, then those of plugins             |
| `int Capacity`                          | The most players in the game at once; MaxValue has no limit; settable                       |
| `ChatService Chat`                      | The chat: channels and the filters of plugins                                               |
| `CreativeInventory Creative`            | The creative inventory: the stacks players in creative mode take, by group                  |
| `static GameServer Current`             | The game; `InvalidOperationException` before `OnEnable`                                     |
| `World? DefaultWorld`                   | The world players join, or null before it is loaded                                         |
| `EffectCatalog Effects`                 | The status effects of the game and the custom ones of the server                            |
| `EnchantmentCatalog Enchantments`       | The enchantments of the game and the custom ones of the server                              |
| `EntityCatalog Entities`                | The entity types and the entity variants of the server                                      |
| `Player? FindPlayer(string name)`       | Finds a player in the game by name, ignoring case                                           |
| `Player? FindPlayerByUuid(string uuid)` | Finds a player by its UUID, such as 00000000-0000-0000-0000-000000000000                    |
| `Player? FindPlayerByXuid(string xuid)` | Finds a player by its Xbox user ID                                                          |
| `World? FindWorld(string name)`         | Finds a loaded world by name                                                                |
| `bool IsRunning`                        | Whether the game was started and not stopped                                                |
| `ItemCatalog Items`                     | The item types                                                                              |
| `IReadOnlyList<string> ParticleIds`     | The identifiers of the particle effects of the game, such as minecraft:basic_flame_particle |
| `int PlayerCount`                       | The number of players in the game                                                           |
| `IReadOnlyList<Player> Players`         | A copy of the players in the game                                                           |
| `PotionCatalog Potions`                 | The potions of the game                                                                     |
| `RecipeCatalog Recipes`                 | The recipes of the game                                                                     |
| `IReadOnlyList<string> SoundIds`        | The identifiers of the sounds of the game, such as random.click                             |
| `long UnixTimeMilliseconds`             | The time of the clock of the game, in milliseconds since 1970 (UTC)                         |
| `WorldManager WorldManager`             | The worlds                                                                                  |
| `IReadOnlyList<World> Worlds`           | A copy of the worlds that are loaded                                                        |

`EntityCatalog`: The entity types of a game and the variants of the server; frozen when the game is built.

| Member                            | What it is                                                         |
|-----------------------------------|--------------------------------------------------------------------|
| `EntityType? Find(string id)`     | Finds a type of entity by its identifier, such as minecraft:zombie |
| `IReadOnlyList<EntityType> Types` | Every entity type                                                  |

`EntityType`: An entity type of the game or a custom one: its data (box, health, families), its properties, how the
client draws it and the class its entities are.

| Member                     | What it is                                                                   |
|----------------------------|------------------------------------------------------------------------------|
| `float Height`             | The height of its box at scale 1, in blocks                                  |
| `string Id`                | The identifier, such as minecraft:zombie                                     |
| `bool IsCustom`            | Whether it is a custom type of the server rather than one of the game        |
| `bool IsIn(string family)` | Tells whether the type is of a family of the game, such as monster or undead |
| `bool IsMob`               | Whether it is a mob (family `mob`), whose entities are a `Mob`               |
| `bool IsPlayer`            | Whether it is the player, which is never spawned from code                   |
| `float Width`              | The width of its box at scale 1, in blocks                                   |

`EnchantmentCatalog`: The enchantments of a game (`game.Enchantments`): those of the game and the custom ones of the
server.

| Member                                                   | What it is                                                                 |
|----------------------------------------------------------|----------------------------------------------------------------------------|
| `IReadOnlyList<EnchantmentType> All`                     | Every enchantment                                                          |
| `ItemStack Book(EnchantmentType enchantment, int level)` | Makes an enchanted book of one enchantment, which an anvil puts on an item |
| `EnchantmentType? Find(string id)`                       | Finds an enchantment by its identifier, such as minecraft:sharpness        |

`EnchantmentType`: an enchantment: one of the game, or a custom one of a plugin.

| Member                                         | What it is                                                                                                                   |
|------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|
| `bool CanEnchant(ItemStack stack)`             | Tells whether the enchantment can go on an item: its kind is among the supported items, or it is a book                      |
| `Text DisplayName`                             | The name players read in the lore of an item with a custom enchantment; clients name the enchantments of the game themselves |
| `string Id`                                    | The identifier, such as minecraft:sharpness                                                                                  |
| `bool IsCompatibleWith(EnchantmentType other)` | Tells whether the enchantment can be on one item with another, such as sharpness with unbreaking                             |
| `bool IsCurse`                                 | Whether it is a curse, which a grindstone does not remove                                                                    |
| `bool IsCustom`                                | Whether it is a custom enchantment of the server, which clients do not know                                                  |
| `bool IsTreasure`                              | Whether the enchanting table never offers it                                                                                 |
| `int MaxLevel`                                 | The highest level it takes from the enchanting table, an anvil or a command                                                  |

`RecipeCatalog` (`GameServer.Current.Recipes`): the recipes of the game by name, such as `minecraft:stick`, with their
results, what furnaces make of a stack and how long a fuel burns.

| Member                                                       | What it is                                                                               |
|--------------------------------------------------------------|------------------------------------------------------------------------------------------|
| `int BurnTicksOf(ItemStack fuel)`                            | How long a stack burns in a furnace, per item: 1600 ticks for coal; 0 when it is no fuel |
| `int Count`                                                  | How many recipes the game has                                                            |
| `ItemStack? FindSmeltingResult(string tag, ItemStack input)` | What a block that smelts makes of a stack, as the game decides                           |
| `ItemStack GetResult(string name, int index)`                | One of the stacks a recipe makes                                                         |
| `bool Has(string name)`                                      | Tells whether the game has a recipe                                                      |
| `IReadOnlyList<string> Names`                                | The names of every recipe, such as minecraft:stick                                       |
| `int ResultCount(string name)`                               | How many stacks a recipe makes                                                           |
| `IReadOnlyList<Items.ItemStack> ResultsOf(string name)`      | The stacks a recipe makes                                                                |

`BiomeCatalog`: The biomes of a game (`game.Biomes`).

| Member                                  | What it is                                                             |
|-----------------------------------------|------------------------------------------------------------------------|
| `IReadOnlyList<Biome> All`              | Every biome                                                            |
| `Biome? Find(string id)`                | Finds a biome by its identifier, such as minecraft:plains              |
| `Biome? FindByNumericId(int numericId)` | Finds a biome by its numeric ID, the one world.Biomes reads and writes |

`Biome`: A biome of the game: what clients draw with it (the colors of grass, foliage and water, the sky and the fog)
and whether it rains or snows there.

| Member          | What it is                               |
|-----------------|------------------------------------------|
| `string Id`     | The identifier, such as minecraft:plains |
| `int NumericId` | The number chunks store for the biome    |

`CreativeInventory` (`GameServer.Current.Creative`): the creative inventory: groups of stacks in the order the client
shows them.

| Member                                | What it is                          |
|---------------------------------------|-------------------------------------|
| `int Count`                           | The number of stacks of every group |
| `IReadOnlyList<CreativeGroup> Groups` | The groups, in order                |

`CreativeGroup`: A group of the creative inventory: stacks the client folds under one icon and name, or shows one by
one.

| Member                           | What it is                                                      |
|----------------------------------|-----------------------------------------------------------------|
| `CreativeCategory Category`      | The tab of the group                                            |
| `ItemStack GetItem(int index)`   | One of the stacks the group shows                               |
| `ItemStack Icon`                 | The stack shown for a named group; Empty for an anonymous group |
| `int ItemCount`                  | How many stacks the group shows                                 |
| `IReadOnlyList<ItemStack> Items` | The stacks the group shows                                      |
| `string? Name`                   | The translation key of the name, or null for an anonymous group |
