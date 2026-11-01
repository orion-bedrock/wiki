---
title: "Camera and cinematics"
description: "Orion server plugins: camera moves, fades, presets, paths and cinematics."
sidebar:
  order: 8
---

`player.Camera` takes the camera of a player away from its eyes: a fixed shot of the arena, a smooth move to a point,
a fade to black, a shake, a camera that follows an entity or a path, presets of your own, and cinematics, whole scenes
played as a line of time. The types are in `Orion.Sdk.Server.Cameras`.

## Shots and moves

```csharp
var arenaCenter = new Vector3(0, 64, 0);
player.Camera.MoveTo(new Vector3(0, 90, -30), arenaCenter, TimeSpan.Zero, CameraEasing.Linear);              // at once
player.Camera.MoveTo(new Vector3(30, 80, 0), arenaCenter, TimeSpan.FromSeconds(3), CameraEasing.InOutSine);  // over 3 s
player.Camera.Fade(TimeSpan.FromSeconds(0.5), TimeSpan.FromSeconds(1), TimeSpan.FromSeconds(0.5), rgb: 0x000000);
player.Camera.Shake(0.5f, TimeSpan.FromSeconds(2));
player.Camera.SetFieldOfView(30, 1.5f);                     // zoom in over 1.5 s
player.Camera.Reset();                                      // the player gets its own camera back
```

Every time takes a `TimeSpan` or a number of seconds. `CameraEasing` is the curve of a move (`Linear`, `Spring`, and
`In`, `Out`, `InOut` of `Quad`, `Cubic`, `Quart`, `Quint`, `Sine`, `Expo`, `Circ`, `Bounce`, `Back`, `Elastic`).
`SetPerspective` forces one of the views of F5 (`FirstPerson`, `ThirdPerson`, `ThirdPersonFront`) until `Reset`.

## Follow an entity or a path

```csharp
player.Camera.Track(mob);                                   // the camera turns to follow it
player.Camera.StopTracking();
player.Camera.Attach(minecart);                             // the camera rides with it
player.Camera.Detach();

CameraPath flyover = CameraPath.CatmullRom(new Vector3(-40, 90, -40), new Vector3(0, 100, 0), new Vector3(40, 90, 40))
    with { LookAt = new Vector3(0, 64, 0) };
player.Camera.Follow(flyover, TimeSpan.FromSeconds(8));
```

`CameraPath.CatmullRom` is a smooth curve through the points and `Linear` straight lines between them; `with { LookAt,
Easing }` makes the camera look at a point and ease along the path.

## Cinematics

A cinematic is a line of time: `Cut`, `Move` and `Wait` move its cursor, and the other steps (`Fade`, `FieldOfView`,
`Shake`, `Run`) happen at the cursor. Positions are relative to the origin it is played at, so one cinematic plays
anywhere. It hides the screen and locks the camera and the movement while it plays, unless `hideHud` is `false`.

```csharp
Cinematic intro = Cinematic.Create()
    .Fade(TimeSpan.Zero, TimeSpan.FromSeconds(0.5), TimeSpan.FromSeconds(1))
    .Cut(new Vector3(0, 10, -25), new Vector3(0, 0, 0))
    .Move(new Vector3(25, 12, 0), new Vector3(0, 0, 0), TimeSpan.FromSeconds(4))
    .Run(p => p.Hud.ShowTitle("Welcome to the arena", null, 10, 40, 10))
    .Wait(TimeSpan.FromSeconds(2))
    .Shake(0.3f, TimeSpan.FromSeconds(1));

CinematicEnd end = await player.Camera.PlayAsync(intro, origin: new Vector3(0, 64, 0));
if (end == CinematicEnd.Finished)
{
    player.SendMessage("Good luck!");
}
```

| `CinematicEnd` | Why it ended                                          |
|----------------|-------------------------------------------------------|
| `Finished`     | It played to the end                                  |
| `Stopped`      | It was stopped (`StopCinematic`), or the camera reset |
| `Replaced`     | Another cinematic started for the player              |
| `Left`         | The player left its world or the game                 |

`Run` steps call your code on the thread of the world of the player, as a lambda or a method of the plugin; `PlayAsync`
completes there. A cinematic object is a template: play it as often and for as many players as you like.

