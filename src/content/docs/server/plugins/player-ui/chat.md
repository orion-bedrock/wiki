---
title: "Chat"
description: "Orion server plugins: channels, filters, mutes and the name a player shows in the chat."
sidebar:
  order: 7
---

The chat of an Orion server has channels: every player joins the default channel when it spawns, and writes to its
active channel. A plugin creates channels of its own (a team chat, a staff chat), filters messages, mutes players and
changes the name a player shows. The types are in `Orion.Sdk.Server.Chat`.

## Send messages

```csharp
player.SendMessage("Only you see this.");
GameServer.Current.Broadcast(Text.Lang("arena::round_starts", ("round", 2)));   // every player, in its language
```

What the chat shows from a plugin is a `Text`; what a player writes stays a `string` (it is what it typed).

## Channels

```csharp
ChatService chat = GameServer.Current.Chat;
ChatChannel red = chat.CreateChannel("team-red", maxSubscribers: 8);
red.DisplayName = "§cRed";                                   // {channel} in the chat format
red.Join(player);
player.SetActiveChatChannel(red);                            // what it writes goes there
red.Broadcast(Text.Lang("arena::team_tip"));                  // to every member, without a sender
red.MessageDelaySeconds = 2;                                 // slow mode
red.Leave(player);
red.Dispose();                                               // closes it: its members leave it
```

| Member                                                                    | What it does                                                                                                            |
|---------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| `chat.CreateChannel(id, maxSubscribers)`                                  | A channel of the plugin; 0 subscribers is no limit                                                                      |
| `chat.Channels`, `DefaultChannel`, `FindChannel(id)`                      | The channels of the server, the one players join when they spawn, one by id                                             |
| `channel.Join(player)`                                                    | Subscribes a player: `Subscribed`, `AlreadySubscribed`, `ChannelFull`, `TooManyChannels`, `ChannelClosed`, `MemberLeft` |
| `channel.Leave(player)`, `Contains(player)`, `Members`, `SubscriberCount` | Its members                                                                                                             |
| `channel.IsReadOnly`                                                      | Only broadcasts are written in it                                                                                       |
| `player.ActiveChatChannel`, `SetActiveChatChannel`, `ChatChannels`        | Where the player writes, and the channels it is in                                                                      |

A player's first channel becomes its active one. A channel of the plugin closes when it is disposed, or when the plugin
is disabled; disposing a channel of the server only lets it go.

## Filters

A filter sees every message before it is sent and lets it through, replaces its text or blocks it. It runs at once, on
the thread the message is sent from. A filter that throws is a fault of the plugin, and the message goes through.

**A lambda** for a quick rule:

```csharp
ChatFilter caps = GameServer.Current.Chat.AddFilter(call =>
{
    if (call.Content.Length > 8 && call.Content.All(c => !char.IsLower(c)))
    {
        call.Replace(call.Content.ToLowerInvariant());       // NO SHOUTING
    }
});
```

**A class** for a filter with state and settings:

```csharp
using Orion.Sdk.Server.Chat;

namespace Arena;

public sealed class WordFilter(IReadOnlyCollection<string> banned)
{
    public void Filter(ChatFilterCall call)
    {
        foreach (string word in banned)
        {
            if (call.Content.Contains(word, StringComparison.OrdinalIgnoreCase))
            {
                call.Block("Please keep the chat friendly.");
                return;
            }
        }

        call.Allow();
    }
}
```

```csharp
ChatFilter words = GameServer.Current.Chat.AddFilter(new WordFilter(["badword", "worseword"]).Filter);
if (GameServer.Current.Chat.FindChannel("team-red") is { } red)
{
    ChatFilter teamOnly = red.AddFilter(call => call.Replace("[Team] " + call.Content));   // one channel only
}
```

`Content` is the message as earlier filters left it, `RawText` exactly as the client sent it, `Player` who wrote it and
`Channel` where it goes. Dispose a filter to remove it.

## Mutes

```csharp
player.MuteFor(TimeSpan.FromMinutes(5), "Spam");
player.MutePermanently("Repeated insults");
if (player.IsMuted)
{
    double left = player.MuteSecondsLeft;                     // -1 for a mute that does not end
}

player.Unmute();
```

A muted player is told why (`MuteReason`) when it writes. `ChatMessageRefusedEvent` comes whenever the chat refuses
what a player wrote: muted, too soon, too long, no channel, or blocked by a filter (`Status`, `Reason`).

## The name in the chat, and writing as a player

```csharp
player.ChatDisplayName = "§c[Red] §f" + player.Name;         // {sender} in the chat format
player.CanUseFormattingCodes = player.HasPermission("chat.colors");
ChatSendStatus status = player.Chat("gg");                    // as if the player wrote it
```

`PlayerChatEvent` comes when a player writes, with its writable `Message` and cancelable ([Events](../../basics/events/)).
`ChatSendStatus` tells whether a message was sent and why not: `Sent`, `MemberLeft`, `NoActiveChannel`,
`ChannelClosed`, `NotSubscribed`, `ReadOnly`, `Muted`, `TooSoon`, `RateLimited`, `TooLong`, `Empty`, `Blocked`.

## Reference

| Member of `GameServer` | What it is             |
|------------------------|------------------------|
| `ChatService Chat`     | The chat of the server |

