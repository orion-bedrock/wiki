---
title: "Sounds and particles"
description: "Orion server plugins: sounds and particle effects."
sidebar:
  order: 9
---

A plugin plays sounds and shows particle effects in a world, for the players near them, or to one player alone. Both
are named by identifiers: those of the game are constants of `SoundIds`, `SoundEventIds` and `ParticleIds` (namespace
`Bedrock.Identifiers`), and a resource pack adds its own. The types are in `Orion.Sdk.Server.Worlds`.

## Sounds

```csharp
world.Sounds.Play(SoundIds.RandomOrb, player.Position, volume: 1, pitch: 1.2f);   // for the players within its distance
world.Sounds.PlayEvent(SoundEventIds.Explode, new Vector3(0, 64, 0));            // a sound event, as the game plays it
world.Sounds.Stop(SoundIds.RecordCat);                                           // for every player of the world

player.PlaySound(SoundIds.RandomLevelup, 1, 1);                                   // this player alone, at its head
player.StopSound(SoundIds.RandomLevelup);
player.StopAllSounds(stopMusic: true);
```

| Kind             | Identifiers     | Played with                             | What it is                                                                                  |
|------------------|-----------------|-----------------------------------------|---------------------------------------------------------------------------------------------|
| Sound definition | `SoundIds`      | `world.Sounds.Play`, `player.PlaySound` | A sound of the resource pack: `random.orb`, `note.pling`, `mob.zombie.say`                  |
| Sound event      | `SoundEventIds` | `world.Sounds.PlayEvent`                | What the game plays when something happens, with its own volume and pitch: `explode`, `bow` |

## Particles

```csharp
world.Particles.Spawn(ParticleIds.BasicFlameParticle, new Vector3(0.5f, 65, 0.5f));
world.Particles.SpawnOn(ParticleIds.HeartParticle, mob);                         // follows the entity
player.ShowParticle(ParticleIds.TotemParticle, player.Position);                  // this player alone

world.Particles.Spawn(ParticleIds.DragonBreathTrail, new Vector3(0, 66, 0),
    MolangVariable.Number("variable.size", 2),
    MolangVariable.Color("variable.color", 1, 0, 0));                            // Molang variables the effect starts with
```

`MolangVariable.Number(name, value)`, `Vector(name, vector)` and `Color(name, red, green, blue, alpha)` (each from 0 to
1) give the variables a particle effect reads, as its resource pack defines them.

## A trail, with a task

```csharp
using Bedrock.Identifiers;
using Orion.Sdk;
using Orion.Sdk.Server;
using Orion.Sdk.Server.Game;
using Orion.Sdk.Server.Players;

namespace Lobby;

public sealed class TrailsPlugin : ServerPlugin
{
    private readonly HashSet<string> _withTrail = [];

    public override void OnEnable()
    {
        Context.Commands.Register("trail", spec => spec.Executes(call =>
        {
            bool on = _withTrail.Add(call.Player.Uuid);
            if (!on)
            {
                _withTrail.Remove(call.Player.Uuid);
            }

            call.Reply(on ? "Trail on." : "Trail off.");
        }));

        Context.Scheduler.Every(2, _ =>
        {
            foreach (Player player in GameServer.Current.DefaultWorld!.Players)
            {
                if (_withTrail.Contains(player.Uuid))
                {
                    player.World!.Particles.Spawn(ParticleIds.VillagerHappy, player.Position);
                }
            }
        });
    }
}
```

## Identifiers

An identifier the server does not know throws `PluginException`. `GameServer.Current.SoundIds` and `ParticleIds` list
those the server has, packs included. A sound or particle of your own goes in a resource pack the plugin ships in its
`packs` folder ([Custom content](../../platform/custom-content/)).

## Reference

| Member of `Player`                                                                          | What it does                                               |
|---------------------------------------------------------------------------------------------|------------------------------------------------------------|
| `void PlaySound(string soundId, float volume, float pitch)`                                 | Plays a sound definition to this player alone, at its head |
| `void StopSound(string soundId)`                                                            | Stops a sound definition for this player                   |
| `void StopAllSounds(bool stopMusic)`                                                        | Stops every sound this player hears                        |
| `void ShowParticle(string particleId, Vector3 position)`                                    | Shows a particle effect to this player alone               |
| `void ShowParticle(string particleId, Vector3 position, params MolangVariable[] variables)` | The same, with Molang variables                            |

| Member of `GameServer`              | What it is                                            |
|-------------------------------------|-------------------------------------------------------|
| `IReadOnlyList<string> SoundIds`    | The identifiers of the sounds of the server           |
| `IReadOnlyList<string> ParticleIds` | The identifiers of the particle effects of the server |

`WorldSounds`: The sounds played in a world.

| Member                                                                   | What it is                                                      |
|--------------------------------------------------------------------------|-----------------------------------------------------------------|
| `void Play(string soundId, Vector3 position, float volume, float pitch)` | Plays a sound definition for the players within its distance    |
| `void PlayEvent(string eventId, Vector3 position)`                       | Plays a sound event of the game at a position, as the game does |
| `void Stop(string soundId)`                                              | Stops a sound definition for every player of the world          |

`WorldParticles`: The particles shown in a world.

| Member                                                                               | What it is                                                            |
|--------------------------------------------------------------------------------------|-----------------------------------------------------------------------|
| `void Spawn(string particleId, Vector3 position)`                                    | Shows a particle effect at a position, for the players who see it     |
| `void Spawn(string particleId, Vector3 position, params MolangVariable[] variables)` | Shows a particle effect at a position, starting with Molang variables |
| `void SpawnOn(string particleId, Entity entity)`                                     | Shows a particle effect that follows an entity                        |
| `void SpawnOn(string particleId, Entity entity, params MolangVariable[] variables)`  | The same, starting with Molang variables                              |

`MolangVariable`: A Molang variable a particle effect starts with: its name and its values (1 for a number, 3 for a
vector, 4 for a color).

| Member                                                                                          | What it is                                                |
|-------------------------------------------------------------------------------------------------|-----------------------------------------------------------|
| `static MolangVariable Color(string name, float red, float green, float blue, float alpha = 1)` | A variable that is a color, each component from 0 to 1    |
| `MolangVariable(string name, IReadOnlyList<float> values)`                                      | A new `MolangVariable`                                    |
| `string Name`                                                                                   | The name of the variable                                  |
| `static MolangVariable Number(string name, float value)`                                        | A variable that is a number                               |
| `IReadOnlyList<float> Values`                                                                   | Its values: 1 for a number, 3 for a vector, 4 for a color |
| `static MolangVariable Vector(string name, Vector3 value)`                                      | A variable that is a vector                               |