```csharp
using Orion.Sdk.Server.Cameras;
using Orion.Sdk.Server.Math;
using Orion.Sdk.Server.Players;

namespace Arena;

public static class Intros
{
    public static readonly Cinematic Arena = Cinematic.Create()
        .Cut(new Vector3(0, 20, -30), Vector3Zero)
        .Run(ShowTitle)
        .Move(new Vector3(0, 8, -12), Vector3Zero, TimeSpan.FromSeconds(3), CameraEasing.OutCubic)
        .Run(PlayHorn);

    private static Vector3 Vector3Zero => new(0, 0, 0);

    private static void ShowTitle(Player player) => player.Hud.ShowTitle("§cARENA", "Round 1", 10, 50, 10);

    private static void PlayHorn(Player player) => player.PlaySound("raid.horn", 1, 1);
}
```

## Camera presets

A preset is a camera the client knows by name: one of the game (`minecraft:free`, `minecraft:first_person`,
`minecraft:third_person`, `minecraft:follow_orbit`…) or one of your plugin, described in `OnLoad` as content and sent to
every player who joins:

```csharp
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Cameras;
using Orion.Sdk.Server.Math;

namespace Arena;

public sealed class SpectatorPlugin : ServerPlugin
{
    public override void OnLoad() => Context.Content
        .CameraPreset("arena:overview", preset => preset
            .Position(new Vector3(0, 100, 0))
            .Rotation(pitch: 70, yaw: 0)
            .PlayerEffects(false)
            .AudioListener(CameraAudioListener.Camera))
        .CameraPreset("arena:orbit", preset => preset
            .Parent("minecraft:follow_orbit")
            .Radius(8)
            .ControlScheme(CameraControlScheme.CameraRelative));

    public override void OnEnable() =>
        Context.Commands.Register("overview", spec => spec.Executes(call => call.Player.Camera.SetPreset("arena:overview")));
}
```

`player.Camera.Preset` is the preset the camera is in, and `GameServer.Current.CameraPresetIds` lists every preset of
the server.

## Reference

`PlayerCamera`: The camera of a player: perspectives, a free camera with shots and smooth moves, fades, the field of
view, following an entity, paths, shakes and cinematics.

| Member                                                                                                   | What it is                                                                                                                                                       |
|----------------------------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `void Attach(Entity entity)`                                                                             | Makes the camera go with an entity, such as a minecart or a mob                                                                                                  |
| `void Detach()`                                                                                          | Stops going with the entity of Attach                                                                                                                            |
| `void Fade(float fadeIn, float hold, float fadeOut, int rgb)`                                            | Fades the screen to a color and back                                                                                                                             |
| `void Fade(TimeSpan fadeIn, TimeSpan hold, TimeSpan fadeOut, int rgb)`                                   | Fades the screen to a color and back                                                                                                                             |
| `void Follow(CameraPath path, float seconds)`                                                            | Moves the free camera along a path, from its first point to its last                                                                                             |
| `void Follow(CameraPath path, TimeSpan duration)`                                                        | Moves the free camera along a path, from its first point to its last                                                                                             |
| `bool IsPlaying`                                                                                         | Whether a cinematic plays                                                                                                                                        |
| `void MoveTo(Vector3 position, Vector3 lookAt, float seconds, CameraEasing easing)`                      | Puts the camera at a place, looking at a point, at once or over a time                                                                                           |
| `void MoveTo(Vector3 position, Vector3 lookAt, TimeSpan ease, CameraEasing easing)`                      | Puts the camera at a place, looking at a point, over a time                                                                                                      |
| `async Task<CinematicEnd> PlayAsync(Cinematic cinematic, Vector3 origin = default, bool hideHud = true)` | Plays a cinematic. By default it hides the screen and locks the camera and the movement until it ends; the code goes on on the thread of the world of the player |
| `string? Preset`                                                                                         | The identifier of the preset the camera is in, such as minecraft:free or one of a plugin, or null when none was set                                              |
| `void Reset()`                                                                                           | Gives the camera back to the player: the cinematic stops, and the preset, the field of view, the followed entity and the attached entity go away                 |
| `void ResetFieldOfView()`                                                                                | Gives the player its own field of view back                                                                                                                      |
| `void SetFieldOfView(float degrees, float seconds)`                                                      | Changes the field of view, at once or over a time                                                                                                                |
| `void SetPerspective(CameraPerspective perspective)`                                                     | Sets one of the views of the game; the player cannot change it with F5 until Reset                                                                               |
| `void SetPreset(string presetId)`                                                                        | Puts the camera in a preset of the server: one of the game, or one a plugin registered in OnLoad                                                                 |
| `void Shake(float intensity, float seconds)`                                                             | Shakes the camera                                                                                                                                                |
| `void Shake(float intensity, TimeSpan duration)`                                                         | Shakes the camera                                                                                                                                                |
| `void StopCinematic()`                                                                                   | Stops the cinematic that plays, if any                                                                                                                           |
| `void StopShaking()`                                                                                     | Stops every shake of the camera                                                                                                                                  |
| `void StopTracking()`                                                                                    | Stops following the entity of Track                                                                                                                              |
| `void Track(Entity entity)`                                                                              | Turns the camera to follow an entity, until tracking stops                                                                                                       |

