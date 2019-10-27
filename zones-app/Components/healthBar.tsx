import React, { FC } from 'react'
import { StyleSheet, Text, View, Animated } from 'react-native'

interface Props {
  health: number
  height?: number
}

const styles = StyleSheet.create({
  rail: {
    borderColor: '#616161',
    borderRadius: 2,
    borderWidth: 2,
    height: 25,
    maxHeight: 100,
    width: 200,
    bottom: 50,
  }
})

const HealthBar: FC<Props> = ({ health, height = 21.5 }) => {
  const currentHealth = new Animated.Value(health)
  const animatedWidth = currentHealth.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [0, 200 / 2, 200 - 3.5]
  })

  const colorAnimation = currentHealth.interpolate({
    inputRange: [0, 30, 100],
    outputRange: ['rgb(199, 45, 50)', 'rgb(224, 150, 39)', 'rgb(101, 203, 25)']
  })

  return (
    <View style={styles.rail}>
      <Animated.View
        style={{
          width: animatedWidth,
          height,
          backgroundColor: colorAnimation
        }}
      />
      <Text style={{ textAlign: 'center' }}>Player Name - {health}%</Text>
    </View>
  )
}

export default HealthBar
