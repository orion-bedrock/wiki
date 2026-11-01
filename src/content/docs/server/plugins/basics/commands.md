---
title: "Commands"
description: "Orion server plugins: commands with arguments, overloads, permissions and asynchronous handlers."
sidebar:
  order: 6
---

A plugin adds commands players type in the chat, such as `/arena join red`. The client lists them with the commands of
the server and completes them as the player types, from the arguments you declare: numbers, words from a list, players,
positions. Orion parses what the player typed and calls the handler of the form (the overload) that matches.

## Register a command

Register commands from `OnEnable` on with `Context.Commands.Register(name, spec => …)` (`using Orion.Sdk.Server;`).
The builder declares the description, aliases, permission and arguments, and `Executes` adds an overload with its
handler. A command needs at least one `Executes`.

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;

namespace Arena;

public sealed class ArenaPlugin : ServerPlugin
{
    public override void OnEnable() =>
        Context.Commands.Register("spawn", spec => spec
            .Description("Takes you back to the spawn of your world.")
            .Aliases("lobby")
            .Executes(call =>
            {
                if (call.Player.World is { } world)
                {
                    call.Player.Teleport(world.Spawn);
                    call.Reply("Back at the spawn.");
                }
            }));
}
```

The commands of a plugin are removed when it is disabled.

## Reply and fail

`call.Reply(text)` answers the player; `call.Fail(text)` fails the command with a message (in red). Both take a `Text`,
so a key of your translations works as well as a string ([Text and translations](../text-and-translations/)):

```csharp
Context.Commands.Register("coins", spec => spec
    .Executes(call =>
    {
        long coins = call.Player.Data.GetLong("arena:coins", 0);
        if (coins == 0)
        {
            call.Fail(Text.Lang("shop::no_coins"));
            return;
        }

        call.Reply(Text.Lang("shop::balance", ("coins", coins)));
    }));
```

A handler may reply several times. If it throws, the player is told "An error occurred while running this command."
and the exception is a fault of the plugin, in its log.

## Arguments

Declare each argument with the builder, then pass it to `Executes` as a part of the overload. In the handler,
`call.Get(argument)` gives its value with its type:

```csharp
Context.Commands.Register("heal", spec =>
{
    CommandArgument<Player> who = spec.Player("player");
    CommandArgument<int> amount = spec.Int("amount", 1, 20);
    spec.Description("Heals a player.")
        .Permission("arena.heal")
        .Executes(call =>
        {
            Player target = call.Get(who);
            target.Heal(call.Get(amount));
            call.Reply($"{target.Name} was healed.");
        }, who, amount);
});
```

| Builder                 | Value in the handler       | The player types                                                                               | The client offers             |
|-------------------------|----------------------------|------------------------------------------------------------------------------------------------|-------------------------------|
| `Int(name, min, max)`   | `int`                      | A whole number, within the bounds when given                                                   | The type of the argument      |
| `Float(name, min, max)` | `float`                    | A decimal number, within the bounds when given                                                 | The type of the argument      |
| `Bool(name)`            | `bool`                     | `true` or `false`                                                                              | Both words                    |
| `Text(name)`            | `string`                   | One word, or a text in quotes                                                                  | The type of the argument      |
| `Message(name)`         | `string`                   | The rest of the line; it is always the last part of its overload                               | The type of the argument      |
| `Options(name, words…)` | `string`: one of the words | One of the words                                                                               | The words                     |
| `Player(name)`          | `Player`                   | A name, or a selector that names one player: `@s`, `@p`, `@r`                                  | The players and the selectors |
| `Players(name)`         | `IReadOnlyList<Player>`    | A name or a selector: `@a` is every player in the world of the sender                          | The players and the selectors |
| `Position(name)`        | `Vector3`                  | Absolute (`10 64 -3`), relative to the player (`~ ~1 ~`) or local to where it looks (`^ ^ ^2`) | Coordinates                   |
| `Literal(word)`         | —                          | The word as it is: a sub-command such as `set` in `/home set`                                  | The word                      |

A selector that names no player, or several for `Player`, fails the command before the handler runs. The arguments are
read by name too (`call.GetInt("amount")`, `GetFloat`, `GetBool`, `GetText`, `GetPlayers`, `GetPosition`, `Has`), but
`Get` with the argument object is checked by the compiler.

### Optional arguments

`argument.Optional()` makes a part that the player may leave out; only the last parts of an overload may be optional.
Read it with a fallback, or ask whether it was given:

```csharp
Context.Commands.Register("countdown", spec =>
{
    CommandArgument<int> seconds = spec.Int("seconds", 1, 60);
    CommandArgument<string> message = spec.Message("message");
    spec.Executes(call =>
    {
        int value = call.Get(seconds, 10);                                       // 10 when left out
        string text = call.TryGet(message, out string? given) ? given : "Go!";
        call.Reply($"{value} seconds, then: {text}");
    }, seconds.Optional(), message.Optional());
});
```

## Overloads

Each `Executes` is one form of the command, with its own parts. Literals make sub-commands; an overload without parts
runs when the player types the name alone:

```csharp
Context.Commands.Register("team", spec =>
{
    CommandArgument<string> color = spec.Options("color", "red", "blue");
    CommandArgument<Player> who = spec.Player("player");
    spec.Description("Manages the teams of the arena.")
        .Executes(call => call.Reply($"{call.Get(who).Name} joins {call.Get(color)}"), spec.Literal("set"), who, color)
        .Executes(call => call.Reply("Teams were reset."), spec.Literal("reset"))
        .Executes(call => call.Fail("Usage: /team set <player> <red|blue>, or /team reset"));
});
```

Orion picks the overload whose parts match what the player typed and calls its handler.

## Permissions

`Permission(name)` restricts the whole command: a player without the permission does not see it in its list and cannot
run it. Operators have every permission. For a sub-command that needs more, check in its handler:

```csharp
Context.Commands.Register("arena", spec =>
{
    spec.Permission("arena.play")
        .Executes(call => call.Reply("You joined the queue."), spec.Literal("join"))
        .Executes(call =>
        {
            if (!call.Player.HasPermission("arena.admin"))
            {
                call.Fail("Only admins can stop a round.");
                return;
            }

            call.Reply("The round was stopped.");
        }, spec.Literal("stop"));
});
```

Grant permissions to players with `player.GrantPermission` ([Permissions and abilities](../../players/permissions/)).

## Handlers: lambdas, methods and classes

A handler is any `Action<CommandCall>` (or `Func<CommandCall, Task>`, below), so three styles work and can be mixed.

**A lambda** keeps a short command in one place:

```csharp
Context.Commands.Register("ping", spec => spec.Executes(call => call.Reply("Pong!")));
```

**A method** of the plugin keeps the registration readable when handlers grow, and can be shared by overloads:

```csharp
using Orion.Sdk;
using Orion.Sdk.Commands;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Commands;
using Orion.Sdk.Server.Players;

