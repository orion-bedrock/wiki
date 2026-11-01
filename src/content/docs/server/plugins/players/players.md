---
title: "Players"
description: "Orion server plugins: finding players, who they are, moving them, their game mode, food, experience, time and weather."
sidebar:
  order: 1
---

`Player` (namespace `Orion.Sdk.Server.Players`) is a player in the game. It is a `LivingEntity`, so everything of
entities works on it too (position, health, effects: [Entities](../../entities/entities/), [Damage, healing and death](../../entities/damage/),
[Effects and potions](../../entities/effects/)), and it adds who the player is, what it sees and what it may do.

## Find players

```csharp
GameServer server = GameServer.Current;
Player? steve = server.FindPlayer("Steve");                      // by name, ignoring case
Player? byUuid = server.FindPlayerByUuid("2b9a3e6f-0c1d-4e7a-9f3b-5d8c1a2b4e6f");
int online = server.PlayerCount;
foreach (Player p in server.Players)                             // a copy: safe to change the game while you go through it
{
    p.SendMessage($"{online} players online");
}

IReadOnlyList<Player> inArena = server.FindWorld("arena")?.Players ?? [];
```

Most of the time the player comes to you: `e.Player` of an event, `call.Player` of a command, the player of a form or a
menu. Keep a `Player` as long as you need it, and check `IsOnline` before using one you kept: a player that left
throws `PluginObjectGoneException` (an `ObjectDisposedException`) on its next call. Two `Player` objects of the same
player are equal (`==`), so they work as keys of a dictionary.

`GameServer.Capacity` is the most players in the game at once; set it to change the limit while the server runs.

## Who the player is

| Member                                   | What it is                                                                                      |
|------------------------------------------|-------------------------------------------------------------------------------------------------|
| `Name`                                   | The name of the player                                                                          |
| `Uuid`                                   | Its UUID, as text: the stable key to store data about a player                                  |
| `Xuid`                                   | Its Xbox user ID, or `null` when it is not signed in to Xbox                                    |
| `PlayFabId`                              | Its PlayFab ID                                                                                  |
| `Locale`                                 | Its language, such as `en_US`: what translated texts are shown in                               |
| `Platform`, `DeviceModel`, `GameVersion` | What its client says it runs on: Android, Windows, Xbox…; untrusted, for display and statistics |
| `IsOperator`, `Permission`               | Whether it is an operator, and its permission level ([Permissions and abilities](../permissions/))          |

## Talk to the player

```csharp
player.SendMessage("Welcome!");                                  // the chat
player.SendMessage(Text.Lang("arena::welcome", ("player", player.Name)));
player.Hud.ShowTitle("Round 1", "Fight!", 10, 60, 10);            // the screen: hud.md
player.PlaySound(SoundIds.RandomLevelup, 1, 1);                   // sounds-and-particles.md
player.Kick("The server is restarting.");                        // disconnects it with a message
```

Forms ([Forms](../../player-ui/forms/)), menus ([Menus](../../player-ui/menus/)), boss bars, sidebars, the camera and floating texts are
other ways to show things to a player.

## Move the player

```csharp
player.Teleport(new Vector3(0.5f, 64, 0.5f));                     // within its world, keeping where it looks
player.TeleportLooking(new Vector3(0.5f, 64, 0.5f), 0, 180);      // and turned: pitch, yaw
if (GameServer.Current.FindWorld("arena") is { } arena)
{
    bool moved = await player.TeleportAsync(arena, arena.Spawn);  // to another world
}

player.TransferToServer("play.example.com", 19132);               // to another server
```

| Member                            | Raises                | Notes                                                                                       |
|-----------------------------------|-----------------------|---------------------------------------------------------------------------------------------|
| `Teleport`, `TeleportLooking`     | `PlayerTeleportEvent` | Within its world; `false` when a handler canceled it                                        |
| `TeleportAsync(world, position)`  | `PlayerTransferEvent` | To another world; completes on the thread of the world it arrives in, `false` when canceled |
| `TransferToServer(address, port)` | `ServerTransferEvent` | Sends the player to another server; behind an Orion proxy, to a server of that proxy        |
| `Respawn()`                       | `PlayerRespawnEvent`  | Brings a dead player back at once, with full health and food                                |

