import React, { Component } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import * as Location from 'expo-location';
import * as Permissions from 'expo-permissions';
import MapView, { Circle } from 'react-native-maps';
import * as Colyseus from 'colyseus.js'
import Constants from 'expo-constants';

interface Coordinate {
    latitude: number;
    longitude: number;
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
  passedFirstUpdate = false;

  async componentDidMount() {
    this.client = new Colyseus.Client(Constants.manifest.extra.serverUri);
    this.client.auth.login({
        email: 'testing@gmail.com',
        password: 'password',
    });

    let { status } = await Permissions.askAsync(Permissions.LOCATION);
    if (status !== 'granted') {
      this.setState({
        error: 'Permission to access location was denied',
      });
    }

    Location.watchPositionAsync({
        accuracy: Location.Accuracy.Balanced
    }, location => {
        if (!this.room) {
            this.setupRoom(location.coords)
        } else {
            this.room.send({
                type: 'LOCATION_UPDATE',
                coords: {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                },
            });
        }
    })
  }

  setupRoom = async (coords: Coordinate) => {
    this.mapView.current.animateCamera({
        center: coords,
        altitude: 5000,
    });

    this.room = await this.client.joinOrCreate('zones_room', {
        coords,
    });

    this.room.onStateChange(async state => {
        // For some reason, the first update is bugged. This fixes a crash that used to happen on boot. Don't ask me why.
        if (!this.passedFirstUpdate) {
            this.passedFirstUpdate = true;
            return;
        }

        if ((state.zones.length == 1 && !this.state) || (this.state && state.zones.length !== this.state.zones.length)) {
            // TODO: Announce new location with Amazon Poly.
            let currentView = await this.mapView.current.getCamera()
            let newZone = state.zones[state.zones.length - 1];
            this.mapView.current.animateCamera({
                center: newZone.center,
            });
            setTimeout(() => this.mapView.current.animateCamera(currentView), 3000);
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
                this.state && this.state.zones && this.state.zones.length > 0 && (
                    <Circle 
                        center={this.state.zones[this.state.zones.length - 1].center}
                        radius={this.state.zones[this.state.zones.length - 1].radius_meters}
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
