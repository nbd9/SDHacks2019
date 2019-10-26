import React, { Component } from 'react';
import MapView, { Circle } from 'react-native-maps';
import { StyleSheet, Dimensions, View } from 'react-native';
import { Audio } from 'expo-av';
import AWS from 'aws-sdk'
import Constants from 'expo-constants';
import * as geolib from 'geolib';
import * as Location from 'expo-location';
import * as Permissions from 'expo-permissions';
import * as Colyseus from 'colyseus.js'

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
    };
    zones: Zone[];
}

interface State extends GameState {
    error: string;
}

export default class MainScreen extends Component<{}, State> {
    colyseusClient: Colyseus.Client;
    pollyClient = new AWS.Polly.Presigner();
    room: Colyseus.Room<GameState>;
    mapView = React.createRef<MapView>();
    passedFirstUpdate = false;
    currentPos: Coordinate
    
    async componentDidMount() {
        this.colyseusClient = new Colyseus.Client(Constants.manifest.extra.serverUri);
        this.colyseusClient.auth.login({
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
            this.currentPos = location.coords;

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

        this.room = await this.colyseusClient.joinOrCreate('zones_room', {
            coords,
        });

        this.room.onStateChange(async state => {
            // For some reason, the first update is bugged. This fixes a crash that used to happen on boot. Don't ask me why.
            if (!this.passedFirstUpdate) {
                this.passedFirstUpdate = true;
                return;
            }

            if ((state.zones.length == 1 && !this.state) || (this.state && state.zones.length !== this.state.zones.length)) {
                let currentView = await this.mapView.current.getCamera()
                let newZone = state.zones[state.zones.length - 1];

                let direction = geolib
                    .getCompassDirection(this.currentPos, newZone.center)
                    .replace('N', 'North ')
                    .replace('S', 'South ')
                    .replace('W', 'West ')
                    .replace('E', 'East ')
                    .trimEnd();
                let distance = geolib.getPreciseDistance(this.currentPos, newZone.center) - newZone.radius_meters;
                let safe = geolib.isPointWithinRadius(this.currentPos, newZone.center, newZone.radius_meters);

                let announcement = safe 
                    ? `New zone is active, and you're already in the next zone. Stay safe!`
                    : `New zone is active! Next zone is ${distance} meters away towards the ${direction}. Get to safety!`
                var pollyParams: AWS.Polly.SynthesizeSpeechInput = {
                    OutputFormat: "mp3", 
                    Text: announcement,
                    TextType: "text",
                    VoiceId: "Joanna",
                };

                this.pollyClient.getSynthesizeSpeechUrl(pollyParams, async (err, url) => {
                    if (err) {
                        console.error(err);
                        return;
                    } else {
                        let soundObject = new Audio.Sound();
                        await soundObject.loadAsync(
                            { uri: url },
                            { shouldPlay: true }
                        );
                    }
                })

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
                    this.state && this.state.zones && this.state.zones.map(zone => (
                        <Circle 
                            center={zone.center}
                            radius={zone.radius_meters}
                            key={zone.active_time}
                        />
                    ))
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
