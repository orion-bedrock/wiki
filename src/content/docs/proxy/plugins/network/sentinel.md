---
title: "Sentinel"
description: "Orion proxy plugins: blocking addresses and rules that check connections, logins, transfers and commands."
sidebar:
  order: 5
---

Sentinel is the guard of the proxy: it limits connections, logins, transfers and commands per address (as
`sentinel.json` says), and blocks addresses that break the limits too often. A plugin blocks and unblocks addresses,
and adds rules of its own: a ban list, a whitelist, a check of the reputation of an address. The types are in
`Orion.Sdk.Proxy.Security`.

## Block addresses

```csharp
Sentinel sentinel = ProxyServer.Current.Sentinel;
sentinel.Block("203.0.113.7", seconds: 600);              // ten minutes
bool blocked = sentinel.IsBlocked("203.0.113.7");
sentinel.Unblock("203.0.113.7");
foreach (string address in sentinel.BlockedAddresses)
{
    Context.Logger.LogInformation("Blocked: {Address}", address);
}
```

`IsEnabled` tells whether Sentinel guards the proxy (`enabled` of `sentinel.json`), and `IsTrusted(address)` whether an
address skips the limits (`trusted_addresses`). `AddressBlockedEvent` comes when an address is blocked, by the limits,
a rule or code (`AddressText`, `Rule`, `UntilUnixSeconds`, and the `Player` when there is one).

## Rules

A rule checks some stages of what a player does, and gives a verdict: allow, deny, or throttle (refuse for now). The
limits of `sentinel.json` come first; then the rules, in the order they were added; the first that does not allow
decides. A refusal counts as a violation of the address, and enough violations block it.

| `SentinelStages` | What is checked                                                  | The rule                                                            |
|------------------|------------------------------------------------------------------|---------------------------------------------------------------------|
| `Connection`     | A new connection, with its address alone, before the login       | Must answer at once; a refusal closes the connection without a word |
| `Login`          | A player whose identity is verified, before its server is chosen | May wait (up to 5 seconds)                                          |
| `Transfer`       | A move the player asks for with `/server` or `/lobby`            | May wait (up to 5 seconds)                                          |
| `Command`        | A command of the proxy a player runs                             | Must answer at once                                                 |

The stages are flags: one rule may check several (`SentinelStages.Login | SentinelStages.Transfer`).

### A rule as a class

```csharp
using Orion.Sdk.Proxy.Lang;
using Orion.Sdk.Proxy.Security;

namespace Network;

// Players on the ban list cannot log in, nor reach the servers of the list.
public sealed class BanList(IReadOnlySet<string> bannedNames, IReadOnlySet<string> closedServers)
    : SentinelRule("ban-list", SentinelStages.Login | SentinelStages.Transfer)
{
    public override ValueTask<SentinelVerdict> CheckAsync(SentinelCheck check)
    {
        if (check.Stage == SentinelStages.Login && check.Player is { } player && bannedNames.Contains(player.Name))
        {
            return ValueTask.FromResult(SentinelVerdict.Deny(Text.Lang("sentinel::banned")));   // in the language of the player
        }

        if (check.Stage == SentinelStages.Transfer && check.Target is { } target && closedServers.Contains(target))
        {
            return ValueTask.FromResult(SentinelVerdict.Throttle(TimeSpan.FromMinutes(1), "That server is closed for now."));
        }

        return ValueTask.FromResult(SentinelVerdict.Allow);
    }
}
```

```csharp
ProxyServer.Current.Sentinel.AddRule(new BanList(new HashSet<string> { "Griefer123" }, new HashSet<string> { "event" }));
bool removed = ProxyServer.Current.Sentinel.RemoveRule("ban-list");
```

### A rule that waits

At `Login` and `Transfer` the proxy waits for the verdict, so a rule may ask a web service or a database:

```csharp
using System.Net.Http;
using Orion.Sdk.Proxy.Security;

namespace Network;

public sealed class ReputationRule(HttpClient http) : SentinelRule("reputation", SentinelStages.Login)
{
    public override async ValueTask<SentinelVerdict> CheckAsync(SentinelCheck check)
    {
        if (check.Address is null)
        {
            return SentinelVerdict.Allow;
        }

        string verdict = await http.GetStringAsync("https://reputation.example.com/check/" + check.Address);
        return verdict == "bad" ? SentinelVerdict.Deny("Your network is not allowed here.") : SentinelVerdict.Allow;
    }
}
```

### A rule from a lambda

`AddRule` takes a `SentinelRule`; a small class that takes a function gives you the lambda style for simple rules:

```csharp
using Orion.Sdk.Proxy.Security;

namespace Network;

public sealed class LambdaRule(string name, SentinelStages stages, Func<SentinelCheck, SentinelVerdict> check)
    : SentinelRule(name, stages)
{
    public override ValueTask<SentinelVerdict> CheckAsync(SentinelCheck sentinelCheck) => ValueTask.FromResult(check(sentinelCheck));
}
```

```csharp
ProxyServer.Current.Sentinel.AddRule(new LambdaRule("no-op-commands", SentinelStages.Command,
    c => c.Command?.StartsWith("op ", StringComparison.OrdinalIgnoreCase) == true ? SentinelVerdict.Deny("No.") : SentinelVerdict.Allow));
```

