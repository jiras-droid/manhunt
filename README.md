# Manhunt

A multiplayer manhunt game for phones. One person draws the play area on a map, picks the rules and gets a lobby code. Everyone else joins with the code, the host starts the game, and the seekers hunt the hiders in real life while the app tracks locations, pings, tags and the out-of-bounds limit.

There are two parts:

- `app/` is the phone app (Expo / React Native, works on Android and iPhone).
- `server/` is the small game server every phone connects to (Node.js).

## What's in the game

- **Your player:** username plus an avatar (face, color and an extra like a crown or cap).
- **Main menu:** your camera is the background. If you don't allow the camera, it's plain light blue. Two black buttons at the top: **Create Game** and **Join Lobby**.
- **Create Game:** a map with black streets and white center lines, green parks, gray buildings and blue water. Tap **Draw** and drag your finger around the area you want to play in; the inside gets filled. Settings:
  - Hider location pings: **Live** or a custom time (seconds, with 30s / 1 min / 2 min / 5 min shortcuts)
  - Out of bounds limit (seconds before you lose)
  - Game mode:
    - **Last man standing:** tagged hiders are out. Last hider left wins.
    - **Last man standing (infection):** tagged hiders become seekers. Last hider left wins.
    - **Swap:** when a seeker tags a hider they switch roles, and the new seeker is frozen for a while (default **60 seconds**, adjustable). Whoever is hiding when time runs out wins.
  - Seekers wait (head start), default **3 minutes**
  - Max game time, default **30 minutes** (0 = no limit, except Swap which always needs a timer)
- **Lobby:** big code with **Copy code** and **Share**, everyone's avatar and name, and a **Start** button for the host. Start asks you to confirm, then you either pick the seekers yourself or choose **Random** (about 20–25% of players, at least 1).
- **In game:**
  - Seekers get a full-screen **DON'T MOVE** countdown during the head start.
  - Hiders have a **✋ Tagged** button. It asks if you're sure, and in Infection and Swap you also pick who found you. That seeker gets a notification asking "Did you tag them?" with Yes / No. No makes it disappear; Yes turns the hider into a seeker (or swaps roles).
  - Seekers see hiders on the map at each ping (or live). Hiders get a heads-up when they've just been pinged.
  - Leaving the play area starts a countdown; stay out too long and you're out.
  - The 🚪 button in the top right leaves the room. It asks twice, and you can't rejoin after leaving.
- **Background:** once the game starts, the app keeps sending your location while the phone is locked (Android shows a "Manhunt is running" notification while it does). It asks for camera, location (including "Allow all the time") and notification permissions on first launch.

## Setup on Windows

### 1. Install the tools (once)

1. Install **Node.js LTS** from <https://nodejs.org> (use the Windows installer, keep the default options).
2. Open **PowerShell** and check it worked:
   ```powershell
   node -v
   npm -v
   ```

### 2. Start the game server

```powershell
cd path\to\manhunt\server
npm install
npm start
```

It prints something like `On your Wi-Fi, use: http://192.168.1.20:3000`. If Windows Firewall asks, click **Allow** (tick Private networks).

That address only works for phones on the **same Wi-Fi** as your PC, which is fine for testing at home. Manhunt is played outside on mobile data, so for a real game the server has to be reachable from the internet. Two options:

**Option A: a tunnel from your PC (quickest, free, no account).** Keep `npm start` running, open a second PowerShell window and run:

```powershell
winget install --id Cloudflare.cloudflared
cloudflared tunnel --url http://localhost:3000
```

It prints a `https://something.trycloudflare.com` address. Use that as the server address in the app. Your PC has to stay on during the game, and the address changes every time you restart the tunnel.

**Option B: host it for free on Render (stays up without your PC).** Put this folder in a GitHub repo, go to <https://render.com>, choose **New → Blueprint**, and pick the repo. The included `render.yaml` sets everything up. You get an address like `https://manhunt-server.onrender.com`. Free servers fall asleep when nobody's playing, so the first connection after a break can take about a minute.

### 3. Run the app on your phone

**Quick test with Expo Go (no build needed):**

1. Install **Expo Go** from the Play Store or App Store.
2. In PowerShell:
   ```powershell
   cd path\to\manhunt\app
   npm install
   npx expo start
   ```
3. Scan the QR code with Expo Go (Android) or the Camera app (iPhone). The phone needs to be on the same Wi-Fi as the PC, or run `npx expo start --tunnel` instead.
4. In the app, tap ⚙️ on the main menu and enter the server address from step 2.

Expo Go is perfect for trying everything out, but it **can't track location in the background or receive notifications when the app is closed**. For real games, build the app (below).

**Real install (background location and notifications), Android:**

```powershell
cd path\to\manhunt\app
npm install -g eas-cli
eas login            # free Expo account
eas init             # links the project, enables push notifications
eas build -p android --profile preview
```

When it finishes (it builds in the cloud, around 10–20 min), you get a link to an `.apk`. Open it on each Android phone to install it (allow "Install unknown apps" when asked). Send the same link to your friends.

**iPhone:** building for iPhone needs an Apple Developer account ($99/year). With one, run `eas build -p ios --profile preview` and follow the prompts.

**Tip:** before building, put your server address in `app/app.json` under `"extra": { "serverUrl": "..." }` so nobody has to type it in. Everyone in a game has to use the same server.

## Changing defaults

- Default game settings: `app/src/types.ts` (`DEFAULT_SETTINGS`).
- Random seeker share (20–25%): `server/game.js` (`randomSeekerCount`).
- Map colors: `app/src/map/mapHtml.ts` (`mapStyle`). The map uses free OpenStreetMap data from OpenFreeMap, so there's no API key to set up.

## Tests

```powershell
cd server
npm test
```

These check the game rules: random seeker counts, elimination, infection, swap with freeze, out of bounds, pings, and the no-rejoin rule.