namespace Arena;

public sealed class KitPlugin : ServerPlugin
{
    private CommandArgument<string> _kit = null!;

    public override void OnEnable() =>
        Context.Commands.Register("kit", spec =>
        {
            _kit = spec.Options("name", "archer", "knight");
            spec.Executes(GiveKit, _kit)
                .Executes(ListKits);
        });

    private void GiveKit(CommandCall call) => call.Reply($"You got the {call.Get(_kit)} kit.");

    private static void ListKits(CommandCall call) => call.Reply("Kits: archer, knight");
}
```

**A class** per command keeps its arguments and state together, which suits big commands and plugins with many of them:

```csharp
using Orion.Sdk;
using Orion.Sdk.Commands;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Commands;
using Orion.Sdk.Server.Math;

namespace Arena;

public sealed class WarpCommand
{
    private readonly Dictionary<string, Vector3> _warps = new(StringComparer.OrdinalIgnoreCase);
    private CommandArgument<string> _name = null!;

    public void Register(ServerCommands commands) =>
        commands.Register("warp", spec =>
        {
            _name = spec.Text("name");
            spec.Description("Saves and uses warps.")
                .Executes(Set, spec.Literal("set"), _name)
                .Executes(Go, _name);
        });

    private void Set(CommandCall call)
    {
        _warps[call.Get(_name)] = call.Player.Position;
        call.Reply($"Warp {call.Get(_name)} saved.");
    }

    private void Go(CommandCall call)
    {
        if (!_warps.TryGetValue(call.Get(_name), out Vector3 position))
        {
            call.Fail($"There is no warp {call.Get(_name)}.");
            return;
        }

        call.Player.Teleport(position);
    }
}

