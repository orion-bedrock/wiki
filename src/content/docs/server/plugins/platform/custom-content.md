---
title: "Custom content"
description: "Orion server plugins: items, blocks, mobs, effects, enchantments, recipes, fuels, patterns and camera presets of your own."
sidebar:
  order: 1
---

A plugin adds content of its own to the game: items, blocks, mobs, status effects, enchantments, recipes, fuels,
patterns of blocks and camera presets. Players see them as if they were part of the game: the server builds one
resource pack of the textures, models and names of every plugin and offers it to every player who joins. The types are
in `Orion.Sdk.Server.Content`; `samples/Gems` in the repository is a complete example.

## Describe content in OnLoad

Content is described in `OnLoad`, before the server builds its game, through `Context.Content`; afterwards it throws
`InvalidOperationException`. Each call describes one piece, which Orion checks at once: files it names, values,
identifiers.

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Ai;
using Orion.Sdk.Server.Content;
using Orion.Sdk.Server.Effects;
using Orion.Sdk.Server.Entities;

[assembly: OrionPlugin(typeof(Gems.GemsPlugin))]

namespace Gems;

public sealed class GemsPlugin : ServerPlugin
{
    public override void OnLoad() => Context.Content
        .Item("gems:ruby", item => item
            .Name("Ruby").Name("es_MX", "Rubí")
            .Texture("textures/ruby.png")
            .Creative(CreativeCategory.Items)
            .Tags("gems:gems"))
        .Block("gems:ruby_ore", block => block
            .Name("Ruby Ore")
            .Texture("textures/ruby_ore.png")
            .DestroyTime(3).ExplosionResistance(3)
            .Tool(ToolKind.Pickaxe, harvestLevel: 2, required: true)
            .Drops("gems:ruby")
            .Creative(CreativeCategory.Nature))
        .Effect("gems:sparkle", effect => effect
            .Kind(EffectKind.Beneficial)
            .Swirls("minecraft:regeneration")
            .OnTick(40, (entity, level) => entity.Heal(level)))
        .Enchantment("gems:lifesteal", enchantment => enchantment
            .Name("Lifesteal")
            .MaxLevel(3).Weight(2)
            .Items(EnchantableItems.Sword)
            .OnAttack((attacker, target, level) => attacker.Heal(level)))
        .Entity("gems:ruby_golem", entity => entity
            .Name("Ruby Golem")
            .Geometry("models/ruby_golem.geo.json")
            .Texture("textures/ruby_golem.png")
            .Size(1.4f, 2.7f).Health(40).MovementSpeed(0.2f)
            .OnSpawn(golem => ((Mob)golem).Goals.Add(1, GoalFactory.Wander((Mob)golem, 1, 120))))
        .ShapedRecipe("gems:ruby_block", ["###", "###", "###"], new Dictionary<char, string> { ['#'] = "gems:ruby" }, "gems:ruby_block")
        .ShapelessRecipe("gems:ruby_from_block", ["gems:ruby_block"], "gems:ruby", count: 9)
        .SmeltingRecipe("gems:ruby_from_ore", "gems:ruby_ore", "gems:ruby", experience: 1, SmeltingStations.Furnace | SmeltingStations.BlastFurnace)
        .Block("gems:ruby_block", block => block.Name("Block of Ruby").Texture("textures/ruby_block.png").DestroyTime(5));
}
```

| Rule        | What                                                                                                                                  |
|-------------|---------------------------------------------------------------------------------------------------------------------------------------|
| Identifiers | `namespace:path` in lowercase, not of the namespace `minecraft`: use the id of your plugin (`gems:ruby`)                              |
| Files       | Paths in the folder of the plugin (`plugins/<id>/textures/ruby.png`), read when the piece is described                                |
| Names       | `Name(text)` for every language, `Name(locale, text)` for one; the words of the identifier by default (`gems:ruby_ore` is "Ruby Ore") |
| Uniqueness  | Two plugins cannot add the same identifier; the plugin that loads second fails                                                        |

Install the files next to `plugin.json`: `textures/`, `models/` and the rest of what your content names
([Getting started](../../basics/getting-started/)).

## Items

```csharp
Context.Content
    .Item("arena:flag", item => item.Name("Flag").Texture("textures/flag.png").MaxStackSize(1).Glint())
    .Item("arena:dagger", item => item.Name("Dagger").Texture("textures/dagger.png").Weapon(damage: 5, durability: 250))
    .Item("arena:drill", item => item.Texture("textures/drill.png").Tool(ToolKind.Pickaxe, durability: 1000, miningSpeed: 12, harvestLevel: 3))
    .Item("arena:visor", item => item.Texture("textures/visor.png").Armor(ArmorSlot.Head, defense: 3, durability: 300))
    .Item("arena:burger", item => item.Texture("textures/burger.png").Food(nutrition: 8, saturation: 0.8f))
    .Item("arena:grenade", item => item.Texture("textures/grenade.png").Throwable("minecraft:snowball", power: 1.2f));