`Cinematic`: a line of time played for a player with `player.Camera.PlayAsync`.

| Member                                                                                                              | What it is                                                                           |
|---------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------|
| `static Cinematic Create()`                                                                                         | Starts a cinematic                                                                   |
| `Cinematic Cut(Vector3 position, Vector3 lookAt)`                                                                   | Puts the camera at a place at once                                                   |
| `TimeSpan Duration`                                                                                                 | How long the cinematic lasts so far                                                  |
| `Cinematic Fade(TimeSpan fadeIn, TimeSpan hold, TimeSpan fadeOut, int rgb = 0)`                                     | Fades the screen to a color and back, from the cursor                                |
| `Cinematic FieldOfView(float degrees, TimeSpan duration = default)`                                                 | Changes the field of view, from the cursor                                           |
| `Cinematic Move(Vector3 position, Vector3 lookAt, TimeSpan duration, CameraEasing easing = CameraEasing.InOutSine)` | Moves the camera to a place over a time, and the cursor after it                     |
| `Cinematic Run(Action<Player> action)`                                                                              | Runs code at the cursor, on the thread of the world of the player (a title, a sound) |
| `Cinematic Shake(float intensity, TimeSpan duration)`                                                               | Shakes the camera, from the cursor                                                   |
| `int StepCount`                                                                                                     | The number of steps                                                                  |
| `Cinematic Wait(TimeSpan duration)`                                                                                 | Waits: moves the cursor                                                              |

`CinematicEnd`: how a cinematic ended.

| Member         | What it is                               |
|----------------|------------------------------------------|
| `Finished = 0` | It played to the end                     |
| `Stopped = 1`  | It was stopped, or the camera was reset  |
| `Replaced = 2` | Another cinematic started for the player |
| `Left = 3`     | The player left its world or the game    |

`CameraPath` (a record): a path of the free camera: its type, points, the point it looks at and its easing.

| Member                                                                                                 | What it is                                                   |
|--------------------------------------------------------------------------------------------------------|--------------------------------------------------------------|
| `CameraPath(CameraPathType type, IReadOnlyList<Vector3> points, Vector3? lookAt, CameraEasing easing)` | A new `CameraPath`                                           |
| `static CameraPath CatmullRom(params Vector3[] points)`                                                | A smooth curve through points, looking ahead, with no easing |
| `CameraEasing Easing`                                                                                  | The curve the camera eases along the path with               |
| `static CameraPath Linear(params Vector3[] points)`                                                    | Straight lines between points, looking ahead, with no easing |
| `Vector3? LookAt`                                                                                      | The point the camera looks at, or `null` to look ahead       |
| `IReadOnlyList<Vector3> Points`                                                                        | The points of the path                                       |
| `CameraPathType Type`                                                                                  | How it joins its points: `CatmullRom` or `Linear`            |

`CameraPathType`: How a CameraPath joins its points.

| Member           | What it is                         |
|------------------|------------------------------------|
| `CatmullRom = 0` | A smooth curve through every point |
| `Linear = 1`     | Straight lines between the points  |

`CameraPerspective`: The views of the game a player switches between with F5.

| Member                 | What it is                             |
|------------------------|----------------------------------------|
| `FirstPerson = 0`      | From the eyes of the player            |
| `ThirdPerson = 1`      | From behind the player                 |
| `ThirdPersonFront = 2` | From in front of the player, facing it |

`CameraPresetBuilder`: Describes a camera preset of the plugin
(`Context.Content.CameraPreset("arena:overview", preset => …)`), which every player gets when it joins: the preset of
the game it inherits from (`minecraft:free` by default) and what it changes of it. At runtime
`player.Camera.SetPreset("arena:overview")` puts a camera in it.

