---
title: "The life of a plugin"
description: "Orion proxy plugins: `OnLoad`, `OnEnable`, `OnDisable`, the context of the plugin, dependencies and failures."
sidebar:
  order: 2
---

Orion creates one instance of your plugin class when the proxy starts, and calls `OnLoad`, `OnEnable` and `OnDisable`
at the steps of its life. Override the ones you need.

## The three steps

| Step        | When                                                                                                                      | Do here                                                                          |
|-------------|---------------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------|
| `OnLoad`    | While the proxy builds itself, before it exists; the texts of the plugin join its translations                            | Read your configuration                                                          |
| `OnEnable`  | Once its registry of servers is ready, before it listens for players                                                      | Register commands, tasks, listeners, balancers, Sentinel rules, message handlers |
| `OnDisable` | When the proxy stops, once its players are gone, in the reverse order of the loading; or when the plugin failed too often | Save what the plugin keeps                                                       |

```csharp
using Microsoft.Extensions.Logging;
using Orion.Sdk;
using Orion.Sdk.Proxy;

[assembly: OrionPlugin(typeof(Network.NetworkPlugin))]

namespace Network;

public sealed class NetworkPlugin : ProxyPlugin
{
    private string[] _motd = [];

    private string MotdPath => Path.Combine(Context.DataDirectory, "motd.txt");

    public override void OnLoad() => _motd = File.Exists(MotdPath) ? File.ReadAllLines(MotdPath) : ["Welcome!"];

    public override void OnEnable()
    {
        ProxyServer proxy = ProxyServer.Current;
        Context.Logger.LogInformation("{Proxy}: {Servers} servers in {Groups} groups", proxy.Name, proxy.Servers.All.Count, proxy.Servers.Groups.Count);
        Context.Commands.Register("motd", spec => spec.Executes(call =>
        {
            foreach (string line in _motd)
            {
                call.Reply(line);
            }
        }));
    }

    public override void OnDisable() => File.WriteAllLines(MotdPath, _motd);
}
```

## What is available at each step

| Member                                                            | `OnLoad`                    | `OnEnable` | `OnDisable`             |
|-------------------------------------------------------------------|-----------------------------|------------|-------------------------|
| `Context.Id`, `Version`, `DataDirectory`, `Logger`                | Yes                         | Yes        | Yes                     |
| `ProxyServer.Current` and everything reached from it              | `InvalidOperationException` | Yes        | Yes, until it returns   |
| `Context.Commands`, `Scheduler`, `Events.Register`, `Messages.On` | Not yet                     | Yes        | Removed when it returns |
| `Context.Translations`                                            | Not yet                     | Yes        | Yes                     |

The handlers of the plugin class itself are registered just before `OnEnable`.

## What is released with the plugin

When the plugin is disabled, Orion releases everything it registered: its event and message handlers, commands, tasks,
balancers (the groups that named one go back to the balancer of the proxy of that name), Sentinel rules and the forms
it left open.

## The context

| Member                  | What it is                                                                            |
|-------------------------|---------------------------------------------------------------------------------------|
| `Context.Id`, `Version` | The `id` and `version` of `plugin.json`                                               |
| `Context.DataDirectory` | The full path of `plugins/<id>/data`, which Orion creates                             |
| `Context.Logger`        | The logger of the plugin ([Logging](../logging/))                                   |
| `Context.Events`        | Registers listeners ([Events](../events/))                                          |
| `Context.Messages`      | Messages with the servers ([Messages with the servers](../../network/messaging/))                              |
| `Context.Commands`      | Registers commands ([Commands](../commands/))                                       |
| `Context.Scheduler`     | Schedules tasks ([Scheduled tasks](../scheduler/))                                        |
| `Context.Translations`  | The texts of the `lang` folder ([Text and translations](../text-and-translations/)) |

`Commands`, `Scheduler` and `Translations` are extension properties of `PluginContext` declared by
`ProxyPluginContext`: they come with `using Orion.Sdk.Proxy;`.

## Starting and stopping events

`ProxyStartedEvent` comes when the proxy listens for players, after the `OnEnable` of every plugin;
`ProxyStoppingEvent` when it begins to stop, while its players are still connected, for the last time.

```csharp
[EventHandler]
public static void OnStopping(ProxyStoppingEvent e) =>
    e.Proxy.Broadcast("The network is restarting, see you in a minute!");
```

## Dependencies and failures

`dependencies` and `soft_dependencies` of `plugin.json` order plugins as on a server, and a plugin fails for the same
reasons: a `plugin.json` that cannot be read, a missing dependency, a version of the SDK the proxy does not support,
`OnLoad` or `OnEnable` throwing. More faults in a minute than `max_failures_per_minute` (20 by default) disable it
([Errors and limits](../../network/errors-and-limits/)). A plugin of the proxy cannot depend on a plugin of a server: they run in
different processes, and talk through messages.

## Reference

| Member of `ProxyPlugin` (from `Plugin`) | What it is                                                                                  |
|-----------------------------------------|---------------------------------------------------------------------------------------------|
| `Context`                               | The `PluginContext` of the plugin                                                           |
| `virtual void OnLoad()`                 | Called once, while the proxy is built                                                       |
| `virtual void OnEnable()`               | Called once the registry of servers is ready, before the proxy listens                      |
| `virtual void OnDisable()`              | Called when the proxy stops, once its players are gone, or when the plugin failed too often |

| Attribute                            | What it is                                                                                 |
|--------------------------------------|--------------------------------------------------------------------------------------------|
| `[assembly: OrionPlugin(typeof(T))]` | Names the plugin class of the library (`OrionPluginAttribute.PluginType`); one per library |
