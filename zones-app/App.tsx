import React, { Component } from 'react';
import MainScreen from './Screens/Main'

import { AsyncStorage } from 'react-native';
import { Buffer } from "buffer";
//@ts-ignore
window.localStorage = AsyncStorage;
//@ts-ignore
global.Buffer = Buffer;

export default class App extends Component {
  render() {
    return (
      <MainScreen />
    );
  }
}
