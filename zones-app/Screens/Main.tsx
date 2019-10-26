import React, { Component } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import * as Location from 'expo-location';
import * as Permissions from 'expo-permissions';
import MapView from 'react-native-maps';
import * as Colyseus from 'colyseus.js'
import Constants from 'expo-constants';

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

  async componentDidMount() {
    this.client = new Colyseus.Client(Constants.manifest.extra.serverUri)
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
        this.room.send({
            type: 'LOCATION_UPDATE',
            coords: {
                lat: location.coords.latitude,
                long: location.coords.longitude,
            }
        })
    })
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
        />
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
