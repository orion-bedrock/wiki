---
title: "Worlds"
description: "Orion server plugins: finding, creating, loading and unloading worlds; spawn, time, weather, border, biomes."
sidebar:
  order: 1
---

A server runs several worlds at once, each with its own dimension, blocks, entities, time and weather, ticking on its
own thread ([Threads and async code](../../basics/threads/)). A plugin finds worlds, creates new ones (an arena for each match), loads and
unloads them, and changes their spawn, time, weather, border and biomes. The types are in `Orion.Sdk.Server.Worlds`.

## Find a world

```csharp
World? lobby = GameServer.Current.DefaultWorld;                  // where players join
World? arena = GameServer.Current.FindWorld("arena");             // a loaded world, by name, ignoring case
foreach (World loaded in GameServer.Current.Worlds)               // a copy of the loaded worlds
{
    Context.Logger.LogInformation("{World}: {Players} players", loaded.Name, loaded.Players.Count);
}
```

The world of a player is `player.World` (`null` while it moves between worlds), and most events carry their `World`.

## Create, load and unload worlds

`GameServer.Current.WorldManager` manages the worlds of the server: those loaded, and those saved in its worlds
directory.

```csharp
WorldManager worlds = GameServer.Current.WorldManager;

World arena = await worlds.Create("arena-1")
    .WithGenerator("void")                              // an empty world: "void", "flat", or a generator of the server
    .InMemory()                                         // nothing saved: gone when it unloads
    .WithSpawn(new Vector3(0.5f, 64, 0.5f))
    .WithTime(6000)
    .WithBoolRule("doDaylightCycle", false)
    .WithDifficulty(Difficulty.Normal)
    .BuildAsync();

if (worlds.Exists("skyblock") && worlds.Find("skyblock") is null)
{
    World skyblock = await worlds.LoadAsync("skyblock");   // a world saved on disk
}

await worlds.UnloadAsync(arena, save: false);             // its players go to the default world first
```

| Member of `WorldManager`                              | What it does                                                                              |
|-------------------------------------------------------|-------------------------------------------------------------------------------------------|
| `Create(name)`                                        | Starts a `WorldBuilder`; `BuildAsync()` creates the world off the calling thread          |
| `LoadAsync(name)`                                     | Loads a world saved in the worlds directory                                               |
| `UnloadAsync(world, save)`                            | Moves its players to the default world, saves it unless `save` is `false`, and unloads it |
| `DeleteAsync(name)`                                   | Deletes the directory of a world that is not loaded                                       |
| `Loaded`, `Find(name)`, `Exists(name)`, `ListSaved()` | The worlds loaded, one by name, whether one exists, the names saved on disk               |
| `Default`                                             | The world players join; settable                                                          |

The asynchronous members complete on the thread their operation ends on, not on a world: `await world.SwitchTo()` before
using the world you got ([Threads and async code](../../basics/threads/)). A world created with `WithAutoLoad(true)` is loaded again by the
server when it starts. `WorldLoadedEvent` comes when a world is created or loaded, and `WorldUnloadingEvent` before one
unloads, while its players are still in it.

## Spawn, time and weather

```csharp
world.Spawn = new Vector3(0.5f, 70, 0.5f);               // where players appear

world.Time.Value = 6000;                                  // noon; 0 is sunrise, 18000 midnight
bool day = world.Time.TimeOfDay < 12000;

world.Weather.Set(WeatherKind.Thunder, 20 * 60);          // a minute of thunder
world.Weather.Strike(new Vector3(10, 64, 10), harmless: true);
```

The time advances while `world.Time.IsAdvancing` (the game rule `doDaylightCycle` and the time of the world are both
on); the weather changes by itself while `world.Weather.IsAdvancing`.
`world.Features = world.Features with { Time = false }` stops the time of one world ([World rules](../world-rules/)).
A player can see a time or weather of its own ([Players](../../players/players/)).