```

An item is of one kind at most: `Tool`, `Weapon`, `Armor`, `Food` or `Throwable`. `Texture` is required: a PNG of 16 by
16 pixels. What an item does beyond its kind goes through the events, by its identifier:

```csharp
[EventHandler]
public static void OnUse(ItemUseEvent e)
{
    if (e.Item.Id == "arena:flag")
    {
        e.Player.SendMessage("You raise the flag!");
    }
}
```

Give one with `new ItemStack("arena:flag")` like any item ([Items and inventories](../../items/items-and-inventories/)).

## Blocks

A block gets an item of the same identifier that places it. `Texture` (one for every face, or one per `BlockFace`) is
required; `Geometry` gives it a model (a `.geo.json` file, as model editors export it) instead of a cube.

```csharp
Context.Content.Block("arena:crystal", block => block
    .Name("Crystal")
    .Texture("textures/crystal.png")
    .Texture(BlockFace.Up, "textures/crystal_top.png")
    .RenderMethod(BlockRenderMethod.Blend)
    .Light(12)
    .DestroyTime(1.5f)
    .Friction(0.02f)                                          // as slippery as ice
    .CollisionBox(new Vector3(2, 0, 2), new Vector3(14, 12, 14))   // in pixels of the block, 0 to 16
    .NoDrops()
    .Creative(CreativeCategory.Construction));
```

Blocks have no states yet. Read and react to them by identifier: `e.State.Id == "arena:crystal"` in `BlockBreakEvent`.

## Mobs and other entities

An entity type spawns like any other (`world.Entities.Spawn("gems:ruby_golem", …)`) and appears in `/summon`. With the
family `mob` (the default) it is a `Mob` that takes goals; `OnSpawn` runs for every entity of the type that spawns or
loads, on the thread of its world: the place to give it its goals ([AI and goals](../../entities/ai-and-goals/)).

```csharp
Context.Content.Entity("arena:guard", entity => entity
    .Name("Arena Guard")
    .Geometry("models/guard.geo.json")
    .Texture("textures/guard.png")
    .Size(0.6f, 1.9f)
    .Health(30)
    .Families("mob", "monster")
    .NotSummonable()
    .OnSpawn(GiveGoals));

static void GiveGoals(Entity entity)
{
    if (entity is Mob guard)
    {
        guard.Goals.Add(1, GoalFactory.MeleeAttack(guard, 1.2f, 20));
        guard.Targets.Add(1, GoalFactory.NearestTarget(guard, 16, "minecraft:player", mustSee: true));
    }
}
```

`Geometry` and `Texture` are required. Entities have no animations yet.

## Status effects

A custom effect is given like any other (`entity.Effects.Add("gems:sparkle", ticks, amplifier, true)`). Clients only
know the effects of the game: a custom effect shows no icon, and borrows the swirls of an effect of the game (`Swirls`).
Its callbacks receive the entity and the level of the effect (the amplifier plus 1):

```csharp
Context.Content.Effect("arena:bleeding", effect => effect
    .Kind(EffectKind.Harmful)
    .Swirls("minecraft:wither")
    .OnApplied((entity, level) => entity.NameTag = "§cBleeding")
    .OnTick(20, (entity, level) => entity.Damage(level, DamageCause.Magic, null))
    .OnRemoved((entity, level, reason) => entity.NameTag = null));