## Game mode

```csharp
player.GameMode = GameMode.Adventure;                             // the client is told at once
```

`GameMode` is `Survival`, `Creative`, `Adventure` or `Spectator`. Setting it changes it at once;
`GameModeChangeEvent` comes when the game mode changes through the game, such as with a command.

## Food, health and speed

`player.Attributes` holds what the bars of the screen show, besides health (which is on `LivingEntity`):

```csharp
player.Attributes.Food = 20;                                       // 0 to 20, in half drumsticks
player.Attributes.Saturation = 5;
player.Attributes.MovementSpeed = 0.15f;                           // faster than the default 0.1
player.Health = player.MaxHealth;                                  // half hearts
```

## Experience

```csharp
player.Experience.Add(50);                                         // points, through PlayerExperienceEvent
player.Experience.AddLevels(2);
if (player.Experience.TrySpendLevels(3))
{
    player.Inventory.Add(new ItemStack(ItemIds.Diamond));            // a reward that costs three levels
}

int toNext = PlayerExperience.PointsToNext(player.Experience.Level);  // the formulas of the game
```

## Time and weather of one player

A player can see a time or a weather of its own, whatever its world does; `Reset` gives it the world's again:

```csharp
player.Time.Set(18_000);                                           // midnight, for this player only
player.Weather.Set(WeatherKind.Rain);
player.Time.Reset();
```

## What the player does

`player.States` tells what its body does (`Sneaking`, `Sprinting`, `Swimming`, `Gliding`, `Crawling`, `Flying`; flags),
and `PlayerStateChangeEvent` comes when one changes. `player.Abilities` tells what it may do (build, mine, fly…), as the
server works it out from its game mode and permission; change it in `PlayerAbilitiesEvent`
([Permissions and abilities](../permissions/)).

```csharp
if (player.States.HasFlag(PlayerStates.Sneaking))
{
    player.SendMessage("Sneaky!");
}
```

## Other things a player does

| Member                      | What it does                                                                                                |
|-----------------------------|-------------------------------------------------------------------------------------------------------------|
| `Chat(message)`             | Writes in the chat as the player, through mutes and filters; gives a `ChatSendStatus` ([Chat](../../player-ui/chat/))  |
| `RunCommand(line)`          | Runs a command as the player and returns its output ([Commands](../../basics/commands/))                            |
| `DropItem(stack)`           | Throws a stack where the player looks, as its drop key does, without taking it from its inventory           |
| `CanReach(position)`        | Whether a block is within the reach of the player                                                           |
| `OpenMenu`, `OpenContainer` | The menu ([Menus](../../player-ui/menus/)) or the container block ([Block entities](../../worlds/block-entities/)) it has open |

## The join and leave events

| Event                      | When                                                                          | Use it to                      |
|----------------------------|-------------------------------------------------------------------------------|--------------------------------|
| `PlayerLoginEvent`         | Logged in, before it joins: set its `GameMode` and `Permission`, or refuse it | Bans, whitelists, full servers |
| `PlayerSpawnLocationEvent` | Before it is sent to a world: choose the `World` and `Position`               | Spawning in a lobby            |
| `PlayerJoinEvent`          | In the game: its client left the loading screen                               | Welcomes, kits, showing boards |
| `PlayerQuitEvent`          | Left: out of its world, the chat and the player list                          | Saving its data                |

```csharp
[EventHandler]
public static void OnSpawnLocation(PlayerSpawnLocationEvent e)
{
    if (GameServer.Current.FindWorld("lobby") is { } lobby)
    {
        e.World = lobby;
        e.Position = lobby.Spawn;
    }
}

[EventHandler]
public void OnQuit(PlayerQuitEvent e) => Context.Logger.LogInformation("{Player} left", e.Player.Name);
```

