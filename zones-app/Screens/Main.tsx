import React, { Component } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import * as Location from 'expo-location';
import * as Permissions from 'expo-permissions';
import MapView, { Circle, LatLng } from 'react-native-maps';
import * as Colyseus from 'colyseus.js'
import Constants from 'expo-constants';
import sleep from '../Util/sleep';

interface Coordinate {
    lat: number;
    long: number;
}

interface Player {
    health: number;
    location: Coordinate;
}

interface Zone {
    center: Coordinate;
    active_time: string;
    radius_meters: number;
}
interface GameState {
    players: {
        [id: string]: Player
    },
    zones: Zone[]
}

interface State extends GameState {
    error: string
}

export default class MainScreen extends Component<{}, State> {
  client: Colyseus.Client;
  room: Colyseus.Room<GameState>;
  mapView = React.createRef<MapView>();

  async componentDidMount() {
    this.client = new Colyseus.Client(Constants.manifest.extra.serverUri);
    this.client.auth.login({
        email: 'testing@gmail.com',
        password: 'password',
    });

    this.room = await this.client.joinOrCreate('zones_room')
    this.room.onStateChange(state => {
        console.log(state)
        this.setState(state)
    })

    let { status } = await Permissions.askAsync(Permissions.LOCATION);
    if (status !== 'granted') {
      this.setState({
        error: 'Permission to access location was denied',
      });
    }

    Location.watchPositionAsync({
        accuracy: Location.Accuracy.Balanced
    }, location => {
        let coords = {
            lat: location.coords.latitude,
            long: location.coords.longitude,
        };
        if (!this.room) {
            this.setupRoom(coords)
        } else {
            this.room.send({
                type: 'LOCATION_UPDATE',
                coords,
            });
        }
    })
  }

  setupRoom = async (coords: Coordinate) => {
    this.mapView.current.animateCamera({
        center: {
            latitude: coords.lat,
            longitude: coords.long,
        },
        altitude: 5000,
    });

    this.room = await this.client.joinOrCreate('zones_room', {
        coords,
    });

    this.room.onStateChange(async state => {
        if (this.state && state.zones.length !== this.state.zones.length) {
            // TODO: Announce new location with Amazon Poly.
            let newZone = state.zones[state.zones.length - 1];
            this.mapView.current.animateCamera({
                center: {
                    latitude: newZone.center.lat,
                    longitude: newZone.center.long,
                },
            });
            await sleep(2000);
            this.mapView.current.animateCamera({
                center: {
                    latitude: this.state.players[this.room.sessionId].location.lat,
                    longitude: this.state.players[this.room.sessionId].location.long,
                },
            });
        }

        this.setState(state);
    });
  }
  
  render() {
    return (
      <View style={styles.container}>
        <MapView 
          style={{
            width: Dimensions.get('window').width,
            height: Dimensions.get('window').height,
          }}
          showsUserLocation
          ref={this.mapView}
        >
            {
                this.state && this.state.zones.length > 0 && (
                    <Circle 
                        center={{
                            latitude: this.state.zones[0].center.lat,
                            longitude: this.state.zones[0].center.long,
                        }}
                        radius={this.state.zones[0].radius_meters}
                    />
                )
            }
        </MapView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
