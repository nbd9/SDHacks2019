import React, { Component } from 'react';
import { StyleSheet, Dimensions, View, Animated, Text } from 'react-native';
import MapView, { Circle } from 'react-native-maps';
import { Audio } from 'expo-av';
import AWS from 'aws-sdk'
import Constants from 'expo-constants';
import * as geolib from 'geolib';
import * as Location from 'expo-location';
import * as Permissions from 'expo-permissions';
import * as Colyseus from 'colyseus.js'
import Hurting from '../Components/hurting';

const available_width = 200; // Constant for width of the health bar

interface Coordinate { // Each coordinate has an 'x' and 'y'
    latitude: number;
    longitude: number;
}

interface Player { // Each player has HP and a coordinate
    health: number;
    location: Coordinate;
}

interface Zone { 
    center: Coordinate; // Coordinate for center of zone
    active_time: string; // How long the zone will be active before disappearing
    radius_meters: number; // Radius of the circular zone
}
interface GameState { // Multiplayer game state
    players: { // List of players categorized by their id
        [id: string]: Player
    };
    zones: Zone[]; // List of zones
}

interface State extends GameState {
    currentPos: Coordinate;
}


export default class MainScreen extends Component<{}, State> {
    colyseusClient: Colyseus.Client;
    pollyClient = new AWS.Polly.Presigner();
    room: Colyseus.Room<GameState>;
    mapView = React.createRef<MapView>();
    passedFirstUpdate = false;
    
    async componentDidMount() {
        this.colyseusClient = new Colyseus.Client(Constants.manifest.extra.serverUri);
        this.colyseusClient.auth.login({
            email: 'testing@gmail.com',
            password: 'password',
        });

        // TODO: handle permissions denied
        await Permissions.askAsync(Permissions.LOCATION);

        Location.watchPositionAsync({
            accuracy: Location.Accuracy.Balanced
        }, location => {
            this.setState({
                currentPos: location.coords,
            });

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
            zoom: 50,
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

            if ((state.zones.length == 1 && (!this.state || !this.state.zones)) || (this.state && (state.zones.length !== this.state.zones.length))) {
                let currentView = await this.mapView.current.getCamera()
                let newZone = state.zones[state.zones.length - 1];

                let direction = geolib
                    .getCompassDirection(this.state.currentPos, newZone.center)
                    .replace('N', 'North ')
                    .replace('S', 'South ')
                    .replace('W', 'West ')
                    .replace('E', 'East ')
                    .trimEnd();
                let distance = geolib.getPreciseDistance(this.state.currentPos, newZone.center) - newZone.radius_meters;
                let safe = geolib.isPointWithinRadius(this.state.currentPos, newZone.center, newZone.radius_meters);

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
    
    render() { // Renders what we see on screen
        let currentActiveZone = 
            this.state 
            && this.state.zones
            && this.state.zones.length > 1 
            && this.state.zones[this.state.zones.length - 2]
        let takingDamage = 
            currentActiveZone
            && !geolib.isPointWithinRadius(this.state.currentPos, currentActiveZone.center, currentActiveZone.radius_meters)

        // HEALTH CALCULATIONS - gets health of current player
        let health = (this.state && this.state.players[this.room.sessionId].health) || 100
        //let health = 50; //this.state.players[this.room.sessionId].health // static health value for testing
        let currentHealth = new Animated.Value(health); // Converts health to an animated value
        var animated_width = currentHealth.interpolate({ // Interpolates health value so it can be animated
            inputRange: [0, 50, 100],
            outputRange: [0, available_width / 2, available_width-3.5] // Affects width of displayed value
        })

        const color_animation = currentHealth.interpolate({ // Color of animation based on health: goes from green-orange-red
            inputRange: [0, 30, 100],
            outputRange: [
              "rgb(199, 45, 50)",
              "rgb(224, 150, 39)",
              "rgb(101, 203, 25)"
            ]
          });

        const h = 21.5; // this is the height of the color inside the healthbar
        // the actual dimensions of the healthbar are in the style for rail

        return ( // This is where we display our modules
        <View style={styles.container}>
            <Hurting takingDamage={takingDamage} />

            <MapView 
                style={{
                    width: Dimensions.get('window').width,
                    height: Dimensions.get('window').height,
                }}
                showsUserLocation = {true}
                //showsMyLocationButton = {true}
                followsUserLocation = {true}
                //region = {this.state.players[this.room.sessionId].location} // test for getting current 
                ref={this.mapView}
            >
                { // draws the zones
                    this.state && this.state.zones && this.state.zones.slice(this.state.zones.length - 2).map((zone, i) => {
                        // true if player is inside the safe zone
                        let safe = geolib.isPointWithinRadius(this.state.currentPos, zone.center, zone.radius_meters);
                        let inflictingDamage = i === 0 && this.state.zones.length !== 1;

                        let color: string;
                        if (safe)                   color = '99, 176, 205'
                        else if (inflictingDamage)  color = '255, 0, 0'
                        else                        color = '255, 255, 0'

                        return (
                            <Circle
                                center={zone.center}
                                radius={zone.radius_meters}
                                fillColor={`rgba(${color}, 0.4)`}
                                strokeColor={`rgba(${color}, 1)`}
                                key={zone.active_time}
                            />
                        )
                    })
                }
            </MapView>

            {/* HEALTH BAR DISPLAY */}
            <View style={styles.rail}> 
                <Animated.View style={{ // Draws the inside of the health bar - rail draws the outline
                    width: animated_width,
                    height:h,
                    backgroundColor: color_animation
                }} />
                <Text style={{ textAlign: 'center' }}>Player Name - {health}%</Text>
                {/* The code above writes the text under the health bar */}
            </View>

            {/* ADD MORE MODULES HERE */}

        </View>
        );
    }
}

// Collection of styles so we can customize where things appear on the screen
const styles = StyleSheet.create({
  container: { // The main container for the entire screen
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rail: { // Used for the health bar display
    height: 25,
    width: 200,
    maxHeight: 100,
    borderWidth: 2,
    borderRadius: 2,
    position: 'absolute',
    borderColor: "#616161", // this is the color of the box outline
    bottom: 40,
  },
});