| Event                    | When                                                                       |
|--------------------------|----------------------------------------------------------------------------|
| `WorldTimeEvent`         | Each tick the time advances: `Step` is writable (0 stops it for that tick) |
| `TimeSetEvent`           | Code or a command set the time                                             |
| `WeatherChangeEvent`     | The weather is about to change: `Duration` writable, cancelable            |
| `SpawnPointChangedEvent` | Code or a command moved the spawn point                                    |

## The border

The border is a square around a center that players stay inside, as in the game:

```csharp
world.Border.SetCenter(0, 0);
world.Border.SetRadius(200);                              // a square of 400 by 400 blocks
world.Border.Resize(50, 20 * 120);                        // shrinks to 100 by 100 over two minutes
world.Border.DamagePerBlock = 0.5f;                       // past the safe zone, every second
bool inside = world.Border.Contains(player.Position);
```

`WorldBorderChangeEvent` comes before the border moves or changes size (writable `CenterX`, `CenterZ`, `Radius`,
`Ticks`; cancelable), and `PlayerBorderCrossEvent` when a player walks out of it (writable `ReturnTo`, where it is put
back).

## Biomes

Biomes are stored per block, by identifier:

```csharp
string biome = world.Biomes.Get(new BlockPosition(0, 64, 0));      // such as minecraft:plains
world.Biomes.Fill(new BlockPosition(-16, -64, -16), new BlockPosition(16, 320, 16), BiomeIds.CherryGrove);
```

Players see a biome changed in a chunk when the chunk is sent to them again. `GameServer.Current.Biomes` lists every
biome ([Catalogs of the server](../../platform/catalogs/)).

## Save

The server saves its worlds by itself (on its autosave interval and when it stops). `world.Save()` saves one now;
`WorldSaveEvent` comes before a world saves (`Cause`: `Plugin`, `Autosave` or `Unload`; cancelable). A world created
`InMemory` is never saved.

## Explosions

```csharp
world.Explode(new Vector3(0, 64, 0), 4, breaksBlocks: false, causesFire: false);
world.Explode(new Vector3(0, 64, 0), 3, ExplosionOptions.KeepBlocks with { CausesFire = true }, player);
```

`ExplosionOptions` is a record: `Default` (as TNT), `KeepBlocks` (hurts and pushes, breaks nothing) and `Wind` (only
pushes), changed with `with`. An explosion raises `ExplosionEvent` first, which may cancel it; the attacker is
responsible for the damage. How TNT explodes in a world is in [World rules](../world-rules/).

## What else a world has

| Member                                                                           | Page                                                                                   |
|----------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| `Blocks`                                                                         | [Blocks](../blocks/), [Block batches, copies and patterns](../block-batches-and-patterns/) |
| `Entities`, `DropItem`                                                           | [Entities](../../entities/entities/)                                                             |
| `Rules`, `Combat`, `Explosions`, `Experience`, `Enchanting`, `Features`, recipes | [World rules](../world-rules/)                                                       |
| `RayCast`, `Collisions`, `Redstone`, `Chunks`, `Vibrations`                      | [World queries](../world-queries/)                                                   |
| `FloatingTexts`                                                                  | [Floating texts](../../player-ui/floating-texts/)                                                 |
| `Sounds`, `Particles`                                                            | [Sounds and particles](../../player-ui/sounds-and-particles/)                                     |
| `Properties`                                                                     | [Keeping data](../../platform/persistence/)                                                       |
| `Post`, `InvokeAsync`, `SwitchTo`, `Delay`                                       | [Threads and async code](../../basics/threads/)                                                               |
| `Tick`, `LastTickMilliseconds`, `AverageTickMilliseconds`                        | How busy the world is: ticks run, and how long they take                               |

## Reference

`WorldManager`: The worlds of a game: creating, loading, finding, unloading and deleting them.

