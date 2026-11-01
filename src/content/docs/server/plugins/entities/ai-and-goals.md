---
title: "AI and goals"
description: "Orion server plugins: the goals of mobs, writing your own, navigation and controls."
sidebar:
  order: 3
---

A `Mob` decides what to do with goals, as in Minecraft: wander, look at players, attack its target, run away when
hurt. Each goal has a priority, and the mob runs the most important goals it can. A plugin gives mobs the goals of the
game, writes goals of its own, and steers mobs directly through their navigation and controls. The types are in
`Orion.Sdk.Server.Ai` and `Orion.Sdk.Server.Entities`.

## Goals and targets

A mob has two lists of goals:

| List          | Decides                      | Typical goals                              |
|---------------|------------------------------|--------------------------------------------|
| `mob.Goals`   | What it does                 | Wander, look around, follow, attack, panic |
| `mob.Targets` | Whom it hunts (its `Target`) | Whoever hurt it, the nearest player        |

A lower number is a higher priority. A goal starts when the controls it needs (`Move`, `Look`, `Jump`, `Target`) are
free, or held by goals of a lower priority that may be interrupted; two goals that need the same control never run
together.

```csharp
var guard = (Mob)world.Entities.Spawn(EntityIds.Vindicator, new Vector3(0.5f, 64, 0.5f), EntitySpawnMode.Persistent, 0, 0);
guard.Goals.Clear();                                                        // forget the goals of the game
guard.Goals.Add(1, GoalFactory.MeleeAttack(guard, speed: 1.2f, interval: 20));
guard.Goals.Add(2, GoalFactory.StrollAround(guard, guard.Position, radius: 8, speed: 0.8f, interval: 100));
guard.Goals.Add(3, GoalFactory.LookAt(guard, range: 8, chance: 0.05f, kind: EntityIds.Player));
guard.Targets.Add(1, GoalFactory.HurtByTarget(guard, range: 16));
guard.Targets.Add(2, GoalFactory.NearestTarget(guard, range: 16, kind: EntityIds.Player, mustSee: true));
```

| `GoalFactory`                                             | The mob                                                           |
|-----------------------------------------------------------|-------------------------------------------------------------------|
| `Wander(mob, speed, interval)`                            | Walks to random places now and then                               |
| `StrollAround(mob, center, radius, speed, interval)`      | Walks to random places around a center                            |
| `MoveTo(mob, position, speed, range)`                     | Walks to a position and stays there                               |
| `Follow(mob, entity, speed, minDistance, maxDistance)`    | Follows an entity between two distances                           |
| `LookAt(mob, range, chance, kind?)`                       | Looks at entities of a kind that come near, now and then          |
| `RandomLookAround(mob)`                                   | Looks around at random                                            |
| `MeleeAttack(mob, speed, interval)`                       | Chases its target and hits it                                     |
| `RangedAttack(mob, projectileId, speed, interval, range)` | Shoots its target from a distance                                 |
| `Panic(mob, speed)`                                       | Runs away when hurt                                               |
| `Avoid(mob, distance, speed, nearSpeed, kind?)`           | Keeps away from entities of a kind                                |
| `NearestTarget(mob, range, kind?, mustSee)`               | Targets the nearest living entity of a kind (a goal of `Targets`) |
| `HurtByTarget(mob, range)`                                | Targets what hurt it (a goal of `Targets`)                        |

A `kind` is an entity identifier (`EntityIds.Player`), or `null` for any. `Goals.Remove(goal)`, `Goals.Clear()`,
`Goals.IsRunning(goal)` and `Goals.Count` manage the list. Goals belong to the mob: give them where it comes into the
world (after `Spawn`, in `EntitySpawnedEvent`, or in the `OnSpawn` of a mob of your own:
[Custom content](../../platform/custom-content/)).

## Goals of your own

A goal of the plugin is a class derived from `MobGoal`. Orion asks it whether it can start, starts it, ticks it while
it can go on and finishes it, competing with the other goals of the mob by priority and by the controls it declares:

