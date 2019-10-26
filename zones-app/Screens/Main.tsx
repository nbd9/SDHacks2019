import React, { Component } from 'react';
import { StyleSheet, Dimensions, View } from 'react-native';
import MapView from 'react-native-maps';
import * as Colyseus from 'colyseus.js'
import Constants from 'expo-constants';

export default class MainScreen extends Component {
  client: Colyseus.Client;
  room: Colyseus.Room;

  async componentDidMount() {
    this.client = new Colyseus.Client(Constants.manifest.extra.serverUri)
    this.client.auth.login({
        email: 'testing@gmail.com',
        password: 'password',
    });

    try {
        this.room = await this.client.joinOrCreate('my_room', {})
    } catch (e) {
        console.error(e)
        return
    }

    console.log(this.room.id)
    this.room.onStateChange((state) => {
        console.log(this.room.name, "has new state:", state);
    });
    this.room.onMessage((message) => {
        console.log("received on", this.room.name, message);
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
