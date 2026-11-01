---
title: "Text and translations"
description: "Orion proxy plugins: `Text`, the `lang` folder and texts in the language of each player."
sidebar:
  order: 8
---

Every text the proxy shows to a player (a chat message, a disconnection screen, a form, the reply of a command, the
message a login is refused with) is a `Text`: plain, shown as written, or a key of the translations of your plugin,
shown to each player in its own language. The types are in `Orion.Sdk.Proxy.Lang`, and they work as on a server
([Text and translations](../../../../server/plugins/basics/text-and-translations/) has the format of the files in full).

## Plain and translated texts

```csharp
player.SendMessage("Welcome to the network!");                                   // a string is a plain Text
player.SendMessage(Text.Lang("network::welcome", ("player", player.Name)));      // a key of the plugin
ProxyServer.Current.Broadcast(Text.Lang("network::restart", ("minutes", 5)));    // each player in its language
player.Disconnect(Text.Lang("network::banned", ("days", 3)));
```

| Member taking a `Text`                                                                                              | Shows                                |
|---------------------------------------------------------------------------------------------------------------------|--------------------------------------|
| `Player.SendMessage`, `ProxyServer.Broadcast`                                                                       | A message in the chat                |
| `Player.Disconnect`                                                                                                 | The disconnection screen             |
| `CommandCall.Reply`, `Fail`                                                                                         | The answer of a command              |
| Forms: titles, contents, buttons, labels, options                                                                   | [Forms](../../network/forms/)                 |
| `RefusalMessage` of `PlayerLoginEvent` and `PlayerInitialServerEvent`, `DisconnectMessage` of `PlayerFallbackEvent` | What a refused or lost player reads  |
| `SentinelVerdict.Deny`, `Throttle` ([Sentinel](../../network/sentinel/))                                                     | What a player Sentinel refuses reads |

Identifiers, commands, channels and what a player types stay `string`s.

## The lang folder

A plugin ships its texts in `lang/<locale>/*.blang` in its folder: `key: value` lines, sections `[name]` that put
`name::` in front of the keys that follow, color tags and `{arguments}`:

```ini
# plugins/network/lang/en_US/network.blang
[network]
welcome: <green>Welcome to the network, <yellow>{player}</yellow>!</green>
restart: <red>The network restarts in {minutes} minutes.</red>
banned: You are banned for {days} days.
xbox_required: Sign in to Xbox to play here.
```

`Text.Lang("network::welcome", …)` takes the key without the id of the plugin, which Orion puts in front. A language
written for one country serves the others (`es_MX` for a player in `es_ES`), a key missing in a language comes from
the default language of the proxy, and a key missing everywhere shows as itself.

## Context.Translations

`Context.Translations` reads the same texts as strings, for what a plugin keeps or compares:

```csharp
Context.Translations.Send(player, "network::welcome", ("player", player.Name));
string line = Context.Translations.Translate(player, "network::restart", ("minutes", 5));
string spanish = Context.Translations.Translate("es_MX", "network::banned", ("days", 3));
bool has = Context.Translations.Has("network::xbox_required");
```

## Reference

`Text` (`Orion.Sdk.Proxy.Lang`):

| Member                                                                          | What it is                                                                  |
|---------------------------------------------------------------------------------|-----------------------------------------------------------------------------|
| `implicit operator Text?(string?)`                                              | A string is a plain text                                                    |
| `static Text Plain(string text)`                                                | A text shown as it is to every player                                       |
| `static Text Lang(string key, params (string Name, object? Value)[] arguments)` | A key of the translations of the plugin, with its arguments                 |
| `static Text Empty`                                                             | The empty plain text                                                        |
| `bool IsLang`, `string? Key`, `string Value`, `Arguments`                       | What it holds: a key and its arguments, or a plain text                     |
| `==`, `Equals`, `GetHashCode`, `ToString()`                                     | By value; `ToString` gives the text, or the key and its arguments, for logs |

`PluginTranslations` (`Context.Translations`):

| Member                                                                              | What it does                           |
|-------------------------------------------------------------------------------------|----------------------------------------|
| `bool Has(string key)`                                                              | Tells whether the plugin has a text    |
| `string Translate(Player player, string key, params (string, object?)[] arguments)` | The text in the language of a player   |
| `string Translate(string locale, string key, params (string, object?)[] arguments)` | The text in a language                 |
| `void Send(Player player, string key, params (string, object?)[] arguments)`        | Shows the text in the chat of a player |