```csharp
using Orion.Sdk.Server.Ai;
using Orion.Sdk.Server.Entities;
using Orion.Sdk.Server.Math;

namespace Arena;

// A guard that goes back to its post when it wanders more than four blocks away.
public sealed class ReturnToPostGoal(Mob guard, Vector3 post) : MobGoal(GoalControls.Move)
{
    public override bool CanStart() => Distance(guard.Position, post) > 4;

    public override bool CanContinue() => !guard.Navigation.HasReached && Distance(guard.Position, post) > 1;

    public override void Start() => guard.Navigation.MoveTo(post, speed: 1, range: 1);

    public override void Finish() => guard.Navigation.Stop();

    private static float Distance(Vector3 a, Vector3 b) => MathF.Sqrt(((a.X - b.X) * (a.X - b.X)) + ((a.Z - b.Z) * (a.Z - b.Z)));
}
```

```csharp
var guard = (Mob)world.Entities.Spawn(EntityIds.IronGolem, new Vector3(10.5f, 64, 10.5f), EntitySpawnMode.Persistent, 0, 0);
Goal returning = guard.Goals.Add(1, new ReturnToPostGoal(guard, guard.Position));
guard.Goals.Add(2, GoalFactory.RandomLookAround(guard));
```

| Member of `MobGoal` | Called                                                                            | Default                |
|---------------------|-----------------------------------------------------------------------------------|------------------------|
| `CanStart()`        | While the goal does not run: may it start now?                                    | Abstract: you write it |
| `CanContinue()`     | Each tick while it runs: does it go on?                                           | `CanStart()`           |
| `Start()`           | When it starts                                                                    | Nothing                |
| `Tick()`            | Each tick while it runs                                                           | Nothing                |
| `Finish()`          | When it stops: it could not go on, or a goal of higher priority took its controls | Nothing                |
| `IsInterruptible`   | May a goal of higher priority stop it?                                            | `true`                 |
| `Controls`          | What it steers, given to the constructor                                          | —                      |
| `Goal`              | The goal in Orion once added, to remove it (`mob.Goals.Remove(goal)`)             | —                      |

The methods run on the thread of the world of the mob. A goal that throws is reported once as a fault of the plugin and
stops for good. A `MobGoal` object belongs to one mob: make one per mob.

### Goals from lambdas

There is no lambda overload of `Goals.Add`: Orion calls a goal at several steps, which a class says best. When goals
are small, a class that takes delegates gives you the lambda style:

```csharp
using Orion.Sdk.Server.Ai;

namespace Arena;

public sealed class LambdaGoal(GoalControls controls, Func<bool> canStart, Action tick) : MobGoal(controls)
{
    public override bool CanStart() => canStart();

    public override void Tick() => tick();
}
```

```csharp
mob.Goals.Add(1, new LambdaGoal(GoalControls.Look, () => mob.Target is not null, () => mob.LookControl.LookAtEntity(mob.Target!)));
```

## Steer a mob directly

Outside goals, a plugin moves a mob with its navigation and controls; the goals that run may change them again on the
next tick, so clear its goals (or set `HasAi = false` for a mob that only does what you say) when you steer it yourself.

```csharp
mob.Navigation.MoveTo(new Vector3(20, 64, 20), speed: 1.2f, range: 1);   // along a path around blocks
mob.Navigation.Follow(player, speed: 1, range: 2);
mob.LookControl.LookAt(player.EyePosition);
mob.MoveControl.WalkTo(new Vector3(5, 64, 5), 1);                        // straight, no path
mob.JumpControl.Jump();
mob.Target = player;                                                     // no event; SetTarget raises MobTargetEvent
bool hit = mob.Attack(player);                                           // a hit in mêlée now
```

