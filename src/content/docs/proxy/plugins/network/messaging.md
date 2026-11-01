---
title: "Messages with the servers"
description: "Orion proxy plugins: messages between your plugin and the plugins of the servers."
sidebar:
  order: 8
---

The plugins of the proxy and the plugins of the servers behind it talk about a player with messages: bytes on a
channel, sent with the player to the other side of its connection. From the proxy, a message reaches the server the
player is on; from a server, it reaches the proxy. A server asks the proxy to open its selector, the proxy tells the
server where the player went. The server side is in [Messages with the proxy](../../../../server/plugins/platform/messaging/); `samples/Hub`
(proxy) and `samples/HubCompass` (server) use both directions.

## Receive: methods or lambdas

**`[MessageHandler]` methods** of a `partial` listener class (those of the plugin class are registered for you):

```csharp
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Forms;
using Orion.Sdk.Proxy.Players;

namespace Network;

public sealed partial class HubPlugin : ProxyPlugin
{
    // A server asks for the selector of the network (the compass of HubCompass).
    [MessageHandler("hub:menu")]
    public void OnMenu(Player player, ReadOnlySpan<byte> data) =>
        player.Forms.Show(new SimpleForm("Servers").Button("Lobby", onClick: p => _ = p.TransferAsync("lobby")));
}
```

**`Context.Messages.On`** with a lambda, from `OnEnable` on:

```csharp
Context.Messages.On("game:state", (player, data) =>
{
    string state = PluginMessages.Text(data);                         // "waiting" or "playing"
    if (player.Server is { } server)
    {
        server.Joinable = state == "waiting";                       // a game that started takes nobody new
        server.Status = state;
    }
});
```

A handler returns `void` and takes the `Player` and a `ReadOnlySpan<byte>`; it runs on the thread of the player.

## Send

```csharp
bool sent = Context.Messages.SendText(player, "hub:status", "survival Completed");
```

`Send`, `SendText` and `SendJson` (with a source-generated `JsonTypeInfo<T>`) reach the server the player is on, and
give `false` when it is on none (between servers). `PluginMessages.Text(data)` and `PluginMessages.Json(data, type)`
read what arrives.

## Rules

| Rule         | What                                                                                                            |
|--------------|-----------------------------------------------------------------------------------------------------------------|
| Channel      | 1 to 64 letters, digits, `_`, `-`, `.`, `:` and `/`, such as `hub:menu`; not starting with `orion:` (`ORSG011`) |
| One handler  | A plugin handles a channel once (`ORSG010`, or `PluginException` from `On`); several plugins may share one      |
| Size         | At most `PluginMessages.MaxDataLength` bytes (24 576)                                                           |
| The bytes    | Valid during the call only: copy what you keep (`data.ToArray()`)                                               |
| Nobody hears | A message no plugin handles is dropped; so are those of the channels of a disabled plugin                       |
| Servers      | The servers must take the proxy as a trusted gateway (`server.json` of each server)                             |

`ServerMessageEvent` comes for every message of a server, handled or not, with the `Channel` and the `Message` as
base64.

## Reference

`PluginMessages` (`Context.Messages`, namespace `Orion.Sdk`):

| Member                                                                           | What it does                                                        |
|----------------------------------------------------------------------------------|---------------------------------------------------------------------|
| `bool Send(Player player, string channel, ReadOnlySpan<byte> data)`              | Sends bytes to the server of the player; `false` when it is on none |
| `bool SendText(Player player, string channel, string text)`                      | Sends a text, as UTF-8                                              |
| `bool SendJson<T>(Player player, string channel, T value, JsonTypeInfo<T> type)` | Sends a value as JSON                                               |
| `void On(string channel, PluginMessageHandler<Player> handler)`                  | Handles the messages of a channel                                   |
| `static string Text(ReadOnlySpan<byte> data)`                                    | Reads the bytes as UTF-8 text                                       |
| `static T? Json<T>(ReadOnlySpan<byte> data, JsonTypeInfo<T> type)`               | Reads the bytes as JSON                                             |
| `const int MaxDataLength`                                                        | The most bytes a message carries: 24 576                            |

`MessageHandlerAttribute(string channel)` marks a handler (`Channel`); `PluginMessageHandler<TPlayer>` is the delegate
of `On`; `IPluginPlayer<TSelf>` is what makes `Player` a player of messages, for the SDK. The methods of
`PluginMessages` are generic over the player, so that one type serves both SDKs; the compiler infers `Player`. `On`
with a lambda takes the `Player` of the proxy SDK without naming it (`PluginMessagesExtensions`, namespace
`Orion.Sdk.Proxy`).
