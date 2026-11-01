---
title: "Forms"
description: "Orion server plugins: forms of buttons, questions and fields."
sidebar:
  order: 1
---

Forms are the windows of the game that ask a player something: a list of buttons, a yes-or-no question, or fields to
fill in. A plugin builds a form, shows it to a player, and runs code when the player answers or closes it. The types
are in `Orion.Sdk.Server.Forms`.

| Form         | Shows                                                     | Its answer                            |
|--------------|-----------------------------------------------------------|---------------------------------------|
| `SimpleForm` | A text and a list of buttons, each with an optional image | The button pressed                    |
| `ModalForm`  | A question and two buttons                                | Whether the first button was pressed  |
| `CustomForm` | Fields: text inputs, switches, sliders, lists             | The values, by the keys of the fields |

Every text of a form (title, content, buttons, labels, the options of a list) is a `Text`: a string, or
`Text.Lang(key)` to show it in the language of the player ([Text and translations](../../basics/text-and-translations/)).

## Two ways to get the answer

**Callbacks**: give each button its action, and show the form with `Show`. The form can be built once and shown to
many players; its actions run when each one answers:

```csharp
var menu = new SimpleForm("Lobby")
    .Content("Where to?")
    .Button("Arena", "textures/items/diamond_sword", p => p.RunCommand("/arena join"))
    .Button("Shop", "textures/items/emerald", p => p.RunCommand("/shop"))
    .Button("Close")
    .OnClose((p, reason) => p.SendMessage($"See you later ({reason})."));
player.Forms.Show(menu);
```

**`await`**: show the form with `ShowAsync` and get the answer as a value, in the flow of your method. The code after
`await` runs on the thread of the world of the player:

```csharp
var question = new ModalForm("Leave the arena?").Content("You will lose your kill streak.").Confirm("Leave").Cancel("Stay");
FormResult<bool> answer = await player.Forms.ShowAsync(question);
if (answer.IsSubmitted && answer.Value)
{
    player.RunCommand("/spawn");
}
```

| Style       | Prefer it when                                                                                 |
|-------------|------------------------------------------------------------------------------------------------|
| Callbacks   | A menu of independent actions, a form shown to many players, a form built once and kept        |
| `ShowAsync` | A conversation in steps (ask, then ask again), or code that needs the answer before it goes on |

Both can be combined: a form shown with `ShowAsync` still runs the actions of its buttons.

## Buttons: lambdas or named methods

Short actions read best inline; longer ones as methods of the plugin, which also lets several buttons share one:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Forms;
using Orion.Sdk.Server.Players;

namespace Lobby;

public sealed class SelectorPlugin : ServerPlugin
{
    private SimpleForm _selector = null!;

    public override void OnEnable()
    {
        _selector = new SimpleForm("Game selector")
            .Button("Solo", onClick: JoinSolo)
            .Button("Duos", onClick: JoinDuos)
            .OnClose(Closed);
        Context.Commands.Register("play", spec => spec.Executes(call => call.Player.Forms.Show(_selector)));
    }

    private static void JoinSolo(Player player) => Join(player, 1);

    private static void JoinDuos(Player player) => Join(player, 2);

    private static void Join(Player player, int teamSize) => player.SendMessage($"Looking for a game of {teamSize}…");

    private static void Closed(Player player, FormCloseReason reason)
    {
        if (reason == FormCloseReason.Busy)
        {
            player.SendMessage("Close your inventory first.");
        }
    }
}
```

A button image is the path of a texture of the game or of a pack (`textures/items/diamond_sword`) or an `https://`
address.

## Questions

`ModalForm` has a content and two buttons; each may have its action:

```csharp
player.Forms.Show(new ModalForm(Text.Lang("shop::confirm_title"))
    .Content(Text.Lang("shop::confirm", ("item", "Diamond Sword"), ("price", 250)))
    .Confirm(Text.Lang("shop::buy"), p => p.Inventory.Add(new ItemStack(ItemIds.DiamondSword)))
    .Cancel(Text.Lang("shop::cancel")));
```

With `ShowAsync`, `Value` is `true` when the first button was pressed, `false` for the second.

## Forms of fields

```csharp
var settings = new CustomForm("Settings")
    .Header("Profile")
    .Input("nick", "Nickname", placeholder: "Steve", defaultValue: player.Name)
    .Toggle("pvp", "Allow PvP", defaultValue: true)
    .Divider()
    .Slider("volume", "Music volume", min: 0, max: 100, step: 5, defaultValue: 50)
    .Dropdown("team", "Team", ["Red", "Blue", "Green"], defaultIndex: 0)
    .Label("Changes apply at once.");

FormResult<CustomFormValues> result = await player.Forms.ShowAsync(settings);
if (result.IsSubmitted)
{
    CustomFormValues values = result.Value;
    string nick = values.GetString("nick");
    bool pvp = values.GetBool("pvp");
    float volume = values.GetFloat("volume");
    int team = values.GetIndex("team");
    player.SendMessage($"{nick}: PvP {pvp}, volume {volume}, team {values.GetOption("team").Value}");
}
```

The same form with a callback: `.OnSubmit((p, values) => …)`. Each field has a key, unique in the form, that its value
is read by. What a player types stays a `string`; `GetOption` gives the `Text` of the option chosen (its `Value` is the
plain text).

## When a form closes without an answer

`OnClose` runs, or `ShowAsync` gives a result with `IsSubmitted` false and its `CloseReason`:

| `FormCloseReason` | Why                                                                         |
|-------------------|-----------------------------------------------------------------------------|
| `Closed`          | The player closed it, or code closed it (`CloseAll`)                        |
| `Busy`            | The client could not show it: another screen was open                       |
| `Left`            | The player left                                                             |
| `Invalid`         | The answer did not fit the form                                             |
| `Refused`         | The server refused the answer: a handler of `FormResponseEvent` canceled it |

## Rules

| Rule                   | What                                                                                                                   |
|------------------------|------------------------------------------------------------------------------------------------------------------------|
| Threads                | Show forms on the thread of the world of the player; actions and `ShowAsync` go on there                               |
| Several forms          | Forms show one over another; a player has at most `PlayerForms.Limit` (16) open, and one more throws `PluginException` |
| Checking answers       | The server checks every answer against the form as it was shown; `FormResponseEvent` sees it first                     |
| A form is a template   | Show one form object as often and to as many players as you like                                                       |
| An action throws       | A fault of the plugin, in its log                                                                                      |
| The plugin is disabled | The forms it left open close on the screens of their players, and their actions do not run                             |

`player.Forms.OpenCount` is how many forms a player has open, and `CloseAll()` closes them.

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

`PlayerForms` (`player.Forms`): the forms a player sees, shown one over another.

| Member                                                          | What it is                                                                                             |
|-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------|
| `void CloseAll()`                                               | Closes every form on the screen of the player; each one closes with `Closed`                           |
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

`FormCloseReason`: the table above.
