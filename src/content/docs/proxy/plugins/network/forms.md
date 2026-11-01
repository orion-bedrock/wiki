---
title: "Forms"
description: "Orion proxy plugins: forms of buttons, questions and fields shown by the proxy."
sidebar:
  order: 7
---

The proxy shows forms to its players on whatever server they are on: a server selector, a party invitation, a
question before a transfer. The forms are the same as on a server (`SimpleForm`, `ModalForm`, `CustomForm`), in the
namespace `Orion.Sdk.Proxy.Forms`; their actions and `ShowAsync` go on on the thread of the player.

| Form         | Shows                                                     | Its answer                            |
|--------------|-----------------------------------------------------------|---------------------------------------|
| `SimpleForm` | A text and a list of buttons, each with an optional image | The button pressed                    |
| `ModalForm`  | A question and two buttons                                | Whether the first button was pressed  |
| `CustomForm` | Fields: text inputs, switches, sliders, lists             | The values, by the keys of the fields |

Every text of a form is a `Text`: a string, or `Text.Lang(key)` in the language of the player
([Text and translations](../../basics/text-and-translations/)).

## A server selector, with callbacks

```csharp
using Orion.Sdk;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Forms;
using Orion.Sdk.Proxy.Players;
using Orion.Sdk.Proxy.Servers;

namespace Network;

public sealed class SelectorPlugin : ProxyPlugin
{
    public override void OnEnable() =>
        Context.Commands.Register("servers", spec => spec.Executes(call => call.Player.Forms.Show(Selector())));

    // Built for each showing, so the counts are those of the moment.
    private static SimpleForm Selector()
    {
        var form = new SimpleForm("Servers").Content($"{ProxyServer.Current.PlayerCount} players online.");
        foreach (ServerGroup group in ProxyServer.Current.Servers.Groups)
        {
            string name = group.Name;
            form.Button($"{name} ({group.PlayerCount})", onClick: player => _ = Go(player, name));
        }

        return form.OnClose((player, reason) => player.SendMessage("Maybe later."));
    }

    private static async Task Go(Player player, string group)
    {
        TransferResult result = await player.TransferAsync(group);
        if (result is not (TransferResult.Completed or TransferResult.Reconnecting))
        {
            player.SendMessage($"{group}: {result}");
        }
    }
}
```

The action of a button is any `Action<Player>`: a lambda as above, or a method of the plugin
(`.Button("Lobby", onClick: GoToLobby)`) when several buttons share it.

## A question, with await

```csharp
Context.Commands.Register("leave", spec => spec.Executes(async call =>
{
    var question = new ModalForm("Leave the game?").Content("Your party will stay.").Confirm("Leave").Cancel("Stay");
    FormResult<bool> answer = await call.Player.Forms.ShowAsync(question);
    if (answer.IsSubmitted && answer.Value)
    {
        await call.Player.TransferAsync(ProxyServer.Current.Servers.DefaultGroup);
    }
}));
```

| Style       | Prefer it when                                                             |
|-------------|----------------------------------------------------------------------------|
| Callbacks   | A menu of independent actions, a form built once and shown to many players |
| `ShowAsync` | A conversation in steps, or code that needs the answer before it goes on   |

## A form of fields

```csharp
FormResult<CustomFormValues> result = await player.Forms.ShowAsync(new CustomForm("Create a party")
    .Input("name", "Name", placeholder: "My party")
    .Slider("size", "Size", min: 2, max: 8, step: 1, defaultValue: 4)
    .Toggle("open", "Anyone can join", defaultValue: true)
    .Dropdown("game", "Game", ["Skywars", "Bedwars"]));
if (result.IsSubmitted)
{
    CustomFormValues values = result.Value;
    player.SendMessage($"{values.GetString("name")}: {values.GetFloat("size")} players, {values.GetOption("game").Value}");
}
```

## Rules

| Rule                     | What                                                                                                                             |
|--------------------------|----------------------------------------------------------------------------------------------------------------------------------|
| Closed without an answer | `OnClose`, or `IsSubmitted` false with a `CloseReason`: `Closed`, `Busy` (another screen was open), `Left`, `Invalid`, `Refused` |
| Several forms            | A player has at most `PlayerForms.Limit` open; one more throws `PluginException`                                                 |
| A form is a template     | Show one form object as often and to as many players as you like                                                                 |
| The plugin is disabled   | The forms it left open close, and their actions do not run                                                                       |

`player.Forms.OpenCount` is how many forms of the proxy a player has open, and `CloseAll()` closes them.

## Reference

`SimpleForm`: A form of buttons: new SimpleForm("Menu").Content("Pick one").Button("Spawn", onClick: p => …).

