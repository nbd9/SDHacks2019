import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import moment from 'moment'
import * as geolib from 'geolib';

const MAX_FIRST_DISTANCE_METERS = 800;

interface CoordsSerialized {
  lat: number;
  long: number;
}

export class Coordinate extends Schema {
  @type('number')
  lat: number = 0;

  @type('number')
  long: number = 0;
}

export class Player extends Schema {
  @type(Coordinate)
  location = new Coordinate()

  @type("number")
  health = 100;
}

export class Zone extends Schema {
  @type(Coordinate)
  center = new Coordinate();

  @type('number')
  radius_meters = 400;

  @type('string')
  active_time = '';
}

export class State extends Schema {
  @type({ map: Player })
  players = new MapSchema<Player>();

  @type([ Zone ])
  zones = new ArraySchema();

  createPlayer (id: string, location: CoordsSerialized) {
      this.players[id] = new Player();

      let coords = new Coordinate();
      coords.lat = location.lat;
      coords.long = location.long;
      this.players[id].location = coords;
  }

  removePlayer (id: string) {
      delete this.players[id];
  }

  movePlayer (id: string, coords: Coordinate) {
    this.players[id].location.lat = coords.lat;
    this.players[id].location.long = coords.long;
  }
}

export class ZonesServer extends Room<State> {
  maxClients = 2;

  onCreate () {
    console.log('Zones Server Created.')
    this.setState(new State());
  }

  onJoin (client: Client, options: { coords: CoordsSerialized }) {
    this.state.createPlayer(client.sessionId, options.coords);
    if (this.clients.length == 0) {
      this.setupZone(options.coords);
    }
  }

  onMessage (client: Client, message: any) {
    if (message.type == 'LOCATION_UPDATE') {
      this.state.movePlayer(client.sessionId, message.coords);
    }
  }

  onLeave (client: Client, consented: boolean) {
    this.state.removePlayer(client.sessionId);
  }

  onDispose() {
  }

  setupZone(initialPosition: CoordsSerialized) {
    let firstZone = new Zone();

    let center = new Coordinate();
    let newCenter = geolib.computeDestinationPoint(
      {
        latitude: initialPosition.lat,
        longitude: initialPosition.long
      },
      Math.random() * MAX_FIRST_DISTANCE_METERS,
      Math.random() * 360,
    );
    center.lat = newCenter.latitude;
    center.long = newCenter.longitude;
    firstZone.center = center;
    firstZone.active_time = moment().add(2, 'minute').toISOString();
    firstZone.radius_meters = 400;

    this.state.zones.push(firstZone);
  }

}
