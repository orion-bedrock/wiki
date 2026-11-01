---
title: "Events"
description: "Orion server plugins: handling the events of the game: priorities, canceling, changing them; every event."
sidebar:
  order: 5
---

Almost everything that happens in the game is an event your plugin can hear: a player joins, breaks a block, writes in
the chat, an entity is hurt, a world saves. A handler can read the event, change what it says (the message of the chat,
the damage of a hit) and, for most events, cancel it so that it does not happen. The events of the server are in the
namespace `Orion.Sdk.Server.Events`.

## Handle an event

A handler is a method marked `[EventHandler]` that returns `void` and takes one event. Its class is `partial`: the SDK
finds its handlers when you build, so nothing is looked up at run time.

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;

namespace Arena;

public sealed partial class ArenaPlugin : ServerPlugin
{
    [EventHandler]
    public void OnJoin(PlayerJoinEvent e) => e.Player.SendMessage($"Welcome to {e.World.Name}, {e.Player.Name}!");

    [EventHandler(EventPriority.High, IgnoreCanceled = true)]
    public static void OnChat(PlayerChatEvent e) => e.Message = "[Arena] " + e.Message;
}
```

The plugin class is a listener itself: its handlers are registered for you just before `OnEnable`. A handler may be an
instance method (it reaches the fields of its object) or a static one.

| Rule                                                                             | Otherwise |
|----------------------------------------------------------------------------------|-----------|
| The method returns `void`, is not generic and takes exactly one event            | `ORSG007` |
| Its class is `partial`, not static nor generic, and so are the classes around it | `ORSG008` |

## Listener classes

Put handlers in classes of their own when the plugin grows: one class per feature, sharing state through their
constructor. Register each one with `Context.Events.Register(listener)`, from `OnEnable` on:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Players;

namespace Arena;

public sealed class Scores
{
    private readonly Dictionary<string, int> _kills = [];

    public int Add(string player) => _kills[player] = _kills.GetValueOrDefault(player) + 1;
}

public sealed partial class KillListener(Scores scores)
{
    [EventHandler(EventPriority.Monitor)]
    public void OnDeath(EntityDeathEvent e)
    {
        if (e.Outcome == EventOutcome.Done && e.Entity is Player && e.Attacker is Player killer)
        {
            killer.SendMessage($"Kills: {scores.Add(killer.Name)}");
        }
    }
}

public sealed partial class ProtectionListener(string world)
{
    [EventHandler]
    public void OnBreak(BlockBreakEvent e) => e.IsCanceled |= e.World.Name == world;

    [EventHandler]
    public void OnPlace(BlockPlaceEvent e) => e.IsCanceled |= e.World.Name == world;
}

public sealed class ArenaPlugin : ServerPlugin
{
    private readonly Scores _scores = new();

    public override void OnEnable()
    {
        Context.Events.Register(new KillListener(_scores));
        Context.Events.Register(new ProtectionListener("arena"));
    }
}
```

| Style                        | Prefer it when                                                                               |
|------------------------------|----------------------------------------------------------------------------------------------|
| Handlers in the plugin class | A few handlers that use the plugin itself (`Context`, its settings)                          |
| Listener classes             | Several features, state shared between some handlers, or handlers that only make sense later |

A listener can be registered at any time after `OnEnable` starts (when a round begins, say), and stays registered
until `Context.Events.Unregister(listener)` takes it away or the plugin is disabled. Once no handler of the plugin is
left for an event (at a priority), Orion stops dispatching that event to the plugin, so a listener of a round costs
nothing between rounds:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server.Events;

namespace Arena;

