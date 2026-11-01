---
title: "Text and translations"
description: "Orion server plugins: `Text`, the `lang` folder and showing texts in the language of each player."
sidebar:
  order: 8
---

Players of one server speak many languages. Every text the SDK shows to a player (a chat message, a title, a form, a
name tag, a sign) is a `Text`: either plain, shown as you wrote it, or a key of the translations of your plugin, which
Orion shows to each player in its own language. The types are in `Orion.Sdk.Server.Lang`.

## Plain and translated texts

```csharp
player.SendMessage("Welcome to the arena!");                                    // a string is a plain Text
player.SendMessage(Text.Plain("§6Gold text"));                                   // the same, explicitly
player.SendMessage(Text.Lang("arena::welcome", ("player", player.Name)));        // a key of the plugin, per player
```

| Kind       | Create it with                                      | Each player sees                                                  |
|------------|-----------------------------------------------------|-------------------------------------------------------------------|
| Plain      | A `string` (it converts by itself), `Text.Plain(s)` | The text as written, formatting codes such as `§b` kept           |
| Translated | `Text.Lang(key, (name, value)…)`                    | The text of the key in its language, with the arguments filled in |

`Text.Lang` takes the key as it is in your `lang` files, without the id of the plugin: Orion puts the id in front, so
two plugins never share a key.

## Where a Text is accepted

Every member that shows something to players takes a `Text`:

| Area                       | Members                                                                                                                                  |
|----------------------------|------------------------------------------------------------------------------------------------------------------------------------------|
| Chat                       | `Player.SendMessage`, `GameServer.Broadcast`, `ChatChannel.Broadcast`                                                                    |
| Disconnecting and refusing | `Player.Kick`, the `RefusalMessage` of `PlayerLoginEvent`, `PlayerSkinEvent`, `PlayerSpawnLocationEvent`                                 |
| Commands                   | `CommandCall.Reply`, `CommandCall.Fail`                                                                                                  |
| The screen                 | `PlayerHud.ShowTitle`, `ShowActionBar`, `PinActionBar`, `ShowToast`; `BossBar.Title`; `Sidebar` lines and title; `Objective.DisplayName` |
| Forms and menus            | Every title, content, button, label and option of a form; `Menu.WithTitle`, `PagedMenu.WithTitle`                                        |
| The world                  | `Entity.NameTag`, `Entity.InteractText`, floating texts, `SignSide.Text`, `Container.CustomName`                                         |

What is data rather than shown text stays a `string`: identifiers, commands, channels, what a player types in a form,
the names of player list entries.

## The lang folder

A plugin ships its texts in `lang/<locale>/*.blang` in its folder, one folder per language, as many files as you like
in each:

```text
plugins/arena/lang/
├─ en_US/arena.blang
└─ es_MX/arena.blang
```

A `.blang` file is a list of `key: value` lines. A section `[name]` puts `name::` in front of the keys that follow it,
and `[]` ends it:

```ini
# lang/en_US/arena.blang
welcome: <green>Welcome to the arena, <yellow>{player}</yellow>!</green>

[arena]
won: <gold>{player}</gold> won the round with {kills} kills.
coins: You have {coins:N0} coins.
no_bots: Bots are not allowed here.

[shop]
bought: You bought {item}.
```

```ini
# lang/es_MX/arena.blang
welcome: <green>¡Bienvenido a la arena, <yellow>{player}</yellow>!</green>

[arena]
won: <gold>{player}</gold> ganó la ronda con {kills} bajas.
coins: Tienes {coins:N0} monedas.
no_bots: No se permiten bots aquí.

[shop]
bought: Compraste {item}.
```

The keys of these files are `welcome`, `arena::won`, `arena::coins`, `arena::no_bots` and `shop::bought`.