| Member                                                                               | What it is                                                               |
|--------------------------------------------------------------------------------------|--------------------------------------------------------------------------|
| `Text Body`                                                                          | The text above the buttons                                               |
| `SimpleForm Button(Text text, string? image = null, Action<Player>? onClick = null)` | Adds a button                                                            |
| `int ButtonCount`                                                                    | The number of buttons                                                    |
| `SimpleForm Content(Text text)`                                                      | Sets the text above the buttons                                          |
| `SimpleForm OnClose(Action<Player, FormCloseReason> action)`                         | Sets what runs when the player closes the form without pressing a button |
| `SimpleForm(Text title)`                                                             | A new `SimpleForm`                                                       |

`ModalForm`: A question with two buttons: new ModalForm("Leave?").Content("Sure?").Confirm("Yes", p => …).Cancel("No").

| Member                                                           | What it is                                                       |
|------------------------------------------------------------------|------------------------------------------------------------------|
| `Text Body`                                                      | The question                                                     |
| `ModalForm Cancel(Text text, Action<Player>? onCancel = null)`   | Sets the second button                                           |
| `ModalForm Confirm(Text text, Action<Player>? onConfirm = null)` | Sets the first button                                            |
| `ModalForm Content(Text text)`                                   | Sets the question                                                |
| `ModalForm(Text title)`                                          | A new `ModalForm`                                                |
| `ModalForm OnClose(Action<Player, FormCloseReason> action)`      | Sets what runs when the player closes the form without answering |

`CustomForm`: A form of fields read by key: new CustomForm("Settings").Input("name", "Name").Toggle("pvp", "PvP")
.OnSubmit((p, values) => values.GetString("name")).

| Member                                                                                                       | What it is                                                        |
|--------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------|
| `CustomForm(Text title)`                                                                                     | A new `CustomForm`                                                |
| `CustomForm Divider()`                                                                                       | Adds a line between fields                                        |
| `CustomForm Dropdown(string key, Text text, IReadOnlyList<Text> options, int defaultIndex = 0)`              | Adds a list to choose one option of                               |
| `int ElementCount`                                                                                           | The number of elements: texts, lines and fields                   |
| `CustomForm Header(Text text)`                                                                               | Adds a header                                                     |
| `CustomForm Input(string key, Text text, Text? placeholder = null, string? defaultValue = null)`             | Adds a field of text                                              |
| `CustomForm Label(Text text)`                                                                                | Adds a text                                                       |
| `CustomForm OnClose(Action<Player, FormCloseReason> action)`                                                 | Sets what runs when the player closes the form without sending it |
| `CustomForm OnSubmit(Action<Player, CustomFormValues> action)`                                               | Sets what runs when the player sends the form                     |
| `CustomForm Slider(string key, Text text, float min, float max, float step = 1, float? defaultValue = null)` | Adds a slider of numbers                                          |
| `CustomForm Toggle(string key, Text text, bool defaultValue = false)`                                        | Adds a switch                                                     |

`CustomFormValues`: The values a player sent in a CustomForm, by the keys of its fields.

| Member                             | What it is                               |
|------------------------------------|------------------------------------------|
| `bool GetBool(string key)`         | A switch                                 |
| `float GetFloat(string key)`       | The value of a slider                    |
| `int GetIndex(string key)`         | The index of the option chosen in a list |
| `Text GetOption(string key)`       | The option chosen in a list              |
| `string GetString(string key)`     | The text of a field of text              |
| `IReadOnlyCollection<string> Keys` | The keys of the fields                   |

`PlayerForms` (`player.Forms`): the forms of the proxy a player sees.

| Member                                                          | What it is                                                                                             |
|-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `void CloseAll()`                                               | Closes every form of the proxy on the screen of the player                                             |
| `static int Limit`                                              | The most forms a player has open at once                                                               |
| `int OpenCount`                                                 | The number of forms shown and not yet answered                                                         |
| `void Show(Form form)`                                          | Shows a form; its actions run when the player answers or closes it                                     |
| `Task<FormResult<int>> ShowAsync(SimpleForm form)`              | Shows a form of buttons and waits for the button pressed; the code goes on on the thread of the player |
| `Task<FormResult<bool>> ShowAsync(ModalForm form)`              | Shows a question and waits for the answer; the code goes on on the thread of the player                |
| `Task<FormResult<CustomFormValues>> ShowAsync(CustomForm form)` | Shows a form of fields and waits for the values; the code goes on on the thread of the player          |

`FormResult<T>`: the answer of a player to a form shown with `ShowAsync`, or why there is none.

| Member                         | What it is                                              |
|--------------------------------|---------------------------------------------------------|
| `FormCloseReason? CloseReason` | Why the form closed, or `null` when the player answered |
| `bool IsSubmitted`             | Whether the player answered                             |
| `Player Player`                | The player who answered, or who closed the form         |
| `T Value`                      | What the player chose                                   |

`FormCloseReason`: `Closed`, `Busy`, `Left`, `Invalid`, `Refused`.