| Member of `Player`                                             | What it is                                                                |
|----------------------------------------------------------------|---------------------------------------------------------------------------|
| `ChatSendStatus Chat(string message)`                          | Writes in the chat as the player, through its mutes, limits and filters   |
| `string ChatDisplayName`                                       | The name the chat shows for it; settable                                  |
| `bool CanUseFormattingCodes`                                   | Whether it may write formatting codes (§); settable                       |
| `ChatChannel? ActiveChatChannel`                               | The channel it writes to, or `null`                                       |
| `bool SetActiveChatChannel(ChatChannel channel)`               | Makes a channel the one it writes to                                      |
| `IReadOnlyList<ChatChannel> ChatChannels`                      | The channels it is subscribed to                                          |
| `void MuteFor(TimeSpan duration, string? reason)`              | Mutes it for a time                                                       |
| `void MutePermanently(string? reason)`                         | Mutes it until it is unmuted                                              |
| `bool Unmute()`                                                | Unmutes it                                                                |
| `bool IsMuted`, `string? MuteReason`, `double MuteSecondsLeft` | Its mute: 0 seconds when it is not muted, -1 for a mute that does not end |

`ChatService`: The chat of the server: channels, and the filters of plugins.

| Member                                                         | What it is                                                                                                                                                                                                                                                                                 |
|----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `ChatFilter AddFilter(Action<ChatFilterCall> filter)`          | Adds a filter that sees every message of every channel before it is sent, on the thread the message is sent from: it lets it through, replaces its text or blocks it (ChatFilterCall). A filter that throws is a fault of the plugin and lets the message through. Dispose it to remove it |
| `IReadOnlyList<ChatChannel> Channels`                          | The channels, at this moment                                                                                                                                                                                                                                                               |
| `ChatChannel CreateChannel(string id, int maxSubscribers = 0)` | Creates a channel of the plugin; dispose it to close it (Orion closes what the plugin did not when it is disabled)                                                                                                                                                                         |
| `ChatChannel? DefaultChannel`                                  | The channel players join when they spawn, or null                                                                                                                                                                                                                                          |
| `ChatChannel? FindChannel(string id)`                          | Finds a channel by its identifier                                                                                                                                                                                                                                                          |
| `int MemberCount`                                              | The number of members of the chat: the players in the game                                                                                                                                                                                                                                 |

`ChatChannel`: A channel of the chat: its members, its settings and its filters.

| Member                                                | What it is                                                                                                                                  |
|-------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `ChatFilter AddFilter(Action<ChatFilterCall> filter)` | Adds a filter that sees the messages of this channel before they are sent; dispose it to remove it                                          |
| `int Broadcast(Text text)`                            | Shows a text to every member, without a sender: raw through the channel, translated in the language of each member                          |
| `bool Close()`                                        | Closes the channel: its members leave it                                                                                                    |
| `bool Contains(Player player)`                        | Tells whether a player is subscribed to the channel                                                                                         |
| `string DisplayName`                                  | The name the format shows as {channel}; formatting codes are kept; settable                                                                 |
| `void Dispose()`                                      | Closes a channel of the plugin (its members leave it) and releases it; a channel of the server is only let go. Disposing again does nothing |
| `string Id`                                           | The identifier                                                                                                                              |
| `bool IsClosed`                                       | Whether the channel was closed                                                                                                              |
| `bool IsReadOnly`                                     | Whether only broadcasts are written in the channel; settable                                                                                |
| `ChatSubscribeResult Join(Player player)`             | Subscribes a player to the channel; the first channel of a player becomes its active one                                                    |
| `bool Leave(Player player)`                           | Unsubscribes a player from the channel                                                                                                      |
| `int MaxSubscribers`                                  | The most members the channel takes                                                                                                          |
| `IReadOnlyList<Player> Members`                       | The players subscribed to the channel, at this moment                                                                                       |
| `double MessageDelaySeconds`                          | The seconds a member waits between two messages in the channel (a slow mode), 0 for none; settable                                          |
| `int SubscriberCount`                                 | The number of members                                                                                                                       |

`ChatFilter`: A filter of the chat of the plugin; dispose it to remove it.

| Member           | What it is                                       |
|------------------|--------------------------------------------------|
| `void Dispose()` | Removes the filter. Disposing again does nothing |

`ChatFilterCall`: A message a filter of the plugin sees; valid during the call of the filter.

| Member                         | What it is                                                               |
|--------------------------------|--------------------------------------------------------------------------|
| `void Allow()`                 | Lets the message through as it is                                        |
| `void Block(string? reason)`   | Refuses the message; the sender is told why                              |
| `ChatChannel Channel`          | The channel the message goes to                                          |
| `string Content`               | The message as earlier filters left it, sanitized                        |
| `Player? Player`               | The player who wrote the message, or null for a member that is no player |
| `string RawText`               | The message exactly as the client sent it                                |
| `void Replace(string content)` | Lets the message through with another text, which the next filters see   |

`ChatSendStatus`: Whether a message written in the chat was sent, and why not: `Sent`, `MemberLeft`, `NoActiveChannel`,
`ChannelClosed`, `NotSubscribed`, `ReadOnly`, `Muted`, `TooSoon`, `RateLimited`, `TooLong`, `Empty`, `Blocked`.

`ChatSubscribeResult`: Whether a player joined a channel of the chat, and why not: `Subscribed`, `AlreadySubscribed`,
`ChannelFull`, `TooManyChannels`, `ChannelClosed`, `MemberLeft`.
