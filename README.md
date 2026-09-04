# Evo Foldes

A browser arcade game about collecting files, meshes, and blockmodels and organising them in the Evo Folder.

## Mission

Collect files and objects, carry them back to the Evo Folder, and organise the data to progress.

## Play locally

From this folder, run:

```sh
python3 -m http.server 8091
```

Then open http://localhost:8091.

## Controls

- Arrow keys or A/D: move
- Space, W, or Arrow Up: jump
- Tap Space while airborne to rise or stay up; stop tapping to descend
- Double-click the game: high jump
- P: pause

## Level route

Every five delivered items advances the level and automatically moves through this route:

1. New Zealand: rocks, volcanoes, and All Blacks-style rugby players
2. Australia: rocks and larger kangaroos
3. Canada: different-sized maple trees and Canadian flags
4. South Africa: Big Five animals, giraffes, and Springbok-style rugby players

After South Africa, the route loops back to New Zealand. After the first full round, hazards, items, birds, and boss attacks become harder.

## Folder progression

- The HUD shows carried data points and the current folder requirement.
- Level 1 requires 20 points before the folder opens.
- Each level increases the requirement by 5 points.
- At the target, the folder opens with a golden glow and accepts the carried data.

## Game feedback

- Higher airborne objects are worth more points.
- The geologist character carries collected objects in a visible Evo Folder.
- Losing the final life plays a death sound, then sends the character upward before the game-over screen.
- A retro arcade background melody plays during the run and continues across level transitions.

## Publish to GitHub later

1. Create an empty repository on GitHub named `evo-folders`.
2. Copy the repository URL.
3. Run:

```sh
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git branch -M main
git push -u origin main
```