```

## Enchantments

Clients do not know custom enchantments either: an item shows one as a line of its lore, with the shine of an enchanted
item. The enchanting table and anvils treat it as one of the game.

```csharp
Context.Content.Enchantment("arena:vampire", enchantment => enchantment
    .Name("Vampire")
    .MaxLevel(3).Weight(1)
    .Items(EnchantableItems.Sword | EnchantableItems.Axe)
    .IncompatibleWith("minecraft:fire_aspect")
    .Treasure()
    .AttackDamage((attacker, target, level) => level * 0.5f)                  // extra damage of a hit
    .OnAttack((attacker, target, level) => attacker.Heal(level))               // after a hit hurt its target
    .Protection((holder, cause, level) => cause == DamageCause.Fire ? level : 0)   // points of protection
    .OnHolderDamaged((holder, cause, amount, level) => { }));                  // after the holder was hurt
```

Put it on a stack with `stack.WithEnchantment("arena:vampire", 2)`, as any enchantment.

## Recipes and fuels

```csharp
Context.Content
    .ShapedRecipe("arena:flag", ["W", "S", "S"], new Dictionary<char, string> { ['W'] = "#minecraft:wool", ['S'] = "minecraft:stick" }, "arena:flag")
    .ShapelessRecipe("arena:burger", ["minecraft:bread", "minecraft:cooked_beef"], "arena:burger")
    .SmeltingRecipe("arena:glass_crystal", "minecraft:glass", "arena:crystal", experience: 0.5f, SmeltingStations.Furnace)
    .RemoveRecipe("minecraft:tnt")
    .Fuel("arena:burger", 0)                                  // 0: not a fuel
    .Fuel("#minecraft:planks", 400);
```

| Member                                                    | What it adds                                                                                                                                                                                    |
|-----------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `ShapedRecipe(id, pattern, key, result, count)`           | A recipe of the crafting table: one to three rows of one to three characters, a space for an empty cell; it also matches mirrored, and one of 2×2 or smaller works in the grid of the inventory |
| `ShapelessRecipe(id, ingredients, result, count)`         | One to nine ingredients, in any place                                                                                                                                                           |
| `SmeltingRecipe(id, input, result, experience, stations)` | What furnaces, blast furnaces or smokers make of an item (`SmeltingStations`, flags)                                                                                                            |
| `RemoveRecipe(id)`                                        | Removes a recipe of the game from every world; for some worlds only, see `World.ExceptRecipes`                                                                                                  |
| `Fuel(item, burnTicks)`                                   | How long an item burns: 1600 ticks for coal, 300 for wood; 0 makes it no fuel                                                                                                                   |

An ingredient is an item identifier, or `#` and an item tag for any item of the tag. A recipe with the identifier of
one of the game replaces it. A recipe that names an item the game does not have stops the server from starting, with
the name of the recipe and the item.

## Patterns and camera presets

Patterns of blocks (`Pattern`, `Frame`) are in [Block batches, copies and patterns](../../worlds/block-batches-and-patterns/), camera
presets (`CameraPreset`) in [Camera and cinematics](../../player-ui/camera-and-cinematics/).

## Callbacks: lambdas or methods

Every callback (`OnSpawn`, `OnApplied`, `OnTick`, `OnRemoved`, `AttackDamage`, `OnAttack`, `Protection`,
`OnHolderDamaged`) is a delegate: a lambda for one line, a method for more, or a method of an object that holds state.

| What the callback does | When it runs                                                                                          |
|------------------------|-------------------------------------------------------------------------------------------------------|
| All of them            | From `OnEnable` on, on the thread of the world of the entity                                          |
| One throws             | A fault of the plugin; the game goes on as if there were no callback (no damage added, no protection) |
| The plugin is disabled | The callbacks stop; the content stays registered until the server restarts                            |

## Resource packs of the plugin

What the builders do not cover (sounds, particles, animations) goes in resource packs the plugin ships in its `packs`
folder (folders, `.mcpack` or `.zip`). The server offers them after the pack it builds, in the order of the plugins.
The pack the server builds keeps its files under folders of the id of each plugin and uses the identifiers of the content as
keys: keep the files and keys of your packs to names of your own, or they conflict with it.

## When content is refused

