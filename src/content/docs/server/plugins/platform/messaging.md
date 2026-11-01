---
title: "Messages with the proxy"
description: "Orion server plugins: messages between your plugin and the plugins of the proxy."
sidebar:
  order: 3
---

When a player comes through an Orion proxy, the plugins of its server and the plugins of the proxy can talk about that
player: a server asks the proxy to open its server selector, the proxy tells the server where the player went. A
message is bytes on a channel, sent with a player to the other side of its connection: from a server to its proxy,
from the proxy to the server the player is on. The proxy side is in [Messages with the servers](../../../../proxy/plugins/network/messaging/);
`samples/HubCompass` (server) and `samples/Hub` (proxy) use both directions.

## Send

A message carries bytes, a text or JSON. JSON goes through a source-generated `JsonTypeInfo<T>` (Native AOT has no
reflection-based serialization), so declare the types it carries with a `JsonSerializerContext`:

```csharp
using System.Text.Json.Serialization;

namespace Hub;

public sealed record PartyInvite(string From, int Size);

[JsonSerializable(typeof(PartyInvite))]
internal sealed partial class PartyJson : JsonSerializerContext;
```

```csharp
bool sent = Context.Messages.Send(player, "hub:menu", []);                          // bytes
Context.Messages.SendText(player, "hub:status", "survival Completed");             // UTF-8 text
Context.Messages.SendJson(player, "party:invite", new PartyInvite("Steve", 3), PartyJson.Default.PartyInvite);
```

`Send` gives `false` when the player has no proxy on the other side (it joined the server directly): tell the player,
or do the work on the server instead.

## Receive: methods or lambdas

**`[MessageHandler]` methods** of a `partial` listener class, registered with its event handlers (those of the plugin
class are registered for you):

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Players;

namespace HubCompass;

public sealed partial class CompassPlugin : ServerPlugin
{
    [MessageHandler("hub:status")]
    public static void OnStatus(Player player, ReadOnlySpan<byte> data) => player.SendMessage("[Hub] " + PluginMessages.Text(data));
}
```

**`Context.Messages.On`** with a lambda, from `OnEnable` on, when the channel or the handler is only known at run time:

```csharp
Context.Messages.On("party:invite", (player, data) =>
{
    if (PluginMessages.Json(data, PartyJson.Default.PartyInvite) is { } invite)
    {
        player.SendMessage($"{invite.From} invites you to a party of {invite.Size}.");
    }
});
```

| Style              | Prefer it when                                                            |
|--------------------|---------------------------------------------------------------------------|
| `[MessageHandler]` | Channels fixed at build time: the build checks the name and the signature |
| `Messages.On`      | Channels built at run time, or handlers that capture state of the moment  |

A handler is a method that returns `void` and takes the `Player` and a `ReadOnlySpan<byte>` (`ORSG009` otherwise).

## Rules

| Rule         | What                                                                                                                               |
|--------------|------------------------------------------------------------------------------------------------------------------------------------|
| Channel      | 1 to 64 letters, digits, `_`, `-`, `.`, `:` and `/`, such as `hub:menu`; not starting with `orion:`, which Orion keeps (`ORSG011`) |
| One handler  | A plugin handles a channel once (`ORSG010`, or `PluginException` from `On`); several plugins may handle the same channel           |
| Size         | At most `PluginMessages.MaxDataLength` bytes (24 576)                                                                              |
| Thread       | A message is handled on the thread of the world of its player                                                                      |
| The bytes    | Valid during the call only: copy what you keep (`data.ToArray()`)                                                                  |
| Nobody hears | A message no plugin handles is dropped; so are those of the channels of a disabled plugin                                          |
| Trust        | Messages come only from the proxy in front of the server (a trusted gateway of `server.json`), never from the client               |

`ProxyMessageEvent` comes for every message of the proxy, handled or not, with the `Channel` and the `Message` as
base64: for logging or statistics.

## Reference

`PluginMessages` (`Context.Messages`, namespace `Orion.Sdk`):

| Member                                                                           | What it does                                                   |
|----------------------------------------------------------------------------------|----------------------------------------------------------------|
| `bool Send(Player player, string channel, ReadOnlySpan<byte> data)`              | Sends bytes on a channel; `false` when the player has no proxy |
| `bool SendText(Player player, string channel, string text)`                      | Sends a text, as UTF-8                                         |
| `bool SendJson<T>(Player player, string channel, T value, JsonTypeInfo<T> type)` | Sends a value as JSON, with a source-generated contract        |
| `void On(string channel, PluginMessageHandler<Player> handler)`                  | Handles the messages of a channel                              |
| `static string Text(ReadOnlySpan<byte> data)`                                    | Reads the bytes of a message as UTF-8 text                     |
| `static T? Json<T>(ReadOnlySpan<byte> data, JsonTypeInfo<T> type)`               | Reads the bytes of a message as JSON                           |
| `const int MaxDataLength`                                                        | The most bytes a message carries: 24 576                       |

| Type                                      | What it is                                                             |
|-------------------------------------------|------------------------------------------------------------------------|
| `MessageHandlerAttribute(string channel)` | Marks a handler of a channel (`Channel`)                               |
| `PluginMessageHandler<TPlayer>`           | `void (TPlayer player, ReadOnlySpan<byte> data)`: the delegate of `On` |
| `IPluginPlayer<TSelf>`                    | What makes `Player` a player of messages; for the SDK                  |

The methods of `PluginMessages` are generic over the player (`Send<TPlayer>`), so that one type serves the SDKs of the
server and of the proxy; the compiler infers `Player`. `On` with a lambda takes the `Player` of the server SDK without
naming it (`PluginMessagesExtensions`, namespace `Orion.Sdk.Server`).