public sealed partial class RoundListener
{
    [EventHandler]
    public void OnMove(PlayerMoveEvent e)
    {
        if (e.To.Y < -64)
        {
            e.Player.SendMessage("You fell out of the arena!");
        }
    }
}
```

```csharp
var round = new RoundListener();
Context.Events.Register(round);                  // the round starts
// …
bool removed = Context.Events.Unregister(round); // it ends: true, it was registered
```

Registering an object that is registered already does nothing; two instances of a listener class are two listeners.
`Unregister` takes away the event handlers of a listener: its `[MessageHandler]` methods hear their channels from its
first registration until the plugin is disabled.

### Why there are no lambdas

The SDK only has `[EventHandler]` methods: there is no `Events.On<T>(e => …)`. A plugin is compiled with Native AOT,
which has no reflection over your code at run time, so the SDK reads every handler (which event, which priority, which
method) from its attributes when you build, checks it (`ORSG007`, `ORSG008`), and it costs nothing when an event
comes. A lambda would hide the type of its event from that check. Write a small listener class instead; its handlers
can still call any lambda or delegate you keep.

## Priorities

`[EventHandler(priority)]` says when a handler runs among all the handlers of every plugin:

| Priority  | Runs                             | For                                            |
|-----------|----------------------------------|------------------------------------------------|
| `Lowest`  | First                            | A default that others may change               |
| `Low`     | After `Lowest`                   |                                                |
| `Normal`  | The default                      | Most handlers                                  |
| `High`    | After `Normal`                   | Decisions that should win over most plugins    |
| `Highest` | Last of the handlers that decide | The final word: protections, anti-cheat        |
| `Monitor` | After the outcome, read-only     | Logging, statistics, reacting to what happened |

Within one priority, the plugins that load first run first ([The life of a plugin](../lifecycle/), Dependencies), and within a
plugin the handlers run in the order they were registered. Each handler sees what the previous ones left.

## Cancel an event

An event that is an action of the game (breaking a block, writing in the chat) derives from `CancelableEvent`: set
`IsCanceled` to stop it from happening. A later handler can uncancel it by setting it back to `false`; the last word
is the one that counts. `IgnoreCanceled = true` skips a handler for events already canceled by an earlier one:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Players;

namespace Arena;

public sealed partial class SpawnProtection : ServerPlugin
{
    [EventHandler(EventPriority.Low)]
    public static void OnBreak(BlockBreakEvent e)
    {
        if (Math.Abs(e.Position.X) < 16 && Math.Abs(e.Position.Z) < 16)
        {
            e.IsCanceled = true;                     // the spawn is protected
        }
    }

    [EventHandler(EventPriority.High)]
    public static void OnBreakByBuilder(BlockBreakEvent e)
    {
        if (e.IsCanceled && e.Player is { } player && player.HasPermission("arena.build"))
        {
            e.IsCanceled = false;                    // builders may break it anyway
        }
    }

    [EventHandler(IgnoreCanceled = true)]
    public static void OnBreakAllowed(BlockBreakEvent e) => e.Experience += 1;   // only blocks that do break
}
```

The table at the end of this page says which events are cancelable. Events that report what already happened
(`PlayerJoinEvent`, `EntityRemovedEvent`) cannot be canceled.

## Change an event

Fields in **bold** in the tables below are writable: a handler changes what the event does, and later handlers see the
new value.

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Entities;
using Orion.Sdk.Server.Events;
using Orion.Sdk.Server.Lang;
using Orion.Sdk.Server.Players;

namespace Arena;

public sealed partial class ArenaRules : ServerPlugin
{
    [EventHandler]
    public static void OnDamage(EntityDamageEvent e)
    {
        if (e.Cause == DamageCause.Fall)
        {
            e.Amount /= 2;                           // falls hurt half as much
        }
    }

    [EventHandler]
    public static void OnLogin(PlayerLoginEvent e)
    {
        if (e.Player.Name.StartsWith("Bot", StringComparison.OrdinalIgnoreCase))
        {
            e.RefusalMessage = Text.Lang("arena::no_bots");
            e.IsCanceled = true;                     // refused, with that message in the language of the player
        }
    }

    [EventHandler]
    public static void OnGameMode(GameModeChangeEvent e)
    {
        if (e.To == GameMode.Creative && !e.Player.HasPermission("arena.creative"))
        {
            e.To = GameMode.Adventure;
        }
    }
}
```

The server checks what a handler writes when the handlers are done. A value it refuses (a negative experience, a
position outside the world) is undone, and a warning goes to the log of the plugin: "A handler of … set a value the
server refused, which was undone". The other changes stay.

## Watch the outcome

A `Monitor` handler runs once every other handler decided and the action happened or not. `Outcome` says how it ended:

| `EventOutcome` | Meaning                                                               |
|----------------|-----------------------------------------------------------------------|
| `Pending`      | Not decided yet: what every handler but a monitor sees                |
| `Done`         | It happened                                                           |
| `Canceled`     | A handler, or the server itself, canceled it                          |
| `Refused`      | It was allowed, but the server could not do it, or it changed nothing |

```csharp
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Events;