| What goes wrong                                                                                                  | What happens                                                          |
|------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| A mistake plain from the call: an identifier without `:`, no texture                                             | The SDK throws `ArgumentException` or `ArgumentOutOfRangeException`   |
| A file that is missing or not a PNG, a value Orion refuses, the namespace `minecraft`, an identifier given twice | Orion throws `PluginException` with the identifier and the reason     |
| Another plugin added the identifier already                                                                      | `PluginException`; a plugin that does not catch it fails its `OnLoad` |
| The game refuses the content of a plugin while it is built                                                       | That plugin fails and is not enabled; the others go on                |
| A recipe names an item the game does not have                                                                    | The server does not start                                             |

## Reference

`ContentRegistry`: The content of the plugin (Context.Content, in OnLoad): items, blocks, entities, effects,
enchantments, recipes, fuels, patterns of blocks and camera presets. Each call describes one piece to Orion at once,
which checks it and reads the files it names (paths in the folder of the plugin, plugins/&lt;id&gt;/); what Orion
refuses throws PluginException with the reason, and failing OnLoad fails the plugin. Identifiers are namespace:path in
lowercase, not of minecraft; two plugins cannot add one. The server makes one resource pack of the textures, models and
names of the content of every plugin and offers it to every player.

| Member                                                                                                                                                  | What it is                                                                                                                                                                                                                                                             |
|---------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `ContentRegistry Block(string id, Action<BlockBuilder> configure)`                                                                                      | Adds a block, with the item that places it                                                                                                                                                                                                                             |
| `ContentRegistry CameraPreset(string id, Action<CameraPresetBuilder> configure)`                                                                        | Adds a camera preset, which every player gets when it joins (player.Camera.SetPreset)                                                                                                                                                                                  |
| `ContentRegistry Effect(string id, Action<EffectBuilder> configure)`                                                                                    | Adds a status effect, given like any other (entity.Effects.Add("gems:sparkle", ticks, amplifier, true))                                                                                                                                                                |
| `ContentRegistry Enchantment(string id, Action<EnchantmentBuilder> configure)`                                                                          | Adds an enchantment, shown as a line of the lore of the items that have it                                                                                                                                                                                             |
| `ContentRegistry Entity(string id, Action<EntityBuilder> configure)`                                                                                    | Adds an entity type, which spawns like any other; with the family mob (the default) it is a mob that takes goals                                                                                                                                                       |
| `ContentRegistry Frame(string id, Action<FrameBuilder> configure)`                                                                                      | Adds a frame of blocks, a rectangle of border blocks around an inside, as the portal of the Nether                                                                                                                                                                     |
| `ContentRegistry Fuel(string item, int burnTicks)`                                                                                                      | Makes an item burn in furnaces, or changes how long: 1600 ticks for coal, 300 for wood; 0 makes it no fuel                                                                                                                                                             |
| `ContentRegistry Item(string id, Action<ItemBuilder> configure)`                                                                                        | Adds an item                                                                                                                                                                                                                                                           |
| `ContentRegistry Pattern(string id, Action<PatternBuilder> configure)`                                                                                  | Adds a pattern of blocks, which players complete by placing its last block (`BlockPatternCompleteEvent`)                                                                                                                                                               |
| `ContentRegistry RemoveRecipe(string id)`                                                                                                               | Removes a recipe of the game from every world, such as `minecraft:tnt`; to remove it from some, see `World.ExceptRecipes`                                                                                                                                              |
| `ContentRegistry ShapedRecipe(string id, IReadOnlyList<string> pattern, IReadOnlyDictionary<char, string> key, string result, int count = 1)`           | Adds a shaped recipe of the crafting table, or replaces the one of the game with its identifier: one to three rows of one to three characters, a space for an empty cell. It also matches mirrored, and one of 2×2 or smaller is made in the grid of the inventory too |
| `ContentRegistry ShapelessRecipe(string id, IReadOnlyList<string> ingredients, string result, int count = 1)`                                           | Adds a shapeless recipe of the crafting table, or replaces the one of the game with its identifier                                                                                                                                                                     |
| `ContentRegistry SmeltingRecipe(string id, string input, string result, float experience = 0.1f, SmeltingStations stations = SmeltingStations.Furnace)` | Adds what furnaces make of an item, or replaces the recipe of the game with its identifier                                                                                                                                                                             |

