---
title: Native compilation
description: Publish an Orion plugin as a native shared library for a supported platform, with the right toolchain and the AOT limits.
sidebar:
  order: 2
---

Every Orion plugin is compiled ahead of time to native code for a supported platform. It starts at once and needs no .NET runtime on the machine, but what needs code generated at run time is not there.

## Supported platforms

Orion Bedrock targets the following runtime platforms and architectures:

| Platform | Architecture | Runtime identifier | Toolchain |
|---|---|---|---|
| Linux | ARM64 | `linux-arm64` | [Clang/LLVM](https://clang.llvm.org/) |
| Linux | x64 | `linux-x64` | [Clang/LLVM](https://clang.llvm.org/) |
| macOS | ARM64 | `osx-arm64` | [Xcode Command Line Tools](https://developer.apple.com/xcode/resources/) |
| Windows | x64 | `win-x64` | [Visual Studio Build Tools 2026](https://visualstudio.microsoft.com/es/downloads/#build-tools-for-visual-studio-2026) |

The toolchain is the C/C++ toolchain Native AOT uses to link the shared library. Install the [.NET 10 SDK](https://learn.microsoft.com/dotnet/core/install/) and the [Native AOT prerequisites](https://learn.microsoft.com/dotnet/core/deploying/native-aot/#prerequisites) for the platform you publish on.

Some Orion components rely on native C/C++ libraries and platform-specific binaries. Consequently, a platform is supported only when those dependencies can be compiled and maintained for it. Other operating systems and architectures are not officially supported unless the required dependencies and build configurations become available.

## What the project needs

| Setting | Value | Why |
|---|---|---|
| `TargetFramework` | `net10.0` | The SDK targets .NET 10 |
| `OutputType` | `Library` | A plugin is a class library |
| `PublishAot` | `true` | `dotnet publish` makes a native shared library |
| `NativeLib` | `Shared` | Orion opens the library as a shared library |
| `AllowUnsafeBlocks` | `true` | Required by the SDK: the entry point of the plugin uses unsafe code |

```xml
<PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <OutputType>Library</OutputType>
    <PublishAot>true</PublishAot>
    <NativeLib>Shared</NativeLib>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks>
</PropertyGroup>
```

`dotnet build` still produces a normal managed library and runs the SDK checks. `dotnet publish -c Release -r <rid>` produces the native library Orion loads, named `<main>.dll` on Windows, `<main>.so` on Linux and `<main>.dylib` on macOS.

## Publish for the right platform

Native AOT builds for the operating system it runs on: publish on Windows for a Windows host, on Linux for a Linux host, and on macOS for an Apple silicon host. Run the command for the target platform:

```shell
dotnet publish -c Release -r win-x64       # Windows x64
dotnet publish -c Release -r linux-x64     # Linux x64
dotnet publish -c Release -r linux-arm64   # Linux ARM64
dotnet publish -c Release -r osx-arm64     # macOS Apple silicon
```

A plugin folder can hold the library for more than one platform under `native/<rid>/`; the host picks the one that matches. See [plugin.json](../plugin-json/) for the folder layout.

## What is not available

The compiler warns about code that needs run-time code generation (`IL2026`, `IL3050` and the other trimming and AOT warnings when you publish). Treat those warnings as errors.

| Not available | Use instead |
|---|---|
| `JsonSerializer` with reflection (`Serialize(value)`) | A source-generated `JsonSerializerContext` |
| `Assembly.Load`, plugins of a plugin, `Reflection.Emit` | Code compiled into the plugin |
| `dynamic`, `Activator.CreateInstance(type)` of unknown types | Ordinary types, or a dictionary of factories |
| Libraries that are not AOT-compatible | Libraries marked trimmable and AOT-compatible; check their warnings |

JSON is the usual first warning. A plugin declares the types it serializes:

```csharp
using System.Text.Json;
using System.Text.Json.Serialization;

public sealed class ArenaSettings
{
    public string World { get; set; } = "arena";

    public int RoundSeconds { get; set; } = 300;
}

[JsonSerializable(typeof(ArenaSettings))]
[JsonSourceGenerationOptions(WriteIndented = true, PropertyNamingPolicy = JsonKnownNamingPolicy.SnakeCaseLower)]
internal sealed partial class ArenaJson : JsonSerializerContext;
```

Then it serializes through the generated context instead of reflection:

```csharp
ArenaSettings settings = JsonSerializer.Deserialize(
    File.ReadAllText(path), ArenaJson.Default.ArenaSettings) ?? new();
```

## Each plugin is its own runtime

Each plugin is its own native library with its own copy of the runtime: its static fields, its garbage collector and its thread pool are its own. Two plugins never share .NET objects; they share what the server holds (players, worlds, the data of entities) and the messages and events Orion carries.

## Checklist

- [ ] `PublishAot` and `NativeLib` are set, and `AllowUnsafeBlocks` is on.
- [ ] The project references only one SDK.
- [ ] `dotnet publish -c Release -r <rid>` succeeds with no trimming or AOT warnings.
- [ ] The publish folder contains the native library, `plugin.json` and `lang/`.
- [ ] The library is under `plugins/<id>/native/<rid>/` on the host.
- [ ] JSON goes through a source-generated `JsonSerializerContext`.
- [ ] No `Assembly.Load`, `Reflection.Emit` or `Environment.Exit`.

For the full list of failures and exceptions, see [Errors and limits](../errors/) and the per-application pages: [server errors and limits](../../server/plugins/platform/errors-and-limits/) and [proxy errors and limits](../../proxy/plugins/network/errors-and-limits/).