| Member                          | What it is                                                                                                                  |
|---------------------------------|-----------------------------------------------------------------------------------------------------------------------------|
| `Navigation`                    | Walks along a path around blocks: `MoveTo`, `Follow`, `Stop`, `IsMoving`, `HasReached`, `Destination`, `Following`, `Speed` |
| `MoveControl`                   | Walks straight to a point (`WalkTo`) or strafes for one tick (`Strafe`); `Stop`                                             |
| `LookControl`                   | Turns the head to a point or an entity, as fast as the game turns heads                                                     |
| `JumpControl`                   | Jumps on the next tick it stands on the ground                                                                              |
| `HasAi`                         | Off, the mob thinks no more: goals stop, it walks nowhere (it still falls and can be pushed)                                |
| `ActivationRange`               | How near a player must be for the mob to think; 0 to always think                                                           |
| `MovementSpeed`, `AttackDamage` | Its walking speed (at speed 1) and the damage of its bare hand                                                              |
| `Equipment`                     | What it holds and wears: `MainHand`, `OffHand`, `Head`, `Chest`, `Legs`, `Feet`, `Clear()`                                  |

`MobTargetEvent` comes before a mob changes its target (`Cause`: `Plugin`, `Closest`, `Retaliate`, `Forgotten`;
writable `Target`, cancelable): keep a pet from attacking its owner there.

## Reference

`Mob`: A mob of the game: a zombie, a villager, an iron golem.

| Member                                 | What it is                                                                                                                                                                            |
|----------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `float ActivationRange`                | How near a player must be for it to think, in blocks; 0 to always think; settable                                                                                                     |
| `bool Attack(LivingEntity target)`     | Hits a living entity in mêlée with its AttackDamage and what it holds, enchantments included, swinging its arm; the target gets the delay between hits and the knockback of its world |
| `float AttackDamage`                   | The damage to its hits with an empty hand, in half hearts; a weapon in its hand adds its own; settable                                                                                |
| `EntityEquipment Equipment`            | What it holds and wears                                                                                                                                                               |
| `GoalSelector Goals`                   | What it does, by priority: wander, look at players, attack                                                                                                                            |
| `bool HasAi`                           | Whether it thinks: off, its goals stop, it walks nowhere and its head stays still (it still falls and can be pushed); settable                                                        |
| `MobJumpControl JumpControl`           | When it jumps                                                                                                                                                                         |
| `MobLookControl LookControl`           | Where it looks                                                                                                                                                                        |
| `MobMoveControl MoveControl`           | How it walks                                                                                                                                                                          |
| `float MovementSpeed`                  | Its movement speed: what it walks with at speed 1; settable                                                                                                                           |
| `MobNavigation Navigation`             | What takes it somewhere along a path                                                                                                                                                  |
| `bool SetTarget(LivingEntity? target)` | Gives the mob a target, or none, if `MobTargetEvent` lets it                                                                                                                          |
| `LivingEntity? Target`                 | The entity it hunts, or `null`; setting it raises no event (`SetTarget` does); settable                                                                                               |
| `GoalSelector Targets`                 | How it picks whom to hunt, by priority: who hurt it, the nearest player                                                                                                               |

`MobGoal`: A goal the plugin writes for mobs: add it with `mob.Goals.Add(priority, goal)`. Orion asks it whether it can
start, starts it, ticks it while it can continue and finishes it, on the thread of the world of the mob, competing with
the other goals by priority and by what they control. A goal that throws is reported once as a fault of the plugin and
stops for good.

| Member                                     | What it is                                                               |
|--------------------------------------------|--------------------------------------------------------------------------|
| `virtual bool CanContinue()`               | Tells whether the running goal goes on; by default, while it could start |
| `abstract bool CanStart()`                 | Tells whether the goal can start now                                     |
| `GoalControls Controls`                    | What the goal controls                                                   |
| `virtual void Finish()`                    | The goal stops                                                           |
| `Goal? Goal`                               | The goal in Orion, once it was added to a mob; to remove it              |
| `virtual bool IsInterruptible`             | Whether a goal of a higher priority may stop this one                    |
| `protected MobGoal(GoalControls controls)` | A new `MobGoal`                                                          |
| `virtual void Start()`                     | The goal starts                                                          |
| `virtual void Tick()`                      | A tick of the running goal                                               |

