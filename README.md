# Battlesnake TypeScript Starter Project

An official Battlesnake template written in TypeScript. Get started at [play.battlesnake.com](https://play.battlesnake.com).

![Battlesnake Logo](https://media.battlesnake.com/social/StarterSnakeGitHubRepos_TypeScript.png)

This project is a great starting point for anyone wanting to program their first Battlesnake in TypeScript. It can be run locally or easily deployed to a cloud provider of your choosing. See the [Battlesnake API Docs](https://docs.battlesnake.com/api) for more detail. 

[![Run on Replit](https://repl.it/badge/github/BattlesnakeOfficial/starter-snake-typescript)](https://replit.com/@Battlesnake/starter-snake-typescript)

## Technologies Used

This project uses [TypeScript](https://www.typescriptlang.org/), [Node.js](https://nodejs.org/en/), and [Express](https://expressjs.com/). It also comes with an optional [Dockerfile](https://docs.docker.com/engine/reference/builder/) to help with deployment.

## Run Your Battlesnake

Install dependencies using npm

```sh
npm install
```

Start your Battlesnake

```sh
npm run start
```

You should see the following output once it is running

```sh
Running Battlesnake at http://0.0.0.0:8000
```

Open [localhost:8000](http://localhost:8000) in your browser and you should see

```json
{"apiversion":"1","author":"","color":"#888888","head":"default","tail":"default"}
```

## Play a Game Locally

Install the [Battlesnake CLI](https://github.com/BattlesnakeOfficial/rules/tree/main/cli):

* **Precompiled (recommended):** [Download the Windows binary](https://github.com/BattlesnakeOfficial/rules/releases) (e.g. `battlesnake_*_Windows_x86_64.tar.gz`), extract it, then **add the folder containing `battlesnake.exe` to your PATH** so the `battlesnake` command works in any terminal.
* **With Go:** `go install github.com/BattlesnakeOfficial/rules/cli/battlesnake@latest` (requires Go 1.18+). Ensure your Go bin directory (e.g. `%USERPROFILE%\go\bin`) is in your PATH.

**If `battlesnake` is not recognized on Windows:** The CLI is not an npm package. After installing, the folder that contains `battlesnake.exe` must be in your system PATH. To add it: **Settings → System → About → Advanced system settings → Environment Variables → Path → Edit → New**, then add the full path to the folder where `battlesnake.exe` lives. Restart your terminal (or VS Code) after changing PATH.

Command to run a local game (with your snake already running via `npm run start`):

```sh
battlesnake play -W 11 -H 11 --name 'TypeScript Starter Project' --url http://localhost:8000 -g solo --browser
```

Or use the project script (still requires the CLI on PATH):

```sh
npm run play
```

## Next Steps

Continue with the [Battlesnake Quickstart Guide](https://docs.battlesnake.com/quickstart) to customize and improve your Battlesnake's behavior.

**Note:** To play games on [play.battlesnake.com](https://play.battlesnake.com) you'll need to deploy your Battlesnake to a live web server OR use a port forwarding tool like [ngrok](https://ngrok.com/) to access your server locally.