| Member                                     | What it is                                                                                        |
|--------------------------------------------|---------------------------------------------------------------------------------------------------|
| `WorldBuilder Create(string name)`         | Starts describing a new world; `BuildAsync` creates it                                            |
| `World? Default`                           | The world players join by default: the first world loaded, unless another one is chosen; settable |
| `Task<bool> DeleteAsync(string name)`      | Deletes the directory of a world that is not loaded                                               |
| `bool Exists(string name)`                 | Tells whether a world is loaded or saved on disk                                                  |
| `World? Find(string name)`                 | Finds a loaded world by name, ignoring case                                                       |
| `IReadOnlyList<string> ListSaved()`        | The names of the worlds saved in the worlds directory of the server, loaded or not                |
| `Task<World> LoadAsync(string name)`       | Loads a world saved on disk, off the calling thread                                               |
| `IReadOnlyList<World> Loaded`              | A copy of the loaded worlds                                                                       |
| `string SavedNames`                        | The names of the worlds saved in the worlds directory, one per line, in order                     |
| `Task UnloadAsync(World world, bool save)` | Unloads a world: its players move to the default world, then it is saved unless discarded         |

`WorldBuilder`: Describes a new world; `BuildAsync` creates it.

| Member                                                       | What it is                                                                                        |
|--------------------------------------------------------------|---------------------------------------------------------------------------------------------------|
| `Task<World> BuildAsync()`                                   | Creates the world off the calling thread (it writes to disk)                                      |
| `WorldBuilder InMemory()`                                    | Keeps the world only in memory: no directory, nothing saved, gone when it unloads (arenas, tests) |
| `WorldBuilder WithAutoLoad(bool autoLoad)`                   | Sets whether the server loads the world when it starts                                            |
| `WorldBuilder WithBoolRule(string rule, bool value)`         | Starts the world with a rule on or off                                                            |
| `WorldBuilder WithDefaultBiome(string biome)`                | Gives new chunks a biome                                                                          |
| `WorldBuilder WithDifficulty(Difficulty difficulty)`         | Sets the difficulty, saved with the world                                                         |
| `WorldBuilder WithDimension(Dimension dimension)`            | Sets the dimension                                                                                |
| `WorldBuilder WithGenerator(string name)`                    | Uses a generator of the server, by name: `void`, `flat`, or one the server adds                   |
| `WorldBuilder WithGeneratorOption(string key, string value)` | Sets an option of the generator, saved with the world (`layers` and `biome_layers` for `flat`)    |
| `WorldBuilder WithIntRule(string rule, int value)`           | Starts the world with a rule that is a number                                                     |
| `WorldBuilder WithSeed(long seed)`                           | Sets the seed of the world                                                                        |
| `WorldBuilder WithSpawn(Vector3 spawn)`                      | Sets the spawn point (the position of the feet)                                                   |
| `WorldBuilder WithTime(int time)`                            | Sets the time of day, in ticks                                                                    |

`World`: A world: one dimension with its chunks, blocks, players, spawn point, time and rules.

