---
title: "Maintenance"
description: "Orion proxy plugins: maintenance of the proxy, of a group or of a server."
sidebar:
  order: 6
---

Maintenance closes the whole network, a group or one server to everyone but the players with the bypass permission:
while an update is installed, a map rebuilt, a server fixed. The state is saved by the proxy and holds across restarts.
The types are in `Orion.Sdk.Proxy.Maintenance`.

## Put the network, a group or a server into maintenance

```csharp
Maintenance maintenance = ProxyServer.Current.Maintenance;
maintenance.SetGroup("skywars", enabled: true, kick: true);     // its players without the permission go to their fallback
maintenance.SetServer("lobby-2", enabled: true, kick: false);   // nobody new joins it; its players stay
maintenance.Set(enabled: true, kick: false);                    // the whole proxy: only players with the permission join
maintenance.Set(enabled: false, kick: false);
```

| Scope     | While it is in maintenance                                                                                                  |
|-----------|-----------------------------------------------------------------------------------------------------------------------------|
| The proxy | Only players with the bypass permission join, and the server list shows the `motd` of `maintenance` in `proxy.json`         |
| A group   | Its servers take only players with the bypass permission: the balancer, the fallback and `/server` skip them for the others |
| A server  | It takes only players with the bypass permission                                                                            |

With `kick: true`, the players already there without the permission are moved (a group or server: to their fallback)
or disconnected (the proxy). The bypass permission is `bypass_permission` of `maintenance` in `proxy.json`
(`bedrock.proxy.maintenance.bypass` by default); operators have it.

## Read the state

```csharp
Maintenance state = ProxyServer.Current.Maintenance;
bool closed = state.IsEnabled;                                   // the whole proxy
bool skywars = state.IsGroupInMaintenance("skywars");
bool canJoin = state.CanBypass(player);
if (ProxyServer.Current.Servers.Find("sw-1") is { } server && state.IsInMaintenance(server))
{
    player.SendMessage("sw-1 is in maintenance, itself, through its group or with the proxy.");
}

IReadOnlyList<string> groups = state.Groups;                     // the groups in maintenance
```

## Watch changes

`MaintenanceChangedEvent` comes when the proxy, a group or a server goes into maintenance or out of it: `Scope`
(`Proxy`, `Group`, `Server`), `Target` (the group or server, `null` for the proxy) and `IsEnabled`.

```csharp
[EventHandler]
public static void OnMaintenance(MaintenanceChangedEvent e)
{
    string what = e.Scope == MaintenanceScope.Proxy ? "The network" : $"{e.Scope} {e.Target}";
    ProxyServer.Current.Broadcast($"§e{what} is {(e.IsEnabled ? "in" : "out of")} maintenance.");
}
```

## Reference

`Maintenance` (`ProxyServer.Current.Maintenance`): the maintenance of the proxy, of its groups and of its servers.

| Member                                                 | What it is                                                                       |
|--------------------------------------------------------|----------------------------------------------------------------------------------|
| `string BypassPermission`                              | The permission that lets a player in during maintenance                          |
| `bool CanBypass(Player player)`                        | Tells whether a player may join during maintenance                               |
| `IReadOnlyList<string> Groups`                         | The groups in maintenance                                                        |
| `bool IsEnabled`                                       | Whether the whole proxy is in maintenance                                        |
| `bool IsGroupInMaintenance(string group)`              | Tells whether a group is in maintenance                                          |
| `bool IsInMaintenance(Server server)`                  | Tells whether a server is in maintenance, itself, by its group or with the proxy |
| `bool IsServerInMaintenance(string id)`                | Tells whether a server is in maintenance, by id                                  |
| `IReadOnlyList<string> Servers`                        | The servers in maintenance, by id                                                |
| `bool Set(bool enabled, bool kick)`                    | Puts the whole proxy into maintenance or out of it                               |
| `bool SetGroup(string group, bool enabled, bool kick)` | Puts a group into maintenance or out of it                                       |
| `bool SetServer(string id, bool enabled, bool kick)`   | Puts a server into maintenance or out of it                                      |

`MaintenanceScope`: What is in maintenance.

| Member       | What it is                                                        |
|--------------|-------------------------------------------------------------------|
| `Proxy = 0`  | The whole proxy: only players with the bypass permission join     |
| `Group = 1`  | A group: its servers take only players with the bypass permission |
| `Server = 2` | A server: it takes only players with the bypass permission        |
