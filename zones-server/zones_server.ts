import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";

export class Coordinate extends Schema {
  @type('number')
  x: number = 0;

  @type('number')
  y: number = 0;
}

export class Player extends Schema {
  @type(Coordinate)
  location = new Coordinate()

  @type("number")
  health = 100;
}

export class Zone extends Schema {
  @type(Coordinate)
  center = new Coordinate()

  @type('string')
  active_time = ''
}

export class State extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  @type([ Zone ])
  zones = new ArraySchema();

  createPlayer (id: string) {
      this.players[id] = new Player();
  }

  removePlayer (id: string) {
      delete this.players[id];
  }

  movePlayer (id: string, x: number, y: number) {
    if (x && y) {
      this.players[id].x = x;
      this.players[id].y = y;
    }
  }
}

export class ZonesServer extends Room<State> {
  maxClients = 1;

  onCreate (options: any) {
    console.log('Zones Server Created.')
    this.setState(new State());
  }

  onJoin (client: Client, options: any) {
    this.state.createPlayer(client.sessionId);
  }

  onMessage (client: Client, message: any) {
    if (message.type == 'LOCATION_UPDATE') {
      this.state.movePlayer(client.sessionId, message.x, message.y);
    }
  }

  onLeave (client: Client, consented: boolean) {
    this.state.removePlayer(client.sessionId);
  }

  onDispose() {
  }

}