## What a rule sees

| Member of `SentinelCheck` | What it is                                                         |
|---------------------------|--------------------------------------------------------------------|
| `Stage`                   | The stage checked                                                  |
| `Address`                 | The address of the connection, or `null`                           |
| `Player`                  | The player, from `Login` on                                        |
| `Target`                  | Where the player goes, for `Transfer`: a server id or a group name |
| `Command`                 | The command, for `Command`                                         |

## Rules of rules

| Case                                                            | Verdict                                  |
|-----------------------------------------------------------------|------------------------------------------|
| `CheckAsync` throws, at once or after it waited                 | Allow; a fault of the plugin, in its log |
| It does not answer within 5 seconds                             | Allow; a fault of the plugin             |
| At `Connection` or `Command`, the task is not completed at once | Allow, and the proxy logs it             |
| The plugin is disabled                                          | Its rules are removed                    |

Rules run on threads of the proxy, several at once: what they share needs to be safe from any thread
([Threads](../../basics/threads/)). The message of a verdict reaches the player from the login on; a refused connection is
closed without a word. Its message is a `Text`, like every refusal: a string is shown as it is, and
`Text.Lang(key, arguments)` a text of the translations of the plugin, in the language of the player
([Text and translations](../../basics/text-and-translations/)).

## Reference

`Sentinel`: Sentinel, the guard of the proxy: blocks, trusted addresses and the rules of plugins.

| Member                                       | What it is                                                                |
|----------------------------------------------|---------------------------------------------------------------------------|
| `void AddRule(SentinelRule rule)`            | Adds a rule, after the others, until the plugin removes it or is disabled |
| `void Block(string address, double seconds)` | Blocks an address for a while                                             |
| `IReadOnlyList<string> BlockedAddresses`     | The addresses blocked now                                                 |
| `bool IsBlocked(string address)`             | Tells whether an address is blocked                                       |
| `bool IsEnabled`                             | Whether Sentinel guards the proxy (`sentinel.json`)                       |
| `bool IsTrusted(string address)`             | Tells whether an address skips the limits (`trusted_addresses`)           |
| `bool RemoveRule(string name)`               | Removes a rule of the plugin                                              |
| `bool Unblock(string address)`               | Unblocks an address                                                       |

`SentinelRule`: a rule of Sentinel of the plugin (`AddRule`).

| Member                                                                | What it is                 |
|-----------------------------------------------------------------------|----------------------------|
| `abstract ValueTask<SentinelVerdict> CheckAsync(SentinelCheck check)` | Checks one stage           |
| `string Name`                                                         | The name of the rule       |
| `protected SentinelRule(string name, SentinelStages stages)`          | A new `SentinelRule`       |
| `SentinelStages Stages`                                               | The stages the rule checks |

`SentinelCheck`: what a rule checks, valid until it answers.

| Member                 | What it is                                                                     |
|------------------------|--------------------------------------------------------------------------------|
| `string? Address`      | The address of the connection, or `null`                                       |
| `string? Command`      | The command, for Command                                                       |
| `Player? Player`       | The player, from Login on                                                      |
| `SentinelStages Stage` | The stage checked                                                              |
| `string? Target`       | Where the player goes, for Transfer: the id of a server or the name of a group |

`SentinelVerdict` (a value): what a rule decides: `Allow`, `Deny` or `Throttle`.

| Member                                                                       | What it is                                                                                 |
|------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------|
| `static SentinelVerdict Allow`                                               | The verdict that lets it go on                                                             |
| `static SentinelVerdict Deny(Text? message = null)`                          | Refuses it                                                                                 |
| `bool IsAllowed`                                                             | Whether it goes on                                                                         |
| `SentinelVerdictKind Kind`                                                   | What the rule decided                                                                      |
| `Text? Message`                                                              | The message the player sees, plain or in its language, or `null` for the text of the proxy |
| `TimeSpan RetryAfter`                                                        | How long the player waits before trying again, for `Throttle`                              |
| `static SentinelVerdict Throttle(TimeSpan retryAfter, Text? message = null)` | Refuses it for now                                                                         |

`SentinelStages`: When Sentinel checks, each stage before the proxy spends more on the next one.

| Member           | What it is                                                                                                                                         |
|------------------|----------------------------------------------------------------------------------------------------------------------------------------------------|
| `None = 0`       | No stage                                                                                                                                           |
| `Connection = 1` | A new connection, with its address alone, before the login: rules must answer at once (no I/O), and a refusal closes the connection without a word |
| `Login = 2`      | A player whose identity is verified, before its login is accepted and its server chosen                                                            |
| `Transfer = 4`   | A move the player asks for with /server or /lobby                                                                                                  |
| `Command = 8`    | A command of the proxy a player runs; rules must answer at once                                                                                    |

`SentinelVerdictKind`: What a rule of Sentinel decides.

| Member         | What it is                                                    |
|----------------|---------------------------------------------------------------|
| `Allow = 0`    | It goes on                                                    |
| `Deny = 1`     | It is refused                                                 |
| `Throttle = 2` | It is refused for now: the player may try again after a while |
