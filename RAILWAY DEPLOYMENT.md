# Railway

The GitHub repository root must contain:

- package.json
- package-lock.json
- railpack.json
- Procfile
- server.js
- public/

Railway should deploy the repository root.

Start command:
    node server.js

Build/install:
    npm install

If Railway says "No start command detected", check:
1. The GitHub repository root contains package.json.
2. Railway Root Directory is blank / `/`.
3. There is no extra nested project folder.

Do not upload the ZIP itself as the app.
Do not commit node_modules.