`ItemBuilder`: Describes an item of the plugin (`Context.Content.Item("gems:ruby", item => …)`): its name and texture at
least.

| Member                                                                                                                       | What it is                                                                                                                         |
|------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------|
| `ItemBuilder AllowOffHand()`                                                                                                 | Lets it go in the offhand                                                                                                          |
| `ItemBuilder Armor(ArmorSlot slot, int defense, int durability = 0, int toughness = 0)`                                      | Makes it armor. An item is of one kind at most                                                                                     |
| `ItemBuilder Creative(CreativeCategory category, string? group = null)`                                                      | Lists it in the creative inventory; it is listed nowhere by default                                                                |
| `ItemBuilder Food(int nutrition, float saturation = 0.6f, bool canAlwaysEat = false, bool drink = false, int useTicks = 32)` | Makes it food or a drink; what else happens when it is consumed goes in ItemConsumeEvent. An item is of one kind at most           |
| `ItemBuilder Glint()`                                                                                                        | Makes it shine as an enchanted item does                                                                                           |
| `ItemBuilder MaxStackSize(int count)`                                                                                        | Sets how many items a stack holds, from 1 to 64; 64 by default, 1 for an item that wears out                                       |
| `ItemBuilder Name(string text)`                                                                                              | Sets its name, for every language without one of its own; the words of its identifier by default (gems:ruby_shard is "Ruby Shard") |
| `ItemBuilder Name(string locale, string text)`                                                                               | Sets its name in a language                                                                                                        |
| `ItemBuilder Tags(params string[] tags)`                                                                                     | Adds item tags, such as minecraft:is_sword or gems:gems, which recipes name with #                                                 |
| `ItemBuilder Texture(string path)`                                                                                           | Sets its icon: a PNG file of the plugin, 16 by 16 pixels as those of the game. Required                                            |
| `ItemBuilder Throwable(string entity, float power = 1.5f)`                                                                   | Makes it something to throw, as a snowball: using it throws an entity. An item is of one kind at most                              |
| `ItemBuilder Tool(ToolKind kind, int durability, float miningSpeed = 2, int harvestLevel = 0, int damage = 0)`               | Makes it a tool, held as one. An item is of one kind at most                                                                       |
| `ItemBuilder Weapon(int damage, int durability = 0)`                                                                         | Makes it a weapon, held as one. An item is of one kind at most                                                                     |

`BlockBuilder`: Describes a block of the plugin (`Context.Content.Block("gems:ruby_block", block => …)`), which gets an
item of the same identifier: its name and texture at least. Blocks have no states yet.

| Member                                                                          | What it is                                                                                                                                                                     |
|---------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `BlockBuilder CollisionBox(Vector3 from, Vector3 to)`                           | Sets the box entities bump into and players aim at, in pixels within the block (from 0 to 16 on each axis); the whole block by default                                         |
| `BlockBuilder Creative(CreativeCategory category, string? group = null)`        | Lists its item in the creative inventory; it is listed nowhere by default                                                                                                      |
| `BlockBuilder DestroyTime(float hardness)`                                      | Sets how hard it is to break: 0.5 as dirt, 1.5 as stone, 3 as an ore, 50 as obsidian; 0 breaks at once and a negative value never. 1 by default                                |
| `BlockBuilder Drops(string item, int count = 1)`                                | Sets what it drops when broken; its item by default                                                                                                                            |
| `BlockBuilder ExplosionResistance(float resistance)`                            | Sets how much it holds back an explosion: 6 as stone, 1200 as obsidian; as much as its hardness by default                                                                     |
| `BlockBuilder Friction(float friction)`                                         | Sets how much it holds back what walks on it: 0.4 as most blocks, 0.02 as ice                                                                                                  |
| `BlockBuilder Geometry(string path)`                                            | Sets its model: a .geo.json file of the plugin, as model editors export a model of a block; a whole block by default. The textures then go on its faces as the model maps them |
| `BlockBuilder Light(int level)`                                                 | Makes it give light, as a torch (14) or glowstone (15)                                                                                                                         |
| `BlockBuilder Name(string text)`                                                | Sets its name, for every language without one of its own; the words of its identifier by default                                                                               |
| `BlockBuilder Name(string locale, string text)`                                 | Sets its name in a language                                                                                                                                                    |
| `BlockBuilder NoCollision()`                                                    | Lets entities walk through it, as a flower                                                                                                                                     |
| `BlockBuilder NoDrops()`                                                        | Makes it drop nothing                                                                                                                                                          |
| `BlockBuilder RenderMethod(BlockRenderMethod method)`                           | Sets how the pixels of its textures blend with what is behind; Opaque by default                                                                                               |
| `BlockBuilder Tags(params string[] tags)`                                       | Adds block tags, such as gems:gems                                                                                                                                             |
| `BlockBuilder Texture(string path)`                                             | Sets the texture of every face without one of its own: a PNG file of the plugin, 16 by 16 pixels. Required                                                                     |
| `BlockBuilder Texture(BlockFace face, string path)`                             | Sets the texture of one face                                                                                                                                                   |
| `BlockBuilder Tool(ToolKind tool, int harvestLevel = 0, bool required = false)` | Sets the tool that breaks it faster, as a pickaxe breaks stone                                                                                                                 |