`GoalSelector`: The goals of a mob by priority, chosen as Minecraft chooses them: the lowest number goes first; a goal
starts when the controls it needs are free, or held by interruptible goals of a higher number, which stop; a running
goal stops when it cannot continue.

| Member                                 | What it is                                                                      |
|----------------------------------------|---------------------------------------------------------------------------------|
| `void Add(int priority, Goal goal)`    | Adds a goal; goals of the same priority keep the order they were added in       |
| `Goal Add(int priority, MobGoal goal)` | Adds a goal of the plugin: Orion calls it on the thread of the world of the mob |
| `void Clear()`                         | Removes every goal, stopping those that run                                     |
| `int Count`                            | The number of goals                                                             |
| `bool IsRunning(Goal goal)`            | Tells whether a goal runs now                                                   |
| `bool Remove(Goal goal)`               | Removes a goal, stopping it when it runs                                        |
| `bool Remove(MobGoal goal)`            | Removes a goal of the plugin                                                    |

`Goal`: Something a mob wants, as the goals of Minecraft: `CanStart` says when it begins (`Start`), `Tick` runs it every
tick until `CanContinue` is false (`Finish`), and `Controls` says what it steers.

| Member                  | What it is                                                                          |
|-------------------------|-------------------------------------------------------------------------------------|
| `GoalControls Controls` | What it steers while it runs                                                        |
| `bool IsInterruptible`  | Whether a goal of higher priority (a lower number) may stop it to take its controls |

`GoalFactory`: The goals of the game for plugins: each one for a mob, to add to its goals or targets.

| Member                                                                                           | What it is                                                      |
|--------------------------------------------------------------------------------------------------|-----------------------------------------------------------------|
| `static Goal Avoid(Mob mob, float distance, float speed, float nearSpeed, string? kind)`         | Keeps away from entities of a kind                              |
| `static Goal Follow(Mob mob, Entity entity, float speed, float minDistance, float maxDistance)`  | Follows an entity, between two distances                        |
| `static Goal HurtByTarget(Mob mob, float range)`                                                 | Targets what hurt it (a goal of Targets)                        |
| `static Goal LookAt(Mob mob, float range, float chance, string? kind)`                           | Looks at entities of a kind that come near, now and then        |
| `static Goal MeleeAttack(Mob mob, float speed, int interval)`                                    | Chases its target and hits it                                   |
| `static Goal MoveTo(Mob mob, Vector3 position, float speed, float range)`                        | Walks to a position and stays there                             |
| `static Goal NearestTarget(Mob mob, float range, string? kind, bool mustSee)`                    | Targets the nearest living entity of a kind (a goal of Targets) |
| `static Goal Panic(Mob mob, float speed)`                                                        | Runs away when hurt                                             |
| `static Goal RandomLookAround(Mob mob)`                                                          | Looks around at random                                          |
| `static Goal RangedAttack(Mob mob, string projectileId, float speed, int interval, float range)` | Shoots its target from a distance                               |
| `static Goal StrollAround(Mob mob, Vector3 center, float radius, float speed, int interval)`     | Walks to random places around a center                          |
| `static Goal Wander(Mob mob, float speed, int interval)`                                         | Walks to random places now and then                             |

`GoalControls`: What a Goal steers while it runs: two goals that steer the same thing never run together.

| Member       | What it is                              |
|--------------|-----------------------------------------|
| `None = 0`   | Nothing: the goal runs beside any other |
| `Move = 1`   | Where the mob walks                     |
| `Look = 2`   | Where the mob looks                     |
| `Jump = 4`   | When the mob jumps                      |
| `Target = 8` | Which entity the mob is after (Target)  |

`MobNavigation`: Takes a mob somewhere along a path around blocks: to a point, or after an entity that moves, finding
the path again as it goes.