| Member                                                                      | What it is                                                                                              |
|-----------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `CameraPresetBuilder AudioListener(CameraAudioListener listener)`           | Sets where sounds are heard from                                                                        |
| `CameraPresetBuilder ControlScheme(CameraControlScheme scheme)`             | Sets how the player moves while in the preset                                                           |
| `CameraPresetBuilder EntityOffset(Vector3 offset)`                          | Sets the offset from the entity a camera follows                                                        |
| `CameraPresetBuilder Parent(string presetId)`                               | Sets the preset of the game it inherits from, such as minecraft:follow_orbit; minecraft:free by default |
| `CameraPresetBuilder PlayerEffects(bool enabled)`                           | Sets whether the effects of the player (such as nausea) apply to the camera                             |
| `CameraPresetBuilder Position(Vector3 position)`                            | Sets where a free camera is                                                                             |
| `CameraPresetBuilder Radius(float radius)`                                  | Sets the distance of a camera that orbits the player                                                    |
| `CameraPresetBuilder Rotation(float pitch, float yaw)`                      | Sets where a free camera looks                                                                          |
| `CameraPresetBuilder RotationSpeed(float speed, bool snapToTarget = false)` | Sets how fast the camera turns, and whether it snaps to its target                                      |
| `CameraPresetBuilder ViewOffset(float x, float y)`                          | Sets the offset of the view of a camera that follows the player, as the third person cameras have       |

`CameraAudioListener`: Where a player hears sounds from while its camera is in a preset.

| Member       | What it is      |
|--------------|-----------------|
| `Camera = 0` | From the camera |
| `Player = 1` | From the player |

`CameraControlScheme`: How the movement keys of a player map to directions while its camera is in a preset.

| Member                           | What it is                                                                |
|----------------------------------|---------------------------------------------------------------------------|
| `LockedPlayerRelativeStrafe = 0` | Relative to the player, which strafes and does not turn with the movement |
| `CameraRelative = 1`             | Relative to the camera; the player turns where it walks                   |
| `CameraRelativeStrafe = 2`       | Relative to the camera; the player strafes                                |
| `PlayerRelative = 3`             | Relative to the player; the player turns where it walks                   |
| `PlayerRelativeStrafe = 4`       | Relative to the player; the player strafes                                |

`CameraEasing`: the list above. `CameraEasing`: The curve a camera follows from where it is to where it goes.

| Member              | What it is                           |
|---------------------|--------------------------------------|
| `Linear = 0`        | At an even pace                      |
| `Spring = 1`        | Overshoots and settles, as a spring  |
| `InQuad = 2`        | Eases in, on a quad curve            |
| `OutQuad = 3`       | Eases out, on a quad curve           |
| `InOutQuad = 4`     | Eases in and out, on a quad curve    |
| `InCubic = 5`       | Eases in, on a cubic curve           |
| `OutCubic = 6`      | Eases out, on a cubic curve          |
| `InOutCubic = 7`    | Eases in and out, on a cubic curve   |
| `InQuart = 8`       | Eases in, on a quart curve           |
| `OutQuart = 9`      | Eases out, on a quart curve          |
| `InOutQuart = 10`   | Eases in and out, on a quart curve   |
| `InQuint = 11`      | Eases in, on a quint curve           |
| `OutQuint = 12`     | Eases out, on a quint curve          |
| `InOutQuint = 13`   | Eases in and out, on a quint curve   |
| `InSine = 14`       | Eases in, on a sine curve            |
| `OutSine = 15`      | Eases out, on a sine curve           |
| `InOutSine = 16`    | Eases in and out, on a sine curve    |
| `InExpo = 17`       | Eases in, on a expo curve            |
| `OutExpo = 18`      | Eases out, on a expo curve           |
| `InOutExpo = 19`    | Eases in and out, on a expo curve    |
| `InCirc = 20`       | Eases in, on a circ curve            |
| `OutCirc = 21`      | Eases out, on a circ curve           |
| `InOutCirc = 22`    | Eases in and out, on a circ curve    |
| `InBounce = 23`     | Eases in, on a bounce curve          |
| `OutBounce = 24`    | Eases out, on a bounce curve         |
| `InOutBounce = 25`  | Eases in and out, on a bounce curve  |
| `InBack = 26`       | Eases in, on a back curve            |
| `OutBack = 27`      | Eases out, on a back curve           |
| `InOutBack = 28`    | Eases in and out, on a back curve    |
| `InElastic = 29`    | Eases in, on a elastic curve         |
| `OutElastic = 30`   | Eases out, on a elastic curve        |
| `InOutElastic = 31` | Eases in and out, on a elastic curve |
