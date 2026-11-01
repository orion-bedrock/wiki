---
title: "Errors and limits"
description: "Orion server plugins: exceptions, faults, crashes and what Native AOT does not allow."
sidebar:
  order: 5
---

This page says what the SDK throws and why, what Orion does when a plugin fails, what cannot be contained, and what
Native AOT does not allow.

## Exceptions of the SDK

| Exception                                                                   | Thrown when                                                                                                                  | What to do                                                                               |
|-----------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| `PluginException`                                                           | Orion refused a call or its code failed: an unknown identifier, a value out of range, a wrong thread; the message is Orion's | Fix the call; catch it where a refusal is normal (a world that may not exist)            |
| `PluginObjectGoneException`                                                 | An object you hold is gone: a player that left, a world unloaded, a boss bar you disposed                                    | Check `player.IsOnline`, `world.IsLoaded`, `entity.IsRemoved` before using what you kept |
| `ArgumentException`, `ArgumentNullException`, `ArgumentOutOfRangeException` | The SDK found a mistake in the arguments before calling Orion: `null`, an empty name, a negative delay                       | Fix the call                                                                             |
| `InvalidOperationException`                                                 | Something is not available now: `GameServer.Current` in `OnLoad`, `Context.Content` after it                                 | Move the code to the right step ([The life of a plugin](../../basics/lifecycle/))                           |
| `OperationCanceledException`                                                | A wait ended because the plugin was disabled or the world unloaded: `world.Delay`, `SwitchTo`, an asynchronous member        | Let it end the method, or catch it where a stop is normal                                |

`PluginObjectGoneException` derives from `ObjectDisposedException` (so from `InvalidOperationException`), and
`PluginException.Result` tells what Orion answered:

| `PluginAbiResult` | Meaning                                             | Exception                    |
|-------------------|-----------------------------------------------------|------------------------------|
| `Ok`              | The call did what it was asked                      | None                         |
| `StaleHandle`     | An object of Orion is gone                          | `PluginObjectGoneException`  |
| `Failed`          | The code of Orion threw; its message is the message | `PluginException`            |
| `NullArgument`    | An argument that takes no `null` was `null`         | `PluginException`            |
| `Incompatible`    | The versions of the SDK and of Orion do not match   | `PluginException`            |
| `BufferTooSmall`  | Internal: the SDK retries with a larger buffer      | —                            |
| `Canceled`        | An asynchronous operation was canceled              | `OperationCanceledException` |

```csharp
try
{
    World arena = await GameServer.Current.WorldManager.LoadAsync("arena");
}
catch (PluginException exception)
{
    Context.Logger.LogWarning("The arena could not be loaded: {Reason}", exception.Message);
}
```

## Faults

