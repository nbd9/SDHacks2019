import { Room, Client } from "colyseus";
import { Schema, type, MapSchema, ArraySchema } from "@colyseus/schema";
import moment from 'moment'
import * as geolib from 'geolib';

const MAX_FIRST_DISTANCE_METERS = 400;

interface CoordsSerialized {
  latitude: number;
  longitude: number;
}

export class Coordinate extends Schema {
  @type('number')
  latitude: number = 0;

  @type('number')
  longitude: number = 0;
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
  zones = new ArraySchema<Zone>();

  createPlayer (id: string, location: CoordsSerialized) {
      this.players[id] = new Player();
      this.movePlayer(id, location)
  }

  removePlayer (id: string) {
      delete this.players[id];
  }

  movePlayer (id: string, location: CoordsSerialized) {
    let coords = new Coordinate();
    coords.latitude = location.latitude;
    coords.longitude = location.longitude;
    this.players[id].location = coords;
  }
}

export class ZonesServer extends Room<State> {
  onCreate () {
    console.log('Zones Server Created.')
    this.setState(new State());
  }

  onJoin (client: Client, options: { coords: CoordsSerialized, singlePlayer: boolean }) {
    this.state.createPlayer(client.sessionId, options.coords);
    if (this.clients.length == 0 && options.singlePlayer) {
      this.setupZone(options.coords);
    } else if (!options.singlePlayer && this.state.zones.length === 0) {
      let locations = [options.coords];
      for (const player in this.state.players) {
        let coords = this.state.players[player].location
        locations.push(coords);
      }

      let center = geolib.getCenter(locations)
      if (!center) {
        console.error('Cannot compute center!')
        return;
      };
      this.setupZone(center);
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

  setupZone = (initialPosition: CoordsSerialized) => {
    this.generateZone(initialPosition);
    this.clock.setInterval(this.generateZone, 2 * 60 * 1000);
    this.clock.setInterval(this.checkDamage, 5 * 1000);
  }

  checkDamage = () => {
    // No need to check if there's no current zone.
    if (!this.state || this.state.zones.length < 2) return;

    for (let playerId in this.state.players) {
      let currentZone = this.state.zones[this.state.zones.length - 2]
      let player: Player = this.state.players[playerId];
      let isSafe = geolib.isPointWithinRadius(player.location, currentZone.center, currentZone.radius_meters)
      if (!isSafe) {
        if (this.state.players[playerId].health <= 3) {
          this.state.players[playerId] = 0;
        } else {
          this.state.players[playerId].health -= 3;
        }
        console.log(`Player ${playerId} damanged. New health ${this.state.players[playerId].health}.`)
      }
    }
  }

  generateZone = (centerPosition?: CoordsSerialized) => {
    let lastZone: Zone | undefined;
    if (this.state && this.state.zones.length > 0) {
      lastZone = this.state.zones[this.state.zones.length - 1];
    }

    if (!lastZone && !centerPosition) {
      console.error('Need last zone or center position!');
      return;
    }

    let newZone = new Zone();
    let center = new Coordinate();
    let newCenter;
    let newRadius;

    if (centerPosition) {
      newCenter = geolib.computeDestinationPoint(
        centerPosition,
        Math.random() * MAX_FIRST_DISTANCE_METERS,
        Math.random() * 360,
      );
      newRadius = 400;
    } else {
      newCenter = geolib.computeDestinationPoint(
        lastZone!.center,
        Math.random() * (lastZone!.radius_meters / 2),
        Math.random() * 360,
      );
      newRadius = lastZone!.radius_meters / 2
    }

    center.latitude = newCenter.latitude;
    center.longitude = newCenter.longitude;
    newZone.center = center;
    newZone.active_time = moment().add(2, 'minute').toISOString();
    newZone.radius_meters = newRadius;

    this.state.zones.push(newZone);
    return newZone;
  }

}
