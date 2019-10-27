import React, { Component } from 'react'
import { StyleSheet, Dimensions, View, Text } from 'react-native'
import MapView, { Circle } from 'react-native-maps'
import { Audio } from 'expo-av'
import AWS from 'aws-sdk'
import Constants from 'expo-constants'
import Reanimated from 'react-native-reanimated'

import * as geolib from 'geolib'
import * as Location from 'expo-location'
import * as Permissions from 'expo-permissions'
import * as Colyseus from 'colyseus.js'

import Hurting from '../components/hurting'
import CircularProgress from '../components/circularProgress'
import HealthBar from '../components/healthBar'
import { GameState, Coordinate } from '../types'

interface State extends GameState {
  currentPos: Coordinate
  timeLeft: number
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#fff',
    flex: 1,
    justifyContent: 'center'
  }
})

export default class MainScreen extends Component<{}, State> {
  colyseusClient: Colyseus.Client
  pollyClient = new AWS.Polly.Presigner()
  room: Colyseus.Room<GameState>
  mapView = React.createRef<MapView>()
  passedFirstUpdate = false
  countdownPolling: NodeJS.Timeout

  async componentDidMount() {
    this.colyseusClient = new Colyseus.Client(
      Constants.manifest.extra.serverUri
    )
    this.colyseusClient.auth.login({
      email: 'testing@gmail.com',
      password: 'password'
    })

    this.countdownPolling = setInterval(() => {
      if (!this.state || !this.state.zones) return
      const zoneSwitch = new Date(
        this.state.zones[this.state.zones.length - 1].active_time
      )
      const currentTime = new Date()
      this.setState({
        timeLeft: zoneSwitch.getTime() - currentTime.getTime()
      })
    }, 1000)

    // TODO: handle permissions denied
    await Permissions.askAsync(Permissions.LOCATION)

    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced
      },
      location => {
        this.setState({
          currentPos: location.coords
        })

        if (!this.room) {
          this.setupRoom(location.coords)
        } else {
          this.room.send({
            type: 'LOCATION_UPDATE',
            coords: {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude
            }
          })
        }
      }
    )
  }

  setupRoom = async (coords: Coordinate) => {
    this.mapView.current.animateCamera({
      center: coords,
      altitude: 5000,
      zoom: 50
    })

    this.room = await this.colyseusClient.joinOrCreate('zones_room', {
      coords
    })

    this.room.onStateChange(async state => {
      // For some reason, the first update is bugged. This fixes a crash that used to happen on boot. Don't ask me why.
      if (!this.passedFirstUpdate) {
        this.passedFirstUpdate = true
        return
      }

      if (
        (state.zones.length === 1 && (!this.state || !this.state.zones)) ||
        (this.state && state.zones.length !== this.state.zones.length)
      ) {
        const currentView = await this.mapView.current.getCamera()
        const newZone = state.zones[state.zones.length - 1]

        const direction = geolib
          .getCompassDirection(this.state.currentPos, newZone.center)
          .replace('N', 'North ')
          .replace('S', 'South ')
          .replace('W', 'West ')
          .replace('E', 'East ')
          .trimEnd()
        const distance =
          geolib.getPreciseDistance(this.state.currentPos, newZone.center) -
          newZone.radius_meters
        const safe = geolib.isPointWithinRadius(
          this.state.currentPos,
          newZone.center,
          newZone.radius_meters
        )

        const announcement = safe
          ? "New zone is active, and you're already in the next zone. Stay safe!"
          : `New zone is active! Next zone is ${distance} meters away towards the ${direction}. Get to safety!`
        const pollyParams: AWS.Polly.SynthesizeSpeechInput = {
          OutputFormat: 'mp3',
          Text: announcement,
          TextType: 'text',
          VoiceId: 'Joanna'
        }

        this.pollyClient.getSynthesizeSpeechUrl(
          pollyParams,
          async (err, url) => {
            if (err) {
              console.error(err)
            } else {
              const soundObject = new Audio.Sound()
              await soundObject.loadAsync({ uri: url }, { shouldPlay: true })
            }
          }
        )

        this.mapView.current.animateCamera({
          center: newZone.center
        })
        setTimeout(() => this.mapView.current.animateCamera(currentView), 3000)
      }

      this.setState(state)
    })
  }

  render() {
    // Renders what we see on screen
    const currentActiveZone =
      this.state &&
      this.state.zones &&
      this.state.zones.length > 1 &&
      this.state.zones[this.state.zones.length - 2]
    const takingDamage =
      currentActiveZone &&
      !geolib.isPointWithinRadius(
        this.state.currentPos,
        currentActiveZone.center,
        currentActiveZone.radius_meters
      )
    const health =
      (this.state &&
        this.room &&
        this.state.players[this.room.sessionId].health) ||
      100

    const msRemaining = (this.state && this.state.timeLeft) || 0
    const secRemaining = Math.floor((msRemaining / 1000) % 60)
    const minRemaining = Math.floor(msRemaining / 1000 / 60)

    return (
      <View style={styles.container}>
        <Hurting takingDamage={takingDamage} />
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 100,
            paddingTop: 50,
            justifyContent: 'center',
            alignItems: 'center'
          }}>
          <CircularProgress progress={new Reanimated.Value(40)} />
          <Text>
            {' '}
            {minRemaining}:{secRemaining} Till New Zone
          </Text>
        </View>
        <MapView
          style={{
            width: Dimensions.get('window').width,
            height: Dimensions.get('window').height
          }}
          showsUserLocation
          ref={this.mapView}>
          {this.state &&
            this.state.zones &&
            this.state.zones
              .slice(this.state.zones.length - 2)
              .map((zone, i) => {
                const safe = geolib.isPointWithinRadius(
                  this.state.currentPos,
                  zone.center,
                  zone.radius_meters
                )
                const inflictingDamage =
                  i === 0 && this.state.zones.length !== 1

                let color: string
                if (safe) color = '99, 176, 205'
                else if (inflictingDamage) color = '255, 0, 0'
                else color = '255, 255, 0'

                return (
                  <Circle
                    center={zone.center}
                    radius={zone.radius_meters}
                    fillColor={`rgba(${color}, 0.4)`}
                    strokeColor={`rgba(${color}, 1)`}
                    key={zone.active_time}
                  />
                )
              })}
        </MapView>

        <HealthBar health={health} />
      </View>
    )
  }
}