The server sends no join or leave message of its own: send yours from these events. The full list is in
[Events](../../basics/events/).

## Reference

Members of `Player` itself; those of `LivingEntity` and `Entity` (position, health, effects, name tag…) are in
[Entities](../../entities/entities/).

`Player`: a player on the server.

| Member                                                                                                  | What it is                                                                                                                                                                                                 |
|---------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `PlayerAbilities Abilities`                                                                             | What the player may do, worked out again when its game mode or permission changes (`PlayerAbilitiesEvent`)                                                                                                 |
| `ChatChannel? ActiveChatChannel`                                                                        | The channel what the player writes goes to, or null                                                                                                                                                        |
| `ArmorInventory Armor`                                                                                  | The armor the player wears                                                                                                                                                                                 |
| `PlayerAttributes Attributes`                                                                           | The health, hunger and experience of the player                                                                                                                                                            |
| `PlayerCamera Camera`                                                                                   | The camera of the player: perspectives, shots, fades, the field of view, paths and cinematics                                                                                                              |
| `bool CanReach(BlockPosition position)`                                                                 | Tells whether a block is within the reach of the eyes of the player                                                                                                                                        |
| `bool CanUseFormattingCodes`                                                                            | Whether the player may write formatting codes (§) in the chat; settable                                                                                                                                    |
| `bool ChangeSkin(Skin skin)`                                                                            | Gives the player another skin, through `PlayerSkinChangeEvent`                                                                                                                                             |
| `ChatSendStatus Chat(string message)`                                                                   | Makes the player write in the chat, as if it had typed it: to its active channel, through the mutes, limits and filters of the chat                                                                        |
| `IReadOnlyList<ChatChannel> ChatChannels`                                                               | The channels the player is subscribed to                                                                                                                                                                   |
| `string ChatDisplayName`                                                                                | The name the chat shows for the player ({sender} of the formats); settable                                                                                                                                 |
| `string? DeviceModel`                                                                                   | The model of the device of the player, as its client reports it, or null                                                                                                                                   |
| `ItemEntity DropItem(ItemStack stack)`                                                                  | Throws a stack where the player looks, as its drop key does: it flies a couple of blocks, and nobody picks it up for two seconds                                                                           |
| `PlayerExperience Experience`                                                                           | The experience of the player: its level and the bar towards the next one                                                                                                                                   |
| `PlayerForms Forms`                                                                                     | The forms the player sees, and the page of the server in its settings                                                                                                                                      |
| `GameMode GameMode`                                                                                     | The game mode; the client is told at once; settable                                                                                                                                                        |
| `string? GameVersion`                                                                                   | The version of the game of the player, such as 1.26.50, or null                                                                                                                                            |
| `bool GrantPermission(string permission)`                                                               | Grants a named permission to the player, until it leaves                                                                                                                                                   |
| `bool HasPermission(string permission)`                                                                 | Tells whether the player has a named permission: operators have all; others need it granted in Permissions                                                                                                 |
| `PlayerHud Hud`                                                                                         | What the player sees over the game: titles, the action bar, notifications and hidden parts of the HUD                                                                                                      |
| `PlayerInventory Inventory`                                                                             | The inventory of the player: its hotbar, the slot it holds and the rest of its slots                                                                                                                       |
| `bool IsMuted`                                                                                          | Whether the player is muted                                                                                                                                                                                |
| `bool IsOnline`                                                                                         | Whether the player is in a game and did not leave it                                                                                                                                                       |
| `bool IsOperator`                                                                                       | Whether the player is an operator                                                                                                                                                                          |
| `void Kick(Text message)`                                                                               | Disconnects the player with a message, raw or in its language                                                                                                                                              |
| `PlayerListView ListView`                                                                               | What the player sees in its player list: plugins hide players from it or add entries of their own                                                                                                          |
| `string Locale`                                                                                         | The name of the language of the player, such as en_US (Locale)                                                                                                                                             |
| `void MuteFor(TimeSpan duration, string? reason)`                                                       | Mutes the player for a time; it is told why when it writes                                                                                                                                                 |
| `void MutePermanently(string? reason)`                                                                  | Mutes the player until it is unmuted                                                                                                                                                                       |
| `string? MuteReason`                                                                                    | Why the player is muted, or null                                                                                                                                                                           |
| `double MuteSecondsLeft`                                                                                | The seconds the mute of the player lasts yet: 0 when it is not muted, -1 for a mute that does not end                                                                                                      |
| `string Name`                                                                                           | The name of the player                                                                                                                                                                                     |
| `OffhandInventory Offhand`                                                                              | The offhand of the player                                                                                                                                                                                  |
| `Container? OpenContainer`                                                                              | The container of a block the player has open (or is opening), or null; for a double chest, the half its window opens on                                                                                    |
| `Menu? OpenMenu`                                                                                        | The menu the player has open (or is opening), or null                                                                                                                                                      |
| `PlayerPermission Permission`                                                                           | The permission level of the player (operators come from `server.json`; plugins never change it)                                                                                                            |
| `DevicePlatform Platform`                                                                               | The platform the client of the player says it runs on                                                                                                                                                      |
| `string PlayFabId`                                                                                      | The PlayFab ID of the player, which its client and the services of the game know it by                                                                                                                     |
| `void PlaySound(string soundId, float volume, float pitch)`                                             | Plays a sound definition to this player alone, at its head                                                                                                                                                 |
| `void RefreshAbilities()`                                                                               | Works out the abilities of the player again, through `PlayerAbilitiesEvent`: what a plugin changes there is sent to the client                                                                             |
| `bool Respawn()`                                                                                        | Brings the player back from death at once, where `PlayerRespawnEvent` says (the spawn of its world by default), with full health and food                                                                  |
| `void RestoreInventory(PlayerInventorySnapshot snapshot)`                                               | Puts back everything a snapshot holds                                                                                                                                                                      |
| `bool RevokePermission(string permission)`                                                              | Revokes a named permission from the player                                                                                                                                                                 |
| `string RunCommand(string command)`                                                                     | Runs a command as the player, with its permissions, as if it had typed it (without PlayerCommandEvent): the replies and the failure come back as the output, one line each, instead of reaching the player |
| `PlayerScoreboards Scoreboards`                                                                         | The scoreboard and the sidebar the player sees                                                                                                                                                             |
| `void SendMessage(Text message)`                                                                        | Shows a message in the chat of the player, with the next tick of its world: plain, or in its language                                                                                                      |
| `bool SetActiveChatChannel(ChatChannel channel)`                                                        | Makes a channel the one what the player writes goes to                                                                                                                                                     |
| `void ShowParticle(string particleId, Vector3 position)`                                                | Shows a particle effect to this player alone                                                                                                                                                               |
| `void ShowParticle(string particleId, Math.Vector3 position, params Worlds.MolangVariable[] variables)` | Shows a particle effect to this player only, starting with Molang variables                                                                                                                                |
| `Skin Skin`                                                                                             | The skin the player wears                                                                                                                                                                                  |
| `PlayerInventorySnapshot SnapshotInventory()`                                                           | Copies everything the player carries (inventory, armor, offhand, cursor, held slot), as a value a plugin may keep ([Inventory snapshots](../../items/inventory-snapshots/))                                       |
| `PlayerStates States`                                                                                   | What the player is doing with its body (sneaking, sprinting, flying), as `PlayerStateChangeEvent` accepted it                                                                                              |
| `void StopAllSounds(bool stopMusic)`                                                                    | Stops every sound this player hears                                                                                                                                                                        |
| `void StopSound(string soundId)`                                                                        | Stops a sound definition for this player                                                                                                                                                                   |
| `Task<bool> TeleportAsync(World world, Vector3 position)`                                               | Moves the player to a position of a world, through `PlayerTransferEvent`; completes on the thread of the world it arrives in                                                                               |
| `PlayerTime Time`                                                                                       | The time of day the player sees: the time of its world, or one of its own                                                                                                                                  |
| `bool TransferToServer(string address, int port)`                                                       | Sends the player to another server, if `ServerTransferEvent` lets it                                                                                                                                       |
| `bool Unmute()`                                                                                         | Unmutes the player                                                                                                                                                                                         |
| `PlayerWeather Weather`                                                                                 | The weather the player sees: the weather of its world, or one of its own                                                                                                                                   |
| `string? Xuid`                                                                                          | The XUID of the player, or null for a player that is not signed in to Xbox                                                                                                                                 |