A fault is a failure of the plugin that Orion catches: an exception thrown out of an event handler, a command, a task, a
form or menu action, a goal, a content callback, a message handler, a chat filter, a balancer or rule (on a proxy).
Orion logs it in the category `plugin.<id>` with its stack trace and counts it; what the code was doing is skipped (the
handler's changes are undone, the command answers that it failed).

| What                                                     | Result                                                                                    |
|----------------------------------------------------------|-------------------------------------------------------------------------------------------|
| A fault                                                  | Logged and counted, over a sliding minute                                                 |
| More faults in a minute than `max_failures_per_minute`   | The plugin is disabled: "Plugin … disabled after … failures in a minute (the limit is …)" |
| A failure Orion did not see (a background task of yours) | Report it with `PluginFaults.Report(message)`: logged and counted the same way            |

`max_failures_per_minute` is in the `plugins` section of `server.json` (20 by default, 1 to 10000). A plugin disabled
for its faults stays disabled until the server restarts, and the plugins that depend on it are disabled first.

## What cannot be contained

A plugin runs inside the process of Orion. An exception never crosses into Orion, but a crash of native code does:

| Crash               | Cause                                                    |
|---------------------|----------------------------------------------------------|
| A stack overflow    | Unbounded recursion                                      |
| An access violation | `unsafe` code or native interop gone wrong               |
| A fail-fast         | `Environment.FailFast`, a corrupted state of the runtime |
| `Environment.Exit`  | It ends the whole process                                |

Any of these ends the server with the plugin, as any native code of the process would. Keep `unsafe` code out of
plugins, and never call `Environment.Exit`.

## Native AOT

A plugin is compiled ahead of time to native code: it starts at once and needs no .NET runtime on the machine, but
what needs code generated at run time is not there. The compiler warns about it (`IL2026`, `IL3050` and the other
trimming and AOT warnings when you publish): treat those warnings as errors.

| Not available                                                | Use instead                                                                   |
|--------------------------------------------------------------|-------------------------------------------------------------------------------|
| `JsonSerializer` with reflection (`Serialize(value)`)        | A source-generated `JsonSerializerContext` ([Keeping data](../persistence/)) |
| `Assembly.Load`, plugins of a plugin, `Reflection.Emit`      | Code compiled into the plugin                                                 |
| `dynamic`, `Activator.CreateInstance(type)` of unknown types | Ordinary types, or a dictionary of factories                                  |
| Libraries that are not AOT-compatible                        | Libraries marked trimmable and AOT-compatible; check their warnings           |

Each plugin is its own native library with its own copy of the runtime: its static fields, its garbage collector and
its thread pool are its own. Two plugins never share .NET objects; they share what the server holds (players, worlds,
the data of entities) and the messages and events Orion carries.

## Build errors

The SDK checks the plugin when you build:

| Code      | What is wrong                                                                                                     |
|-----------|-------------------------------------------------------------------------------------------------------------------|
| `ORSG001` | The project references the SDK but has no `[assembly: OrionPlugin]`                                               |
| `ORSG003` | `[assembly: OrionPlugin]` names two classes: a library holds one plugin                                           |
| `ORSG004` | The class of `OrionPlugin` is not a plugin: it must not be abstract nor generic, and derive from `ServerPlugin`   |
| `ORSG005` | The class of `OrionPlugin` has no public constructor without parameters                                           |
| `ORSG006` | `[assembly: OrionPlugin]` is in a project that is not a class library                                             |
| `ORSG007` | A method marked `[EventHandler]` does not return `void` or does not take one event                                |
| `ORSG008` | A class with event or message handlers is not `partial` (or a class around it is not), or is static or generic    |
| `ORSG009` | A method marked `[MessageHandler]` does not take a `Player` and a `ReadOnlySpan<byte>`, or does not return `void` |
| `ORSG010` | A channel of messages is handled twice                                                                            |
| `ORSG011` | A channel of messages is not a valid name                                                                         |
| `ORSG012` | The project references the SDKs of the server and of the proxy                                                    |

## Limits

| Limit                                         | Value                                                        |
|-----------------------------------------------|--------------------------------------------------------------|
| Plugins per library                           | 1                                                            |
| Faults a minute before the plugin is disabled | `max_failures_per_minute`, 20 by default                     |
| Forms open at once for a player               | `PlayerForms.Limit`: 16                                      |
| Lines of a sidebar                            | `Sidebar.MaxLines`: 15                                       |
| Bytes of a message to the proxy               | `PluginMessages.MaxDataLength`: 24 576                       |
| Channel names                                 | 1 to 64 characters                                           |
| Plugin ids                                    | 1 to 64 lowercase letters, digits or `_`                     |
| Unloading                                     | Never while the server runs: a plugin changes with a restart |

## Reference

| Type                        | Members                                                                                      |
|-----------------------------|----------------------------------------------------------------------------------------------|
| `PluginException`           | `Result` (`PluginAbiResult`); constructors with a message, a message and its cause, a result |
| `PluginObjectGoneException` | Constructors with a message, and a message and its cause                                     |
| `PluginAbiResult`           | What Orion answered, the table above                                                         |
| `PluginFaults`              | `static bool Report(string message)`: reports a fault Orion did not see                      |
