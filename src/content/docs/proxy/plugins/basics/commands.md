---
title: "Commands"
description: "Orion proxy plugins: commands of the network, run from any server."
sidebar:
  order: 6
---

A proxy plugin adds commands to the whole network: players run them from any server, the proxy answers them before the
server sees them, and the client lists them with the commands of the server it is on. A command of the proxy hides a
command of the server with the same name; a command the proxy does not have, or one the player may not use, goes to the
server as it is. The proxy runs commands only when `enable_commands` of `proxy.json` is on (the default).

## Register a command

Register commands from `OnEnable` on with `Context.Commands.Register(name, spec => …)` (`using Orion.Sdk.Proxy;`):

```csharp
using Orion.Sdk;
using Orion.Sdk.Proxy;

namespace Network;

public sealed class NetworkPlugin : ProxyPlugin
{
    public override void OnEnable() =>
        Context.Commands.Register("online", spec => spec
            .Description("Tells how many players are online.")
            .Aliases("players")
            .Executes(call => call.Reply($"{ProxyServer.Current.PlayerCount} players on the network.")));
}
```

`call.Reply(text)` answers, `call.Fail(text)` fails the command with a message; both take a `Text`
([Text and translations](../text-and-translations/)). A handler that throws is a fault of the plugin, and the player
is told the command failed.

## Arguments

Every argument of a server command works on the proxy (`Int`, `Float`, `Bool`, `Text`, `Message`, `Options`,
`Literal`, `Optional()`: [Commands](../../../../server/plugins/basics/commands/)), and the proxy adds two:

| Builder        | Value in the handler | The player types                          | The client offers                                                                     |
|----------------|----------------------|-------------------------------------------|---------------------------------------------------------------------------------------|
| `Player(name)` | `Player`             | The name of a player of the proxy         | The players                                                                           |
| `Server(name)` | `string`             | The id of a server or the name of a group | The ids of the servers and the names of the groups, as they are when the player types |

```csharp
Context.Commands.Register("send", spec =>
{
    CommandArgument<Player> who = spec.Player("player");
    CommandArgument<string> target = spec.Server("target");
    spec.Description("Sends a player to a server or a group.")
        .Permission("network.send")
        .Executes(async call =>
        {
            Player player = call.Get(who);
            TransferResult result = await player.TransferAsync(call.Get(target));
            call.Reply($"{player.Name}: {result}");
        }, who, target);
});
```

A name that is no player of the proxy fails the command before the handler runs. A server argument is the text as the
player typed it: `TransferAsync` tells whether it exists.

## Handlers: lambdas, methods and classes

As on a server, a handler is an `Action<CommandCall>` or a `Func<CommandCall, Task>`: a lambda for a short command, a
method of the plugin when it grows, or a class per command that holds its arguments and state:

```csharp
using Orion.Sdk;
using Orion.Sdk.Commands;
using Orion.Sdk.Proxy;
using Orion.Sdk.Proxy.Commands;
using Orion.Sdk.Proxy.Players;

namespace Network;

public sealed class FriendsCommand
{
    private readonly Dictionary<string, HashSet<string>> _friends = [];
    private readonly Lock _gate = new();
    private CommandArgument<Player> _who = null!;

    public void Register(ProxyCommands commands) =>
        commands.Register("friend", spec =>
        {
            _who = spec.Player("player");
            spec.Description("Adds a friend, or lists yours.")
                .Executes(Add, spec.Literal("add"), _who)
                .Executes(List);
        });

    private void Add(CommandCall call)
    {
        Player friend = call.Get(_who);
        lock (_gate)
        {
            if (!_friends.TryGetValue(call.Player.Uuid, out HashSet<string>? names))
            {
                _friends[call.Player.Uuid] = names = [];
            }

            names.Add(friend.Name);
        }

        call.Reply($"{friend.Name} is your friend now.");
    }

    private void List(CommandCall call)
    {
        lock (_gate)
        {
            call.Reply(_friends.TryGetValue(call.Player.Uuid, out HashSet<string>? names) ? string.Join(", ", names) : "No friends yet.");
        }
    }
}

public sealed class FriendsPlugin : ProxyPlugin
{
    public override void OnEnable() => new FriendsCommand().Register(Context.Commands);
}
```

