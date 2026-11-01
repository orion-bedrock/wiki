---
title: "Errors and limits"
description: "Orion proxy plugins: exceptions, faults, crashes and what Native AOT does not allow."
sidebar:
  order: 9
---

What the SDK of the proxy throws, what Orion does when a plugin fails, what cannot be contained, and what Native AOT
does not allow. It works as on a server ([Errors and limits](../../../../server/plugins/platform/errors-and-limits/) has the
details of each point); this page lists what a proxy plugin meets.

## Exceptions of the SDK

| Exception                         | Thrown when                                                                                       |
|-----------------------------------|---------------------------------------------------------------------------------------------------|
| `PluginException`                 | Orion refused a call or its code failed; the message is Orion's (`Result` is a `PluginAbiResult`) |
| `PluginObjectGoneException`       | An object you hold is gone: a player that left the proxy, a server removed                        |
| `ArgumentException` and its kinds | The SDK found a mistake in the arguments before calling Orion                                     |
| `InvalidOperationException`       | `ProxyServer.Current` in `OnLoad`                                                                 |
| `OperationCanceledException`      | A wait ended because the plugin was disabled                                                      |

Transfers never throw for a server that cannot take a player: they complete with a `TransferResult`
([Transfers](../transfers/)).

```csharp
try
{
    ProxyServer.Current.Servers.Add("bw-9", "bedwars", "10.0.0.39", 19140, 16);
}
catch (PluginException exception)
{
    Context.Logger.LogWarning("bw-9 was not added: {Reason}", exception.Message);
}
```

## Faults

A fault is an exception Orion catches out of the code of the plugin: an event or message handler, a command, a task,
a form action, a balancer, a Sentinel rule. Orion logs it in `plugin.<id>` and counts it; more than
`max_failures_per_minute` (in the `plugins` section of `proxy.json`, 20 by default) in a minute disable the plugin.
`PluginFaults.Report(message)` reports a failure Orion did not see, such as one in a background task of yours. A
balancer or rule that fails gives way to the proxy (its own balancer, an allowed verdict): the network goes on.

## What cannot be contained

A stack overflow, an access violation of `unsafe` code, a fail-fast or `Environment.Exit` end the whole proxy, and every
player with it. Keep `unsafe` code out of plugins.

## Native AOT

A plugin is compiled ahead of time: no reflection-based JSON (use a source-generated `JsonSerializerContext`), no
loading of assemblies or emitting code, no `dynamic`; treat the trimming and AOT warnings of `dotnet publish` (`IL2026`,
`IL3050`…) as errors. Each plugin has its own copy of the runtime: its statics and objects are its own, and two
plugins share only what Orion carries (players, servers, events, messages).

## Build errors

The SDK checks the plugin when you build: `ORSG003` to `ORSG006` for the plugin class and the project, `ORSG007`
and `ORSG008` for event handlers, `ORSG009` to `ORSG011` for message handlers and channels, `ORSG012` when both SDKs
are referenced. The table of each is in [Errors and limits](../../../../server/plugins/platform/errors-and-limits/).

## Limits

| Limit                                                   | Value                                                       |
|---------------------------------------------------------|-------------------------------------------------------------|
| Plugins per library                                     | 1                                                           |
| Faults a minute before the plugin is disabled           | `max_failures_per_minute`, 20 by default                    |
| Time a Sentinel rule may take at `Login` and `Transfer` | 5 seconds                                                   |
| Bytes of a message to a server                          | `PluginMessages.MaxDataLength`: 24 576                      |
| Server ids and group names                              | 1 to 32 lowercase letters, digits, `-` or `_`               |
| Unloading                                               | Never while the proxy runs: a plugin changes with a restart |

## Reference

| Type                        | Members                                                                                      |
|-----------------------------|----------------------------------------------------------------------------------------------|
| `PluginException`           | `Result` (`PluginAbiResult`); constructors with a message, a message and its cause, a result |
| `PluginObjectGoneException` | Constructors with a message, and a message and its cause                                     |
| `PluginAbiResult`           | `Ok`, `StaleHandle`, `Failed`, `Incompatible`, `BufferTooSmall`, `NullArgument`, `Canceled`  |
| `PluginFaults`              | `static bool Report(string message)`                                                         |