public sealed class WarpPlugin : ServerPlugin
{
    public override void OnEnable() => new WarpCommand().Register(Context.Commands);
}
```

## Asynchronous commands

A handler can be `async`: it may wait for ticks, for a form, for a teleport. Until it first waits, `Reply` and `Fail`
are the output of the command, as in a synchronous handler; once it waited, the command has answered already, and both
send the player a chat message instead (`Fail` in red).

```csharp
Context.Commands.Register("duel", spec =>
{
    CommandArgument<Player> rival = spec.Player("rival");
    spec.Executes(async call =>
    {
        Player other = call.Get(rival);
        call.Reply($"Asking {other.Name}…");                                        // the output of the command

        var question = new ModalForm("Duel").Content($"{call.Player.Name} wants a duel.").Confirm("Fight").Cancel("No");
        FormResult<bool> answer = await other.Forms.ShowAsync(question);
        if (!answer.IsSubmitted || !answer.Value)
        {
            call.Fail($"{other.Name} said no.");                                     // now a red message
            return;
        }

        await call.Player.World!.Delay(60);
        call.Reply("Fight!");
    }, rival);
});
```

| What an asynchronous handler does      | What happens                                                                         |
|----------------------------------------|--------------------------------------------------------------------------------------|
| Throws before its first `await`        | As a synchronous handler: a fault, and the player is told the command failed         |
| Throws after it waited                 | Logged, reported as a fault of the plugin, and the player is told the command failed |
| Ends with `OperationCanceledException` | Nothing: the plugin was disabled or the world unloaded while it waited               |

The code after an `await` runs where the awaited task completes ([Threads and async code](../threads/)): `world.Delay` and
`ShowAsync` come back to the world of the player.

## Run a command as a player

`player.RunCommand(line)` runs a command as if the player had typed it, with its permissions, and gives back what the
command answered (one line per reply, the failure included) instead of showing it to the player. It does not raise
`PlayerCommandEvent`. The server has no console sender: commands always run as a player.

```csharp
string output = player.RunCommand("/gamemode creative");
```

## Watch commands

`PlayerCommandEvent` comes for every command a player sends, before it runs: cancel it to block the command, or change
`CommandLine` to run another one ([Events](../events/)).

```csharp
[EventHandler]
public static void OnCommand(PlayerCommandEvent e)
{
    if (e.World.Name == "arena" && e.CommandLine.StartsWith("tp ", StringComparison.OrdinalIgnoreCase))
    {
        e.IsCanceled = true;
        e.Player.SendMessage("No teleporting during a round.");
    }
}
```

## Reference

`ServerCommands` (`Context.Commands`, namespace `Orion.Sdk.Server.Commands`):

| Member                                                          | What it does                                                       |
|-----------------------------------------------------------------|--------------------------------------------------------------------|
| `Register(string name, Action<ServerCommandBuilder> configure)` | Registers a command; `ArgumentException` when it has no `Executes` |

`ServerCommandBuilder` (from `CommandBuilder<CommandCall>` of `Orion.Sdk.Commands`):

| Member                                                                       | What it does                                    |
|------------------------------------------------------------------------------|-------------------------------------------------|
| `Name`                                                                       | The name of the command                         |
| `Description(string)`                                                        | What the command does, as the client shows it   |
| `Aliases(params string[])`                                                   | Other names of the command                      |
| `Permission(string)`                                                         | Only players with the permission see and run it |
| `Int`, `Float`, `Bool`, `Text`, `Message`, `Options`                         | Arguments of every command (table above)        |
| `Player`, `Players`, `Position`                                              | Arguments of the server                         |
| `Literal(string word)`                                                       | A word typed as it is                           |
| `Executes(Action<CommandCall> handler, params CommandParameter[] parts)`     | Adds an overload with a synchronous handler     |
| `Executes(Func<CommandCall, Task> handler, params CommandParameter[] parts)` | Adds an overload with an asynchronous handler   |

`CommandArgument<T>` and `CommandParameter` (`Orion.Sdk.Commands`):

| Member               | What it is                                              |
|----------------------|---------------------------------------------------------|
| `CommandParameter`   | A part of an overload: a literal or an argument; `Name` |
| `CommandArgument<T>` | An argument whose value is a `T`                        |
| `Optional()`         | The argument as a part the player may leave out         |

`CommandCall` (`Orion.Sdk.Server.Commands`), valid while the handler runs:

| Member                                                                    | What it is                                                   |
|---------------------------------------------------------------------------|--------------------------------------------------------------|
| `Player`                                                                  | The player that typed the command                            |
| `Input`                                                                   | The command as typed, without the slash                      |
| `Get(argument)`, `Get(argument, fallback)`, `TryGet(argument, out value)` | The value of an argument (`CommandCallExtensions`)           |
| `Has(name)`                                                               | Whether the player gave an argument                          |
| `GetInt`, `GetFloat`, `GetBool`, `GetText`, `GetPlayers`, `GetPosition`   | The value of an argument by name                             |
| `Reply(Text)`                                                             | Answers the player                                           |
| `Fail(Text)`                                                              | Fails the command with a message                             |
| `Complete()`                                                              | Called by the SDK when the handler ends; not for plugin code |

| Elsewhere                        | What it does                                                                   |
|----------------------------------|--------------------------------------------------------------------------------|
| `Player.RunCommand(string line)` | Runs a command as the player and returns its output                            |
| `PlayerCommandEvent`             | A command a player sent, before it runs: `CommandLine` is writable, cancelable |

`ICommandCall` (`Orion.Sdk.Commands`) is what `CommandCall` implements, shared with the SDK of the proxy: `Input`,
`Has`, `GetInt`, `GetFloat`, `GetBool`, `GetText`, `Reply(string)`, `Fail(string)`, `Complete`. `CommandBuilder<TCall>`
has three protected members for the SDK of each application (`Argument`, `CallOf`, `Register`).