Handlers run on the thread of their player, so commands of two players run at once: shared state takes a lock
([Threads](../threads/)).

## Asynchronous commands

A handler can be `async`: until it first waits, `Reply` and `Fail` are the output of the command; once it waited, both
send the player a chat message (`Fail` in red). One that throws after it waited is logged, reported as a fault, and the
player is told the command failed; one that ends with `OperationCanceledException` (the plugin was disabled) ends
silently. A transfer is the usual wait:

```csharp
Context.Commands.Register("hub", spec => spec.Executes(async call =>
{
    TransferResult result = await call.Player.TransferAsync(ProxyServer.Current.Servers.DefaultGroup);
    if (result == TransferResult.AlreadyThere)
    {
        call.Reply("You are in the lobby already.");
    }
}));
```

## Watch commands

`PlayerCommandEvent` comes for every command of the proxy a player sends, before it runs: cancel it to block the
command, or change `CommandLine`.

## Reference

`ProxyCommands` (`Context.Commands`, namespace `Orion.Sdk.Proxy.Commands`):

| Member                                                         | What it does                                                       |
|----------------------------------------------------------------|--------------------------------------------------------------------|
| `Register(string name, Action<ProxyCommandBuilder> configure)` | Registers a command; `ArgumentException` when it has no `Executes` |

`ProxyCommandBuilder` (from `CommandBuilder<CommandCall>` of `Orion.Sdk.Commands`):

| Member                                                                          | What it does                                                    |
|---------------------------------------------------------------------------------|-----------------------------------------------------------------|
| `Name`, `Description(string)`, `Aliases(params string[])`, `Permission(string)` | The name, the description, other names, the permission it needs |
| `Int`, `Float`, `Bool`, `Text`, `Message`, `Options`, `Literal`                 | The arguments of every command                                  |
| `CommandArgument<Player> Player(string name)`                                   | One player of the proxy, by name                                |
| `CommandArgument<string> Server(string name)`                                   | A server or a group of the proxy                                |
| `Executes(Action<CommandCall> handler, params CommandParameter[] parts)`        | Adds an overload with a synchronous handler                     |
| `Executes(Func<CommandCall, Task> handler, params CommandParameter[] parts)`    | Adds an overload with an asynchronous handler                   |

`CommandCall` (`Orion.Sdk.Proxy.Commands`), valid while the handler runs:

| Member                                                                    | What it is                                                   |
|---------------------------------------------------------------------------|--------------------------------------------------------------|
| `Player`                                                                  | The player that typed the command                            |
| `Input`                                                                   | The command as typed, without the slash                      |
| `Get(argument)`, `Get(argument, fallback)`, `TryGet(argument, out value)` | The value of an argument (`CommandCallExtensions`)           |
| `Has(name)`                                                               | Whether the player gave an argument                          |
| `GetInt`, `GetFloat`, `GetBool`, `GetText`, `GetPlayer`, `GetServer`      | The value of an argument by name                             |
| `Reply(Text)`                                                             | Answers the player                                           |
| `Fail(Text)`                                                              | Fails the command with a message                             |
| `Complete()`                                                              | Called by the SDK when the handler ends; not for plugin code |

`ICommandCall` (`Orion.Sdk.Commands`) is what `CommandCall` implements, shared with the SDK of the server: `Input`,
`Has`, `GetInt`, `GetFloat`, `GetBool`, `GetText`, `Reply(string)`, `Fail(string)`, `Complete`. The protected members of
`CommandBuilder<TCall>` (`Argument`, `CallOf`, `Register`) are for the SDKs.