| Member                                                                                                        | What it is                                                                                                                                                                                                                   |
|---------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `double AverageTickMilliseconds`                                                                              | The mean duration of a tick of the world over about the last minute, in milliseconds                                                                                                                                         |
| `WorldBiomes Biomes`                                                                                          | The biomes, one per block                                                                                                                                                                                                    |
| `WorldBlocks Blocks`                                                                                          | The blocks                                                                                                                                                                                                                   |
| `WorldBorder Border`                                                                                          | The border of the world: a square players stay inside                                                                                                                                                                        |
| `WorldChunks Chunks`                                                                                          | The chunks in memory                                                                                                                                                                                                         |
| `WorldCollisions Collisions`                                                                                  | The blocks as physics sees them: shapes, surfaces and media                                                                                                                                                                  |
| `CombatRules Combat`                                                                                          | How fights work here: the delay between hits, knockback, critical hits and reach; settable                                                                                                                                   |
| `Task Delay(int ticks)`                                                                                       | Waits ticks of the world without blocking it, and goes on on its thread                                                                                                                                                      |
| `Dimension Dimension`                                                                                         | The dimension of the world                                                                                                                                                                                                   |
| `ItemEntity DropItem(ItemStack stack, Vector3 position)`                                                      | Drops a stack as an item entity, which players can pick up                                                                                                                                                                   |
| `EnchantingRules Enchanting`                                                                                  | What enchanting does here: the effects of enchantments and the enchanting table; settable                                                                                                                                    |
| `WorldEntities Entities`                                                                                      | The entities that are not players: spawning, finding and showing them                                                                                                                                                        |
| `IReadOnlyCollection<string> ExceptRecipes`                                                                   | The recipes never made here, by identifier, such as minecraft:tnt; settable                                                                                                                                                  |
| `ExperienceRules Experience`                                                                                  | Where experience comes from here: blocks, deaths and bottles o' enchanting; settable                                                                                                                                         |
| `bool Explode(Vector3 position, float power, bool breaksBlocks, bool causesFire)`                             | Makes an explosion, if `ExplosionEvent` lets it                                                                                                                                                                              |
| `bool Explode(Vector3 position, float power, ExplosionOptions options, Entities.Entity? attacker)`            | Makes an explosion with options, if ExplosionEvent lets it                                                                                                                                                                   |
| `ExplosionRules Explosions`                                                                                   | How explosions work here: TNT and the shaking of cameras; settable                                                                                                                                                           |
| `WorldFeatures Features`                                                                                      | Which systems of the game this world turns on or off for itself: time and weather; settable                                                                                                                                  |
| `WorldFloatingTexts FloatingTexts`                                                                            | The floating texts of the world                                                                                                                                                                                              |
| `bool IsCraftingEnabled`                                                                                      | Whether crafting tables and the 2×2 grid of the inventory make recipes here; settable                                                                                                                                        |
| `bool IsLoaded`                                                                                               | Whether the world is loaded (not yet unloaded)                                                                                                                                                                               |
| `bool IsSmeltingEnabled`                                                                                      | Whether furnaces, blast furnaces and smokers smelt here; settable                                                                                                                                                            |
| `bool IsTimeEnabled`                                                                                          | Whether time passes here: the world says so, or the server                                                                                                                                                                   |
| `bool IsWeatherEnabled`                                                                                       | Whether the weather changes here: the world says so, or the server                                                                                                                                                           |
| `double LastTickMilliseconds`                                                                                 | How long the last tick of the world took, in milliseconds                                                                                                                                                                    |
| `int MaxY`                                                                                                    | The Y above the highest blocks of the world (its dimension)                                                                                                                                                                  |
| `int MinY`                                                                                                    | The lowest Y of the world (its dimension)                                                                                                                                                                                    |
| `string Name`                                                                                                 | The name of the world, unique in the game (ignoring case) and the name of its directory                                                                                                                                      |
| `IReadOnlyCollection<string>? OnlyRecipes`                                                                    | The only recipes made here, by identifier, or `null` for every recipe; its players see only these in their recipe book (IsCraftingEnabled and IsSmeltingEnabled turn the stations off); settable                             |
| `WorldParticles Particles`                                                                                    | The particles shown in the world                                                                                                                                                                                             |
| `IReadOnlyList<Player> Players`                                                                               | The players in the world                                                                                                                                                                                                     |
| `void Post(Action action)`                                                                                    | Runs an action on the thread of the world, from any thread, at its next opportunity (at the latest the start of its next tick)                                                                                               |
| `WorldProperties Properties`                                                                                  | The text properties plugins keep with the world                                                                                                                                                                              |
| `RayCastHit RayCast(Vector3 origin, Vector3 direction, float distance, RayCastFilter filter, Entity? ignore)` | Finds what a ray from a point hits first: the collision shape of a block (what physics and projectiles hit, not grass or flowers), water or lava, or the box of an entity; such as the block or the entity a player looks at |
| `RayCastHit RayCast(Vector3 origin, Vector3 direction, float distance)`                                       | Finds what a ray from a point hits first: a block or an entity, as a projectile would (Solid)                                                                                                                                |
| `WorldRedstone Redstone`                                                                                      | The redstone: its rules and what power each block takes                                                                                                                                                                      |
| `WorldRules Rules`                                                                                            | The game rules and the difficulty                                                                                                                                                                                            |
| `int Save()`                                                                                                  | Saves the modified chunks of the world now, as `WorldSaveEvent` decides; gives the chunks written                                                                                                                            |
| `WorldSounds Sounds`                                                                                          | The sounds played in the world: sound events of the game and sound definitions                                                                                                                                               |
| `Vector3 Spawn`                                                                                               | Where players appear in the world; settable                                                                                                                                                                                  |
| `PluginWorlds.WorldSwitch SwitchTo()`                                                                         | `await world.SwitchTo()`: the rest of the method runs on the thread of the world; `OperationCanceledException` when the world unloads or the plugin is disabled first                                                        |
| `Task<T> InvokeAsync<T>(Func<T> function)`                                                                    | Runs a function on the thread of the world and gives its result                                                                                                                                                              |
| `long Tick`                                                                                                   | The ticks the world has run                                                                                                                                                                                                  |
| `WorldTime Time`                                                                                              | The time of day                                                                                                                                                                                                              |
| `WorldVibrations Vibrations`                                                                                  | The vibrations, which sculk sensors and shriekers hear                                                                                                                                                                       |
| `WorldWeather Weather`                                                                                        | The weather: clear, rain or thunder                                                                                                                                                                                          |