| Write                                             | Result                                                                            |
|---------------------------------------------------|-----------------------------------------------------------------------------------|
| `# comment`, `; comment`                          | A comment, at the start of a line                                                 |
| `key: value`, `key = value`                       | A text; keys hold letters, digits, `_`, `-`, `.` and `::`, and are case-sensitive |
| `<red>…</red>`, `<bold:gold>…</bold:gold>`, `</>` | Colors and decorations; `</>` closes the innermost tag                            |
| `{name}`                                          | An argument, filled from `Text.Lang(key, ("name", value))`                        |
| `{name:N0}`, `{date:d}`                           | An argument with a .NET format, in the culture of the player (`1,250` or `1.250`) |
| `\n`, `\{`, `\<`                                  | A line break, a literal brace, a literal `<`                                      |
| `"  spaced  "`                                    | Quotes keep the spaces around a value                                             |
| `\` at the end of a line                          | The value goes on on the next line                                                |

Colors: `black`, `dark_blue`, `dark_green`, `dark_aqua`, `dark_red`, `dark_purple`, `gold`, `gray`, `dark_gray`, `blue`,
`green`, `aqua`, `red`, `light_purple`, `yellow`, `white`, `minecoin_gold` and the `material_…` colors of the game.
Decorations: `bold`, `italic`, `obfuscated`. Raw `§` codes are not accepted in `.blang` files: use the tags. Save the
files as UTF-8. A file Orion cannot read is reported in its log, with the file, the line and the reason.

Install the `lang` folder next to `plugin.json` ([Getting started](../getting-started/)); Orion reads it while the
server starts and logs which languages the plugin has.

## Arguments

Arguments are pairs of a name and a value: strings, numbers and booleans.

```csharp
player.SendMessage(Text.Lang("arena::won", ("player", winner.Name), ("kills", 7)));
player.Hud.ShowTitle(Text.Lang("arena::coins", ("coins", 1250)), null, 10, 40, 10);
```

Argument values are cleaned before they are shown: formatting codes are removed and line breaks become spaces, so a
player cannot color its name or fake a message of the server through an argument.

## Languages and fallbacks

Each player sees the language its client uses (`player.Locale`, such as `es_MX`). When the plugin has no text for it:

1. a language written for one country serves the others: `es_MX` texts are shown to a player in `es_ES`;
2. a key missing in a language comes from the default language of the server;
3. a key missing everywhere shows as itself, with the id of the plugin in front (`arena::arena::won`), so you see what
   is missing.

## Context.Translations

`Context.Translations` reads the same texts as strings, for what a plugin keeps, compares or writes somewhere else:

```csharp
Context.Translations.Send(player, "shop::bought", ("item", "Diamond Sword"));         // as player.SendMessage(Text.Lang(…))
string line = Context.Translations.Translate(player, "arena::coins", ("coins", 30));   // in the language of a player
string spanish = Context.Translations.Translate("es_MX", "welcome", ("player", "Steve"));
bool has = Context.Translations.Has("arena::won");
```

Prefer `Text.Lang` wherever a `Text` is accepted: a translated `Text` is resolved for each player who sees it (a boss
bar, a floating text, a sidebar shared by players of several languages), while a string from `Translate` is one
language for everyone.

## Reading a Text back

A text read from Orion (`entity.NameTag`, `bar.Title`, `sidebar.GetLine(0)`) is the one the plugin wrote: `IsLang`,
`Key` and `Arguments` tell what it holds. A key of another plugin or of Orion comes whole and goes back as it came.

```csharp
if (mob.NameTag is { IsLang: true, Key: "arena::guard" })
{
    mob.NameTag = Text.Lang("arena::guard_angry");
}
```

## Reference

`Text` (`Orion.Sdk.Server.Lang`):

| Member                                                                          | What it is                                                                                            |
|---------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `implicit operator Text?(string?)`                                              | A string is a plain text                                                                              |
| `static Text Plain(string text)`                                                | A text shown as it is to every player                                                                 |
| `static Text Lang(string key, params (string Name, object? Value)[] arguments)` | A key of the translations of the plugin, with its arguments                                           |
| `static Text Empty`                                                             | The empty plain text                                                                                  |
| `bool IsLang`                                                                   | Whether it is a key of the translations                                                               |
| `string? Key`                                                                   | The key as the plugin wrote it, the whole key for one that is not of the plugin, or `null` when plain |
| `string Value`                                                                  | The plain text, or the key                                                                            |
| `IReadOnlyList<(string Name, object? Value)> Arguments`                         | The arguments, by name; empty for a plain text                                                        |
| `==`, `Equals`, `GetHashCode`                                                   | By value: the same text, or the same key and arguments                                                |
| `ToString()`                                                                    | The plain text, or the key and its arguments (`arena::won(player=Steve)`), for logs                   |

`PluginTranslations` (`Context.Translations`):

| Member                                                                              | What it does                            |
|-------------------------------------------------------------------------------------|-----------------------------------------|
| `bool Has(string key)`                                                              | Tells whether the plugin has a text     |
| `string Translate(Player player, string key, params (string, object?)[] arguments)` | The text in the language of a player    |
| `string Translate(string locale, string key, params (string, object?)[] arguments)` | The text in a language, such as `es_MX` |
| `void Send(Player player, string key, params (string, object?)[] arguments)`        | Shows the text in the chat of a player  |
