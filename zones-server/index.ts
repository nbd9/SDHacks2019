import http from "http";
import express from "express";
import cors from "cors";
import { Server } from "colyseus";
import socialRoutes from "@colyseus/social/express"

import { ZonesServer } from "./zones_server";

const port = Number(process.env.PORT || 2567);
const app = express()

app.use(cors());
app.use(express.json())

const server = http.createServer(app);
const gameServer = new Server({
  server,
  express: app
});

// register your room handlers
gameServer.define('zones_room', ZonesServer);

// register @colyseus/social routes
app.use("/", socialRoutes);

gameServer.listen(port);
console.log(`Listening on ws://localhost:${ port }`)