`PlayerAttributes`: The health, hunger and experience of a player, and how fast it walks.

| Member                       | What it is                                                                                                                           |
|------------------------------|--------------------------------------------------------------------------------------------------------------------------------------|
| `float CurrentMovementSpeed` | The walking speed with the speed and slowness effects of the player: 20 % more and 15 % less per level                               |
| `void Exhaust(float amount)` | Adds exhaustion, as running or the hunger effect do: every 4 points cost one point of saturation, or of food when saturation is gone |
| `float Exhaustion`           | The exhaustion; actions add to it (Exhaust) and it costs saturation or food; settable                                                |
| `int Food`                   | The food bar, in half drumsticks; settable                                                                                           |
| `float MovementSpeed`        | The walking speed without effects, 0.1 by default; speed and slowness change it on top (`CurrentMovementSpeed`); settable            |
| `float Saturation`           | The saturation, spent before the food bar; settable                                                                                  |

`PlayerExperience`: The experience of a player (`player.Experience`): its level and the bar towards the next one, with
the formulas of the game.

| Member                                 | What it is                                                                                      |
|----------------------------------------|-------------------------------------------------------------------------------------------------|
| `bool Add(int points)`                 | Gives points, or takes them when negative, through `PlayerExperienceEvent`                      |
| `void AddLevels(int levels)`           | Gives levels, or takes them when negative; the bar keeps how full it is                         |
| `int Level`                            | The level; the bar keeps how full it is; settable                                               |
| `int Points`                           | The points in the bar                                                                           |
| `static int PointsToNext(int level)`   | The points that take a level to the next one: 2L + 7 up to 15, 5L − 38 up to 30, 9L − 158 above |
| `int PointsToNextLevel`                | The points the bar takes to reach the next level                                                |
| `static long PointsToReach(int level)` | The points it takes to reach a level from nothing                                               |
| `float Progress`                       | How full the bar towards the next level is, from 0 to 1                                         |
| `void Reset()`                         | Takes every level and point                                                                     |
| `void SetTotal(long total)`            | Sets every point the level and the bar hold                                                     |
| `long Total`                           | Every point the level and the bar hold                                                          |
| `bool TrySpendLevels(int levels)`      | Takes levels if the player has them, as the enchanting table and anvils do                      |