namespace Arena;

public sealed partial class BlockLog : ServerPlugin
{
    [EventHandler(EventPriority.Monitor)]
    public void OnBreak(BlockBreakEvent e)
    {
        if (e.Outcome == EventOutcome.Done && e.Player is { } player)
        {
            Context.Logger.LogInformation("{Player} broke {Block} at {Position}", player.Name, e.State.Id, e.Position);
        }
    }
}
```

What a monitor writes is ignored.

## Rules of handlers

| Rule             | What                                                                                                                                                                                                |
|------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| The event object | Valid only during the call: one object per event and thread is reused for the next event, so never keep it; keep the values you need (`e.Player`, `e.Position`)                                     |
| Threads          | A handler runs on the thread of the world of the event; the events of a player joining run on its network thread ([Threads and async code](../threads/))                                                         |
| A handler throws | A fault of the plugin, in its log: what the handlers of the plugin at that priority changed is undone, and its next handlers at that priority are skipped; other priorities and other plugins go on |
| Slow handlers    | A handler runs inside the tick of its world: keep it short, and start asynchronous work for the rest                                                                                                |
| Waiting          | A handler is not asynchronous: start a task (`_ = RunAsync(...)`) and let the event go ([Threads and async code](../threads/))                                                                                   |
| Disabling        | Every handler of the plugin is removed when it is disabled                                                                                                                                          |

Events about content of plugins (an item, block or mob of yours) are the same events, filtered by identifier:
`e.Item.Id == "arena:flag"` in `ItemUseEvent`, `e.State.Id == "arena:crystal"` in `BlockBreakEvent`,
`e.Entity.Type.Id == "arena:guard"` in `EntitySpawnedEvent` ([Custom content](../../platform/custom-content/)).

## Every event

The types of the fields are those of the SDK: `Player`, `World`, `BlockPosition`, `ItemStack`, `Text`… A field
marked `?` may be `null` (`Player?` of `BlockBreakEvent` is `null` when no player broke the block). Fields named
`Cause` tell why an action happens, with an enum of their own (`PlayerTeleportCause`,
`WeatherChangeCause`…).

### Players joining and leaving

| Event                      | When                                                                                                                                      | Fields (writable in bold)                                                              | Cancelable |
|----------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|------------|
| `PlayerLoginEvent`         | A player logged in and is about to join the game; on its network thread                                                                   | `Player`, **`Permission`**, **`GameMode`**, **`IgnoreCapacity`**, **`RefusalMessage`** | Yes        |
| `PlayerSkinEvent`          | A player logged in with a skin; on its network thread                                                                                     | `Player`, `Problem?`, **`RefusalMessage`**                                             | Yes        |
| `PackOfferEvent`           | A player that logged in is about to be offered the packs of the server                                                                    | `Player`, **`Required`**                                                               | Yes        |
| `PlayerSpawnLocationEvent` | A player that joined is about to be sent to a world; on its network thread                                                                | `Player`, **`World`**, **`Position`**, **`RefusalMessage`**                            | Yes        |
| `PlayerListedEvent`        | A player that is about to enter its first world is listed                                                                                 | `Player`, `World`                                                                      | Yes        |
| `PlayerSpawnEvent`         | The client of a player left the loading screen                                                                                            | `Player`, `World`                                                                      | Yes        |
| `PlayerJoinEvent`          | A player joined the game: its client left the loading screen for the first time. The server sends no join message: plugins send their own | `Player`, `World`                                                                      | No         |
| `PlayerQuitEvent`          | A player left the game: it is out of its world, the chat and the player list                                                              | `Player`, `World?`                                                                     | No         |

### Players in the game

| Event                     | When                                                                                                                                                 | Fields (writable in bold)                                            | Cancelable |
|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------|------------|
| `PlayerMoveEvent`         | The client of a player moved it                                                                                                                      | `Player`, `World`, `From`, **`To`**                                  | Yes        |
| `PlayerTeleportEvent`     | The server is about to move a player within its world                                                                                                | `Player`, `World`, `From`, `Cause`, **`To`**, **`Pitch`**, **`Yaw`** | Yes        |
| `PlayerTransferEvent`     | A player is about to move to another world of the server                                                                                             | `Player`, `From?`, `Cause`, **`To`**, **`Position`**                 | Yes        |
| `ServerTransferEvent`     | A player is about to be sent to another server, or to another server of its proxy                                                                    | `Player`, `World?`, `Address`, `Port`, `Cause`                       | Yes        |
| `PlayerRespawnEvent`      | A dead player respawns: it pressed respawn, or code called `Respawn`                                                                                 | `Player`, `World`, **`Position`**                                    | Yes        |
| `PlayerBorderCrossEvent`  | A player walked out of the border of its world                                                                                                       | `Player`, `World`, `From`, `To`, **`ReturnTo`**                      | Yes        |
| `GameModeChangeEvent`     | The game mode of a player is about to change                                                                                                         | `Player`, `World?`, `From`, `Cause`, **`To`**                        | Yes        |
| `PlayerAbilitiesEvent`    | The abilities of a player are worked out again: it joined, or its game mode or permission changed (`RefreshAbilities`)                               | `Player`, `World?`, `From`, **`Abilities`**                          | Yes        |
| `PlayerStateChangeEvent`  | The client of a player starts or stops sneaking, sprinting, swimming, gliding, crawling or flying                                                    | `Player`, `World`, `State`, `Value`                                  | Yes        |
| `PlayerExperienceEvent`   | A player is about to gain experience points, or lose them when Points is negative                                                                    | `Player`, `World?`, `Cause`, **`Points`**                            | Yes        |
| `PermissionChangedEvent`  | The permissions of a player changed: its permission level (Permission is null; read the new one on Player), or a named permission granted or revoked | `Player`, `Permission?`, `IsGranted`                                 | No         |
| `PlayerSkinChangeEvent`   | A player in the game is about to wear another skin (`ChangeSkin`): every client that lists it gets the new one                                       | `Player`, `World?`                                                   | Yes        |
| `ViewDistanceChangeEvent` | The client of a player asks for another view distance                                                                                                | `Player`, `World`, `Requested`, **`Radius`**                         | Yes        |

### Chat, commands and forms

| Event                     | When                                                                                                                                           | Fields (writable in bold)                              | Cancelable |
|---------------------------|------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------|------------|
| `PlayerChatEvent`         | A player wrote in the chat                                                                                                                     | `Player`, `World`, **`Message`**                       | Yes        |
| `ChatMessageRefusedEvent` | The chat refused what a player wrote: it is muted, wrote too soon or too much, has no channel, or a filter blocked it; the player was told why | `Player`, `ChannelId?`, `Message`, `Status`, `Reason?` | No         |
| `PlayerCommandEvent`      | A player sent a command                                                                                                                        | `Player`, `World`, **`CommandLine`**                   | Yes        |
| `FormResponseEvent`       | A player answered a form, or it closed without an answer (`Reason`), before the form of the plugin hears it                                    | `Player`, `World`, `IsSubmitted`, `Reason`, `Title`    | Yes        |
| `ProxyMessageEvent`       | The proxy of a player sent a message of its plugins with it, handled by a plugin or not (`Message` is the base64 of the bytes)                 | `Player`, `Channel`, `Message`                         | No         |

### Blocks

| Event                       | When                                                                                                                                   | Fields (writable in bold)                                                                                                            | Cancelable |
|-----------------------------|----------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|------------|
| `BlockBreakEvent`           | A block is about to break                                                                                                              | `World`, `Position`, `Player?`, `BreakingTicks`, **`Allowed`**, **`ShowEffects`**, **`WearTool`**, **`Experience`**, `State`, `Tool` | Yes        |
| `BlockPlaceEvent`           | A block is about to be placed                                                                                                          | `World`, `Position`, `Clicked`, `Player?`, **`PlaySound`**, **`UseUpItem`**, `Face`, **`State`**, `Item?`                            | Yes        |
| `BlockMiningEvent`          | A player in survival or adventure starts breaking a block                                                                              | `Player`, `World`, `Position`, `State`, `Face`, `Tool`, **`Ticks`**, **`ShowCracks`**, **`PlayHits`**                                | Yes        |
| `BlockInteractEvent`        | A player uses a block with the button that places blocks                                                                               | `Player`, `World`, `Position`, `State`, `Face`, `Item`                                                                               | Yes        |
| `BlockNeighborChangedEvent` | A block next to one that reacts to its neighbors changed                                                                               | `World`, `Position`, `State`, `Neighbor`                                                                                             | Yes        |
| `BlockScheduledTickEvent`   | A tick a block scheduled is due                                                                                                        | `World`, `Position`, `State`                                                                                                         | Yes        |
| `BlockPatternCompleteEvent` | A registered block pattern was found complete                                                                                          | `World`, `Player?`, `Cause`, `Match`                                                                                                 | Yes        |
| `BlockPatternBrokenEvent`   | A block of a tracked pattern changed to one the pattern does not accept: the pattern is no longer complete and is not watched any more | `World`, `Position`, `State`, `Match`                                                                                                | No         |
| `SignEditEvent`             | A player wrote on a side of a sign in the editor the server opened (`OpenEditor`)                                                      | `Player`, `Sign`, `World`, `IsFront`, **`Text`**                                                                                     | Yes        |
| `FurnaceBurnEvent`          | A furnace, blast furnace or smoker lights a new item of fuel to smelt what it holds                                                    | `World`, `Furnace`, `Fuel`, **`BurnTicks`**                                                                                          | Yes        |
| `FurnaceSmeltEvent`         | A furnace, blast furnace or smoker is done with one item                                                                               | `World`, `Furnace`, `Input`, **`Result`**                                                                                            | Yes        |

### Items and inventories

| Event                   | When                                                                                                                                    | Fields (writable in bold)                                                                                                   | Cancelable |
|-------------------------|-----------------------------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------|------------|
| `ItemUseEvent`          | A player uses the item it holds in the air                                                                                              | `Player`, `Item`, `Slot`                                                                                                    | Yes        |
| `ItemUseOnBlockEvent`   | A player uses the item it holds on a block that has no use of its own (after `BlockInteractEvent`)                                      | `Player`, `Item`, `Slot`, `Position`, `Face`, `Click`                                                                       | Yes        |
| `ItemReleaseEvent`      | A player released an item it was charging, such as a bow                                                                                | `Player`, `Item`, `Slot`, `UsedTicks`                                                                                       | Yes        |
| `ItemConsumeStartEvent` | A player starts eating or drinking the item it holds                                                                                    | `Player`, `Item`, `Slot`, **`UseDuration`**, **`IgnoreHunger`**                                                             | Yes        |
| `ItemConsumeEvent`      | A player finished eating or drinking the item it holds                                                                                  | `Player`, `Item`, `Slot`, `UsedTicks`, **`Nutrition`**, **`Saturation`**, **`UseUp`**, **`Leftover`**                       | Yes        |
| `ItemDropEvent`         | A player drops items from its inventory: they are thrown where it looks once the request of its client applies                          | `Player`, `Item`, **`Count`**, `SourceInventory`, `SourceSlot`                                                              | Yes        |
| `ItemPickupEvent`       | A player picks up an item lying in the world, or an arrow stuck in a block                                                              | `Player`, `Entity`, `Item`, `World`, **`Count`**                                                                            | Yes        |
| `ItemWearEvent`         | An item a player holds or wears is about to wear                                                                                        | `Player`, `Item`, `Inventory`, `Slot`, `Cause`, **`Amount`**                                                                | Yes        |
| `ItemCraftEvent`        | A player crafts a recipe, in the grid of its inventory or at a crafting table, once or more at a time (shift-click and the recipe book) | `Player`, `World`, `Times`, **`Result`**                                                                                    | Yes        |
| `ItemEnchantEvent`      | A player chose an offer of an enchanting table                                                                                          | `Player`, `World`, `Table`, `Item`, `Offer`, `RequiredLevel`, **`Levels`**, **`Lapis`**                                     | Yes        |
| `ItemAnvilEvent`        | A player takes what an anvil made of Item, Material and Name: a repair, enchantments brought over, a new name                           | `Player`, `World`, `Anvil`, `Item`, `Material`, `Name?`, **`Result`**, **`Levels`**, **`MaterialUsed`**, **`DamagesAnvil`** | Yes        |
| `ItemGrindstoneEvent`   | A player takes what a grindstone made of Item and Additional: their enchantments gone but for curses, and two of the same item joined   | `Player`, `World`, `Grindstone`, `Item`, `Additional`, **`Result`**, **`Experience`**                                       | Yes        |
| `HeldItemChangeEvent`   | The client of a player selected another hotbar slot                                                                                     | `Player`, `From`, **`To`**                                                                                                  | Yes        |
| `ArmorEquipEvent`       | A player puts a piece of armor on                                                                                                       | `Player`, `Item`, `Slot`, `Cause`                                                                                           | Yes        |
| `InventoryOpenEvent`    | A player opens an inventory screen                                                                                                      | `Player`, `Inventory`                                                                                                       | Yes        |
| `InventoryClickEvent`   | A player changes the items of an inventory screen: one action of a request of its client                                                | `Player`, `Action`, `Item`, `Swapped`, **`Allowed`**, `SourceInventory`, `SourceSlot`                                       | Yes        |
| `InventoryClosedEvent`  | A player closed an inventory screen                                                                                                     | `Player`, `Inventory`                                                                                                       | No         |

### Entities and combat

| Event                       | When                                                                                                               | Fields (writable in bold)                                                                                                         | Cancelable |
|-----------------------------|--------------------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|------------|
| `EntitySpawnedEvent`        | An entity came into a world: it spawned, or its chunk loaded it                                                    | `Entity`, `World`, `Cause`                                                                                                        | No         |
| `EntityRemovedEvent`        | An entity left a world, at the end of the tick                                                                     | `Entity`, `World`, `Reason`                                                                                                       | No         |
| `EntityDamageEvent`         | An entity is about to be hurt                                                                                      | `Entity`, `Cause`, `Attacker?`, `Direct?`, `World`, `RawAmount`, `IsCritical`, **`Amount`**, **`Knockback`**, **`NoDamageTicks`** | Yes        |
| `EntityDeathEvent`          | An entity is about to die                                                                                          | `Entity`, `Cause`, `Attacker?`, `World`, **`ShowsMessage`**, **`Experience`**                                                     | Yes        |
| `PlayerAttackEntityEvent`   | A player hits an entity it reached                                                                                 | `Player`, `Target`, `Held`, `World`, **`Damage`**, **`IsCritical`**, **`KnockbackLevel`**, **`HitDelayTicks`**, **`Knockback`**   | Yes        |
| `PlayerInteractEntityEvent` | A player uses an entity it reached (right click, or a tap)                                                         | `Player`, `Target`, `Held`, `ClickPosition`, `World`                                                                              | Yes        |
| `MobTargetEvent`            | A mob is about to change its target: the entity it chases and attacks                                              | `Mob`, `World`, `Cause`, `Previous?`, **`Target?`**                                                                               | Yes        |
| `EntityRideEvent`           | An entity is about to get on a vehicle, such as a player on a minecart; cancel so that it does not                 | `Entity`, `Vehicle`, `Cause`, `World`                                                                                             | Yes        |
| `EntityDismountEvent`       | An entity is about to get off its vehicle; cancel so that it stays on                                              | `Entity`, `Vehicle`, `Cause`, `World`                                                                                             | Yes        |
| `EntityEffectEvent`         | An entity is about to get an effect                                                                                | `Entity`, `World`, `Effect`, **`Amplifier`**, **`Duration`**, **`ShowParticles`**, **`IsImmune`**                                 | Yes        |
| `EntityEffectRemovedEvent`  | An entity lost an effect: it ran out, was taken away or cleared, the entity died, or a stronger one took its place | `Entity`, `World`, `Reason`, `EffectType`, `Amplifier`                                                                            | No         |
| `ProjectileHitEvent`        | A projectile hits an entity or a block                                                                             | `Projectile`, `Shooter?`, `Target?`, `Face`, `Point`, `World`, `HitsBlock`, `HitBlock`                                            | Yes        |
| `PotionSplashEvent`         | A thrown splash potion breaks and is about to give its effects to the living entities around                       | `Thrower?`, `Target?`, `Point`, **`Radius`**, `World`, `PotionProjectile`, `Projectile`, **`Potion`**                             | Yes        |
| `AreaEffectCloudEvent`      | The cloud of a lingering potion is about to give its effects to a living entity inside it                          | `Owner?`, `Entity`, `World`, `CloudEntity`, `Cloud`, **`Potion`**                                                                 | Yes        |

### Worlds

| Event                    | When                                                                              | Fields (writable in bold)                                                               | Cancelable |
|--------------------------|-----------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------|------------|
| `WorldLoadedEvent`       | A world was created or loaded; it ticks from the next tick of its group           | `World`                                                                                 | No         |
| `WorldUnloadingEvent`    | A world is about to unload: its players are still in it, and it is not saved yet  | `World`, `Save`                                                                         | No         |
| `WorldSaveEvent`         | A world is about to save                                                          | `World`, `ModifiedChunks`, `Cause`, **`SaveMetadata`**                                  | Yes        |
| `WorldRestoredEvent`     | The restore cache of a world put its modified chunks back as they were            | `World`, `Chunks`                                                                       | No         |
| `ChunkLoadedEvent`       | A chunk entered the memory of its world: read from the storage or newly generated | `World`, `Position`, `IsNew`, `Chunk`                                                   | No         |
| `ChunkUnloadEvent`       | A chunk no player saw for a while is about to leave memory                        | `World`, `Position`, `IsModified`, **`Save`**, `Chunk`                                  | Yes        |
| `WorldTimeEvent`         | The time of a world is about to advance, once per tick                            | `World`, `Time`, **`Step`**                                                             | Yes        |
| `TimeSetEvent`           | Code or a command set the time of a world                                         | `World`, `From`, `To`                                                                   | No         |
| `WeatherChangeEvent`     | The weather of a world is about to change                                         | `World`, `From`, `To`, `Cause`, **`Duration`**                                          | Yes        |
| `WorldBorderChangeEvent` | The border of a world is about to move or change size                             | `World`, `Cause`, `FromRadius`, **`CenterX`**, **`CenterZ`**, **`Radius`**, **`Ticks`** | Yes        |
| `SpawnPointChangedEvent` | Code or a command moved the spawn point of a world                                | `World`, `From`, `To`                                                                   | No         |
| `DifficultyChangedEvent` | Code or a command changed the difficulty of a world                               | `World`, `From`, `To`                                                                   | No         |
| `GameRuleChangedEvent`   | Code or a command changed a game rule of a world                                  | `World`, `RuleName`, `FromText`, `ToText`                                               | No         |
| `ExplosionEvent`         | An explosion is about to go off                                                   | `World`, `Position`, `Power`, `Source?`, `Attacker?`, `Options`                         | Yes        |

### The server

| Event                 | When                                                                                                                             | Fields (writable in bold) | Cancelable |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------|---------------------------|------------|
| `ServerStartedEvent`  | The server listens: its worlds are loaded and every plugin is enabled; players can join from now on                              | `Server`, `Port`          | No         |
| `ServerStoppingEvent` | The server is about to stop: its players are still in the game (they are disconnected next), and plugins are disabled after them | `Server`, `PlayerCount`   | No         |

## Reference

| Member                                       | What it is                                                                            |
|----------------------------------------------|---------------------------------------------------------------------------------------|
| `[EventHandler]`, `[EventHandler(priority)]` | Marks a handler (`EventHandlerAttribute`: `Priority`, `IgnoreCanceled`)               |
| `IgnoreCanceled = true`                      | Skips the handler for events an earlier handler canceled                              |
| `EventPriority`                              | `Lowest`, `Low`, `Normal` (the default), `High`, `Highest`, `Monitor`                 |
| `Context.Events.Register(listener)`          | Registers the handlers of a listener (`PluginEvents.Register`), from `OnEnable` on    |
| `Context.Events.Unregister(listener)`        | Removes them (`PluginEvents.Unregister`): `false` when it was not registered          |
| `PluginEvent`                                | The base of every event                                                               |
| `CancelableEvent.IsCanceled`                 | Whether the event is canceled; settable                                               |
| `CancelableEvent.Outcome`                    | How the event ended (`EventOutcome`), for monitors; `Pending` before them             |
| `EventOutcome`                               | `Pending`, `Done`, `Canceled`, `Refused`                                              |
| `IEventListener`                             | What the SDK adds to a `partial` class with handlers; you never implement it yourself |
| `const int Id` of each event                 | The number of the event in the SDK, as the log names it                               |

`EventHandlers`, `IPluginEvent<T>`, `EventPool<T>` and `PluginEventHeader` are used by the SDK; plugin code does not
use them, nor the protected members of `PluginEvent` (`EventData`, `SetText`, `SetOptionalText`).