`WorldTime`: The time of day of a world.

| Member             | What it is                                                                                                                    |
|--------------------|-------------------------------------------------------------------------------------------------------------------------------|
| `bool IsAdvancing` | Whether time passes: the time of the world (`IsTimeEnabled`) and the rule `doDaylightCycle` are both on                       |
| `int TimeOfDay`    | The time of day, from 0 to 23,999                                                                                             |
| `int Value`        | The time, in ticks (0 is sunrise, 6,000 noon, 18,000 midnight); players see it at once and `TimeSetEvent` is raised; settable |

`WorldWeather`: The weather of a world: clear, rain or thunder, saved with the world.

| Member                                         | What it is                                                                                                                        |
|------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| `bool IsAdvancing`                             | Whether the weather changes by itself: the weather of the world (`IsWeatherEnabled`) and the rule `doWeatherCycle` are both on    |
| `WeatherKind Kind`                             | The weather                                                                                                                       |
| `int RemainingTicks`                           | How many ticks are left until the weather changes by itself, while it changes by itself                                           |
| `bool Set(WeatherKind kind, int duration)`     | Sets the weather, as `WeatherChangeEvent` decides, for a number of ticks or for a random time of the game; players see it at once |
| `void Strike(Vector3 position, bool harmless)` | Strikes lightning at a position                                                                                                   |

`WorldBorder`: The border of a world: a square around a center, as in the game, saved with the world.

| Member                                       | What it is                                                                                              |
|----------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `double CenterX`                             | The X coordinate of the center                                                                          |
| `double CenterZ`                             | The Z coordinate of the center                                                                          |
| `bool Contains(Vector3 position)`            | Whether a point is inside the border, or on it                                                          |
| `bool ContainsBlock(BlockPosition position)` | Tells whether a block is inside the border                                                              |
| `float DamagePerBlock`                       | The damage per block past SafeZone, every second; 0 hurts no one; settable                              |
| `bool IsEnabled`                             | Whether the world has a border                                                                          |
| `double Radius`                              | The half size of the square now, part way through a resize                                              |
| `bool Remove()`                              | Takes the border away, as `WorldBorderChangeEvent` decides                                              |
| `bool Resize(double radius, int ticks)`      | Grows or shrinks the square to a half size, evenly over some ticks, as `WorldBorderChangeEvent` decides |
| `double SafeZone`                            | How far outside the border players take no damage, in blocks; settable                                  |
| `bool SetCenter(double x, double z)`         | Moves the center of the square, as `WorldBorderChangeEvent` decides                                     |
| `bool SetRadius(double radius)`              | Sets the half size of the square at once, as `WorldBorderChangeEvent` decides                           |
| `double TargetRadius`                        | The half size the square is going to; equal to Radius when it is not resizing                           |
| `double WarningDistance`                     | How close to the border players see the wall and the warning, in blocks; settable                       |

`WorldBiomes`: The biomes of a world, one per block.

