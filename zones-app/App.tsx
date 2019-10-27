import React, { Component } from 'react'
import Constants from 'expo-constants'
import AWS from 'aws-sdk'
import MainScreen from './screens/main'

import { AsyncStorage } from 'react-native'
import { Buffer } from 'buffer'
// @ts-ignore
window.localStorage = AsyncStorage
// @ts-ignore
global.Buffer = Buffer

AWS.config.update({
  region: Constants.manifest.extra.awsRegion,
  // accessKeyId: Constants.manifest.extra.awsAccessKey,
  // secretAccessKey: Constants.manifest.extra.awsSecretKey
})

export default class App extends Component {
  render() {
    return <MainScreen />
  }
}