`PlayerTime`: The time of day a player sees: the time of its world, or one of its own that stays where it is set,
whatever the time of the world does.

| Member               | What it is                                                                                          |
|----------------------|-----------------------------------------------------------------------------------------------------|
| `bool IsOverridden`  | Whether the player sees a time of its own                                                           |
| `int Override`       | The time the player sees instead of the time of its world, or -1 when it sees the time of its world |
| `void Reset()`       | Shows the player the time of its world again                                                        |
| `void Set(int time)` | Shows the player a time of its own, which does not advance                                          |

`PlayerWeather`: The weather a player sees: the weather of its world, or one of its own that stays as it is set,
whatever the weather of the world does.

| Member                          | What it is                                                                                                   |
|---------------------------------|--------------------------------------------------------------------------------------------------------------|
| `bool IsOverridden`             | Whether the player sees a weather of its own                                                                 |
| `WeatherKind Override`          | The weather the player sees instead of the weather of its world; Clear when it sees the weather of its world |
| `void Reset()`                  | Shows the player the weather of its world again                                                              |
| `void Set(WeatherKind weather)` | Shows the player a weather of its own, which does not change                                                 |

`GameMode`: How a player plays: what it can do and how it is affected.

| Member          | What it is                                    |
|-----------------|-----------------------------------------------|
| `Survival = 0`  | Breaks blocks over time, takes damage         |
| `Creative = 1`  | Breaks blocks at once, flies, takes no damage |
| `Adventure = 2` | Cannot break or place blocks by default       |
| `Spectator = 3` | Flies through blocks and only watches         |