| Member                                                         | What it is                                                       |
|----------------------------------------------------------------|------------------------------------------------------------------|
| `string Default`                                               | The identifier of the biome of new chunks                        |
| `int Fill(BlockPosition from, BlockPosition to, string biome)` | Sets the biome of every block between two corners, both included |
| `string Get(BlockPosition position)`                           | The identifier of the biome at a block                           |
| `bool Set(BlockPosition position, string biome)`               | Sets the biome at a block                                        |

`WorldProperties`: Text that plugins keep with a world (the author of a map, the teams of an arena).

| Member                               | What it is                                         |
|--------------------------------------|----------------------------------------------------|
| `int Count`                          | The number of properties                           |
| `string? Get(string key)`            | The value of a property                            |
| `bool Remove(string key)`            | Removes a property                                 |
| `void Set(string key, string value)` | Sets the value of a property, saved with the world |

`Dimension`: The dimension a world is: its height range and how the client draws it.

| Member                       | What it is                                                                                                                                      |
|------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------------|
| `string DefaultBiome`        | The biome new chunks of a world of this dimension have unless its generator sets another: plains, the nether wastes (minecraft:hell) or the end |
| `static Dimension End`       | The end: blocks from Y 0 to 255                                                                                                                 |
| `int Id`                     | The ID of the dimension in the game (0 overworld, 1 nether, 2 end)                                                                              |
| `int MaxY`                   | The Y above the highest block (exclusive)                                                                                                       |
| `int MinY`                   | The lowest Y a block can have                                                                                                                   |
| `string Name`                | The name of the dimension: overworld, nether or end                                                                                             |
| `static Dimension Nether`    | The nether: blocks from Y 0 to 127                                                                                                              |
| `static Dimension Overworld` | The overworld: blocks from Y −64 to 319                                                                                                         |
`ExplosionOptions` (a record): what an explosion of `world.Explode` does: whether it breaks blocks, hurts and pushes
entities, sets fires, how its drops fly and how it looks.

| Member                               | What it is                                                                        |
|--------------------------------------|-----------------------------------------------------------------------------------|
| `bool BreaksBlocks`                  | Whether it breaks blocks                                                          |
| `bool CausesFire`                    | Whether it sets fires                                                             |
| `bool DamagesEntities`               | Whether it hurts and pushes entities                                              |
| `static ExplosionOptions Default`    | An explosion of the game, as TNT or a creeper: it breaks blocks, hurts and pushes |
| `float? DropChance`                  | The chance a block it breaks drops, from 0 to 1, or `null` for that of the game   |
| `float DropScatter`                  | How far the drops fly                                                             |
| `bool IgnoresLiquids`                | Whether it breaks blocks under water too                                          |
| `static ExplosionOptions KeepBlocks` | An explosion that hurts and pushes but leaves the blocks, as one in an arena      |
| `float KnockbackMultiplier`          | How hard it pushes entities                                                       |
| `string? Particle`                   | The particle effect it shows, or `null` for that of the game                      |
| `bool ShakesCamera`                  | Whether it shakes the cameras of the players near it                              |
| `bool ShowsDebris`                   | Whether it shows debris                                                           |
| `string? Sound`                      | The sound it plays, or `null` for that of the game                                |
| `static ExplosionOptions Wind`       | A burst of wind, as a wind charge: it only pushes, with the gust and its sound    |

`WorldSaveCause` (the `Cause` of `WorldSaveEvent`): Why a world saves.

| Member         | What it is                   |
|----------------|------------------------------|
| `Plugin = 0`   | Code saved it                |
| `Autosave = 1` | Its autosave interval passed |
| `Unload = 2`   | It is unloading              |

`WeatherChangeCause` (the `Cause` of `WeatherChangeEvent`): Why the weather of a world changes.

| Member        | What it is                             |
|---------------|----------------------------------------|
| `Plugin = 0`  | Code changed it                        |
| `Cycle = 1`   | The weather cycle changed it by itself |
| `Command = 2` | A player ran /weather                  |

`WorldBorderChangeCause` (the `Cause` of `WorldBorderChangeEvent`): Why the border of a world changes.

| Member        | What it is                |
|---------------|---------------------------|
| `Plugin = 0`  | Code changed it           |
| `Command = 1` | A player ran /worldborder |