`EntityBuilder`: Describes an entity type of the plugin (`Context.Content.Entity("gems:ruby_golem", entity => …)`),
which spawns like any other (`world.Entities.Spawn("gems:ruby_golem", position)`); with the family mob (the default) it
is a Mob that takes goals. Its model and texture at least. No animations yet.

| Member                                             | What it is                                                                                                                                                                                             |
|----------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `EntityBuilder Families(params string[] families)` | Sets its families, such as mob and monster, which commands and goals select by; mob by default. Without mob it is an entity that does not move by itself                                               |
| `EntityBuilder Geometry(string path)`              | Sets its model: a .geo.json file of the plugin, as model editors export a model of an entity. Required                                                                                                 |
| `EntityBuilder Health(int health)`                 | Sets the health it spawns with and its most health, in half hearts; 20 by default                                                                                                                      |
| `EntityBuilder MovementSpeed(float speed)`         | Sets how fast it walks: 0.23 as a zombie, 0.25 by default                                                                                                                                              |
| `EntityBuilder Name(string text)`                  | Sets its name, for every language without one of its own; the words of its identifier by default                                                                                                       |
| `EntityBuilder Name(string locale, string text)`   | Sets its name in a language                                                                                                                                                                            |
| `EntityBuilder NotSummonable()`                    | Keeps /summon from spawning it; it does by default                                                                                                                                                     |
| `EntityBuilder OnSpawn(Action<Entity> spawned)`    | Runs for every entity of the type that spawns or loads, from OnEnable on, on the thread of its world: the place to give a mob its goals (((Mob)entity).Goals). What it throws is a fault of the plugin |
| `EntityBuilder Size(float width, float height)`    | Sets its box at scale 1, in blocks; 1 by 1 by default                                                                                                                                                  |
| `EntityBuilder Texture(string path)`               | Sets its texture: a PNG file of the plugin, as its model maps it. Required                                                                                                                             |

`EffectBuilder`: Describes a status effect of the plugin (`Context.Content.Effect("gems:sparkle", effect => …)`), given
like any other (`entity.Effects.Add("gems:sparkle", ticks, amplifier, true)`). Clients only know the effects of the
game: a custom one shows no icon, and the swirls of an effect of the game it borrows. Its callbacks run from OnEnable
on, on the thread of the world of the entity; what they throw is a fault of the plugin.

| Member                                                                        | What it is                                                                                          |
|-------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
| `EffectBuilder Kind(EffectKind kind)`                                         | Sets whether it helps or hurts; Neutral by default                                                  |
| `EffectBuilder OnApplied(Action<LivingEntity, int> applied)`                  | Runs when an entity gets the effect                                                                 |
| `EffectBuilder OnRemoved(Action<LivingEntity, int, EffectEndReason> removed)` | Runs when the effect ends or is taken away                                                          |
| `EffectBuilder OnTick(int interval, Action<LivingEntity, int> tick)`          | Runs every so many ticks while an entity has the effect, as poison hurts                            |
| `EffectBuilder Swirls(string effect)`                                         | Shows the swirls of an effect of the game, such as minecraft:poison for green ones; none by default |

