---
title: plugin.json
description: "The manifest of an Orion plugin: id, version, application, main, dependencies and the folder Orion expects."
sidebar:
  order: 3
---

Every plugin has a `plugin.json` next to its project file. Orion reads it before it opens the library: the manifest names the plugin, says which application it belongs to and what it needs.

```json
{
  "id": "arena",
  "version": "1.0.0",
  "name": "Arena",
  "description": "A small arena with a command and a welcome.",
  "authors": ["You"],
  "main": "Arena",
  "application": "server"
}
```

## Keys

| Key | Required | Value |
|---|---|---|
| `id` | Yes | 1 to 64 lowercase letters, digits or `_`; the name of the folder of the plugin |
| `version` | Yes | Three numbers: `major.minor.patch` |
| `application` | Yes | `server` or `proxy`; a host skips a plugin of the other application, with a line in its log |
| `name` | No | A name to show |
| `description` | No | What it does |
| `authors` | No | A list of names |
| `main` | No | The file name of the library without its extension; the id by default. Set it when the names differ (`Arena` for `Arena.dll`), since Linux file names are case-sensitive |
| `dependencies` | No | `{ "id": "minimum version" }`: plugins that must be loaded first, at that version or later |
| `soft_dependencies` | No | `{ "id": "minimum version" }`: plugins that load first when they are installed; they never stop this one |

Keys are snake_case. Comments and trailing commas are accepted, and unknown keys are ignored. A mistake is reported in the log of the host with the path of the file and the key.

## Dependencies

```json
{
  "id": "arena_shop",
  "version": "1.2.0",
  "application": "server",
  "dependencies": { "arena": "1.0.0" },
  "soft_dependencies": { "economy": "2.0.0" }
}
```

Plugins are loaded and enabled dependencies first (the others by id), and disabled in the reverse order. A hard dependency that is missing, failed, disabled or too old stops the plugin; a soft one only orders the plugins when both are installed. Each plugin is its own native library: a dependency orders plugins, it does not let one call the C# code of another. Plugins share what they do through the host (a permission, the data of an entity, a world property) and through events.

## The folder of a plugin

The host keeps its plugins in `plugins/`, one folder per plugin named by its id:

```text
plugins/
└─ arena/
   ├─ plugin.json
   ├─ native/
   │  ├─ win-x64/Arena.dll
   │  └─ linux-x64/Arena.so
   ├─ lang/
   │  ├─ en_US/arena.blang
   │  └─ es_MX/arena.blang
   ├─ textures/, models/
   ├─ packs/
   └─ data/
```

| Path | What it is |
|---|---|
| `plugin.json` | The manifest |
| `native/<rid>/` | The native library for each platform the host may run on |
| `lang/<locale>/<id>.blang` | The texts of the plugin |
| `textures/`, `models/` | Files its custom content names |
| `packs/` | Resource packs it ships |
| `data/` | Created by Orion: the data directory of the plugin |

## The host section

The `plugins` section of `server.json` or `proxy.json` says where plugins are and how strict the host is with them:

```json
{
  "plugins": {
    "directory": "plugins",
    "disabled": ["old_shop"],
    "max_failures_per_minute": 20
  }
}
```

| Key | Default | What |
|---|---|---|
| `directory` | `plugins` | The folder of the plugins |
| `disabled` | `[]` | Ids of plugins that stay off without being removed |
| `max_failures_per_minute` | `20` | How many faults a plugin may have in a minute; one more disables it |

For the project that produces this folder, see [Getting started](../../server/plugins/basics/getting-started/). For faults and the failure limit, see [Errors and limits](../errors/).
