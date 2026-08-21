# Online deployment

## Railway

Repository root should contain:

- `package.json`
- `package-lock.json`
- `railpack.json`
- `server.js`
- `public/`

Build command:

`npm install`

Start command:

`npm start`

The project also contains an explicit Railpack start command in `railpack.json`.

## Render

Create a Web Service.

Build command:

`npm install`

Start command:

`npm start`

Use the generated public URL for GM/player testing.

## Important

Room state is held in server memory in this version. A server restart removes active rooms.
That is acceptable for the current multiplayer prototype. A later production version can use Redis/database storage for persistent rooms.