`EnchantmentBuilder`: Describes an enchantment of the plugin
(`Context.Content.Enchantment("gems:lifesteal", enchantment => …)`). Clients do not know it, so items show it as a line
of their lore, with the shine of an enchanted item; the enchanting table and anvils treat it as one of the game. Its
callbacks run from OnEnable on, on the thread of the world of the holder; what they throw is a fault of the plugin, and
then they add nothing.

| Member                                                                                             | What it is                                                                                                                |
|----------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------|
| `EnchantmentBuilder AttackDamage(Func<LivingEntity, LivingEntity, int, float> damage)`             | Adds damage to a hit in mêlée with the item in the main hand, before the armor of the target                              |
| `EnchantmentBuilder Curse()`                                                                       | Makes it a curse, which a grindstone does not remove                                                                      |
| `EnchantmentBuilder IncompatibleWith(params string[] enchantments)`                                | Keeps it off an item that has one of these enchantments, and the other way around                                         |
| `EnchantmentBuilder Items(EnchantableItems table, EnchantableItems anvil = EnchantableItems.None)` | Sets the items it goes on                                                                                                 |
| `EnchantmentBuilder MaxLevel(int level)`                                                           | Sets its highest level, from 1 (the default) to 255                                                                       |
| `EnchantmentBuilder Name(string text)`                                                             | Sets its name, for every language without one of its own; its identifier by default                                       |
| `EnchantmentBuilder Name(string locale, string text)`                                              | Sets its name in a language                                                                                               |
| `EnchantmentBuilder OnAttack(Action<LivingEntity, LivingEntity, int> attack)`                      | Runs after a hit in mêlée with the item hurt its target, as fire aspect sets it alight                                    |
| `EnchantmentBuilder OnHolderDamaged(Action<LivingEntity, DamageCause, float, int> damaged)`        | Runs after whoever holds or wears the item was hurt, as thorns hurts the attacker                                         |
| `EnchantmentBuilder Protection(Func<LivingEntity, DamageCause, int, int> protection)`              | Protects whoever holds or wears the item: each point takes 4 % off the damage, up to 20 points for all the items together |
| `EnchantmentBuilder Treasure()`                                                                    | Keeps the enchanting table from offering it                                                                               |
| `EnchantmentBuilder Weight(int weight)`                                                            | Sets how often the enchanting table picks it: 10 common, 5 uncommon, 2 rare, 1 very rare (the default)                    |

`CreativeCategory`: A tab of the creative inventory: `Construction`, `Nature`, `Equipment`, `Items`, `CommandOnly`.

`ToolKind`: A kind of tool: what it digs faster: `Pickaxe`, `Axe`, `Shovel`, `Hoe`, `Shears`.

`ArmorSlot`: Where a piece of armor is worn: `Head`, `Chest`, `Legs`, `Feet`.

`EnchantableItems`: The items an enchantment goes on, as flags: `None`, `Sword`, `Axe`, `Pickaxe`, `Shovel`, `Hoe`,
`Spear`, `Bow`, `Crossbow`, `Trident`, `Mace`, `FishingRod`, `Shears`, `Helmet`, `Chestplate`, `Leggings`, `Boots`,
`Elytra`, `Shield`, `FlintAndSteel`, `OnAStick`, `Brush`, `Head`, `Compass`, `Book`, `Armor`, `MiningTool`,
`Durability`, `Wearable`, `Vanishable`.

`BlockRenderMethod`: How the pixels of a face of a custom block are blended with what is behind.

| Member            | What it is                                       |
|-------------------|--------------------------------------------------|
| `Opaque = 0`      | Every pixel is solid, as stone                   |
| `AlphaTest = 1`   | Pixels are solid or see-through, as leaves       |
| `Blend = 2`       | Pixels can be half see-through, as stained glass |
| `DoubleSided = 3` | As Opaque, and drawn from both sides             |

`SmeltingStations` (flags): the blocks that smelt a recipe of the furnace.

| Member             | What it is                                                   |
|--------------------|--------------------------------------------------------------|
| `None = 0`         | None: a recipe needs at least one                            |
| `Furnace = 1`      | The furnace                                                  |
| `BlastFurnace = 2` | The blast furnace, which smelts ores and armor twice as fast |
| `Smoker = 4`       | The smoker, which cooks food twice as fast                   |