| Member                                                    | What it is                                                                                                   |
|-----------------------------------------------------------|--------------------------------------------------------------------------------------------------------------|
| `Vector3 Destination`                                     | Where it goes: the point, or where the entity it follows was when the path was found                         |
| `void Follow(Entity entity, float speed, float range)`    | Walks after an entity, finding the path again when it moves away from the end of the path                    |
| `Entity? Following`                                       | The entity it follows, or null                                                                               |
| `bool HasReached`                                         | Whether the last path ended where it was going                                                               |
| `bool IsMoving`                                           | Whether it walks a path, or waits to find one                                                                |
| `void MoveTo(Vector3 position, float speed, float range)` | Walks to a point                                                                                             |
| `float Speed`                                             | The speed it walks with, as a multiple of the movement speed of the mob: a goal hurries on the way; settable |
| `void Stop()`                                             | Stops walking                                                                                                |

`MobLookControl`: Where a mob looks: its head turns towards a point a little each tick, as the game turns heads (10
degrees of yaw and 40 of pitch per tick by default), and goes back to the front once nothing asks it to look.

| Member                             | What it is                                                              |
|------------------------------------|-------------------------------------------------------------------------|
| `bool IsLooking`                   | Whether something asked the mob to look at a point in the last ticks    |
| `void LookAt(Vector3 point)`       | Turns the head towards a point, as fast as the game turns heads         |
| `void LookAtEntity(Entity entity)` | Turns the head of the mob toward an entity, following it while it moves |
| `Vector3 Point`                    | The point it looks at, when IsLooking                                   |

`MobMoveControl`: How a mob walks: straight to a point (`WalkTo`) or with a move of its own for one tick (`Strafe`).

| Member                                                    | What it is                                                                                               |
|-----------------------------------------------------------|----------------------------------------------------------------------------------------------------------|
| `bool IsWalking`                                          | Whether it walks somewhere                                                                               |
| `Vector3 Point`                                           | The point it walks to straight, when it walks so                                                         |
| `float Speed`                                             | The speed it walks with, as a multiple of the movement speed of the mob                                  |
| `void Stop()`                                             | Stands still                                                                                             |
| `void Strafe(float forward, float sideways, float speed)` | Moves for this tick forwards or backwards and to a side, facing where the body faces (circling a target) |
| `void WalkTo(Vector3 point, float speed)`                 | Walks straight to a point, turning the body towards it, until it gets there or something else moves it   |

`MobJumpControl`: When a mob jumps: Jump makes it jump on the next tick it stands on the ground.

| Member           | What it is                                              |
|------------------|---------------------------------------------------------|
| `bool IsJumping` | Whether it jumps on the next tick                       |
| `void Jump()`    | Jumps on the next tick, if it stands on the ground then |

`EntityEquipment`: What a mob holds and wears, as the players who see it; its armor protects it.

| Member               | What it is                                |
|----------------------|-------------------------------------------|
| `ItemStack Chest`    | What it wears on its chest; settable      |
| `void Clear()`       | Takes everything off                      |
| `ItemStack Feet`     | What it wears on its feet; settable       |
| `ItemStack Head`     | What it wears on its head; settable       |
| `ItemStack Legs`     | What it wears on its legs; settable       |
| `ItemStack MainHand` | What it holds in its main hand; settable  |
| `ItemStack OffHand`  | What it holds in its other hand; settable |

`MobTargetCause` (the `Cause` of `MobTargetEvent`): Why a mob changes its target.

| Member          | What it is                                                                                   |
|-----------------|----------------------------------------------------------------------------------------------|
| `Plugin = 0`    | Code chose it with `SetTarget`                                                               |
| `Closest = 1`   | It is the nearest entity the mob hunts (`GoalFactory.NearestTarget`)                         |
| `Retaliate = 2` | It hurt the mob (`GoalFactory.HurtByTarget`)                                                 |
| `Forgotten = 3` | The target died, left, or can no longer be hunted (a player in creative): the mob forgets it |