`PlayerStates`: What a player is doing with its body, as its client reports it.

| Member          | What it is                           |
|-----------------|--------------------------------------|
| `None = 0`      | Nothing special: walking or standing |
| `Sneaking = 1`  | Sneaking                             |
| `Sprinting = 2` | Sprinting                            |
| `Swimming = 4`  | Swimming                             |
| `Gliding = 8`   | Gliding with an elytra               |
| `Crawling = 16` | Crawling under a low block           |
| `Flying = 32`   | Flying, as creative players do       |

`DevicePlatform`: The platform a client says it runs on (Platform, as the game numbers it): untrusted, for display and
statistics.

| Member              | What it is                                         |
|---------------------|----------------------------------------------------|
| `Unknown = 0`       | Not reported, or a number the game does not define |
| `Android = 1`       | Android                                            |
| `IOS = 2`           | iOS and iPadOS                                     |
| `MacOS = 3`         | macOS                                              |
| `FireOS = 4`        | Fire OS (Amazon)                                   |
| `GearVR = 5`        | Gear VR                                            |
| `HoloLens = 6`      | HoloLens                                           |
| `WindowsStore = 7`  | Windows, the Microsoft Store edition               |
| `Windows = 8`       | Windows, the desktop edition                       |
| `Dedicated = 9`     | A dedicated server                                 |
| `TvOS = 10`         | tvOS                                               |
| `PlayStation = 11`  | PlayStation                                        |
| `Switch = 12`       | Nintendo Switch                                    |
| `Xbox = 13`         | Xbox                                               |
| `WindowsPhone = 14` | Windows Phone                                      |
| `Linux = 15`        | Linux                                              |

`PlayerPermission`: What a player is allowed on the server, beyond the rules of its game mode.

| Member         | What it is                                                                |
|----------------|---------------------------------------------------------------------------|
| `Visitor = 0`  | Can only look around                                                      |
| `Member = 1`   | A normal player                                                           |
| `Operator = 2` | An operator: operator commands and teleporting (operators of server.json) |
`PlayerTeleportCause` (the `Cause` of `PlayerTeleportEvent`): Why a player is teleported within its world.

| Member            | What it is                                         |
|-------------------|----------------------------------------------------|
| `Plugin = 0`      | Code moved it                                      |
| `Command = 1`     | A command moved it                                 |
| `EnderPearl = 2`  | An ender pearl it threw landed                     |
| `WorldBorder = 3` | It walked out of the world border and was put back |

`GameModeChangeCause` (the `Cause` of `GameModeChangeEvent`): Why the game mode of a player changes.

| Member        | What it is           |
|---------------|----------------------|
| `Plugin = 0`  | Code changed it      |
| `Command = 1` | A command changed it |

`PlayerExperienceCause` (the `Cause` of `PlayerExperienceEvent`): Why a player gains or loses experience
points.

| Member        | What it is                                                                 |
|---------------|----------------------------------------------------------------------------|
| `Plugin = 0`  | Code gave or took them                                                     |
| `Orb = 1`     | The player picked up experience orbs: those it touched in a tick, together |
| `Command = 2` | A command gave or took them                                                |

`PlayerTransferCause` (the `Cause` of `PlayerTransferEvent`): Why a player moves to another world.

| Member            | What it is                                          |
|-------------------|-----------------------------------------------------|
| `Plugin = 0`      | Code moved it                                       |
| `Command = 1`     | A command moved it                                  |
| `WorldUnload = 2` | Its world is unloading; the move cannot be canceled |

`ServerTransferCause` (the `Cause` of `ServerTransferEvent`): Why a player is sent to another server.

| Member        | What it is        |
|---------------|-------------------|
| `Plugin = 0`  | Code sent it      |
| `Command = 1` | A command sent it |
