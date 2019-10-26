import React, { FC, useState } from 'react';
import { Dimensions, View, Animated } from 'react-native';

interface Props {
    takingDamage: boolean;
}

const Hurting: FC<Props> = ({ takingDamage }) => {
    const [fadeAnim] = useState(new Animated.Value(0))  // Initial value for opacity: 0

    React.useEffect(() => {
        takingDamage && Animated.loop(
            Animated.sequence([
              Animated.timing(fadeAnim, {
                toValue: 0.5,
                duration: 1000,
                delay: 1000
              }),
              Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 1000
              })
            ])
          ).start()
    }, [takingDamage])

    return (
        <Animated.View
            style={{
                backgroundColor: 'rgb(255, 0, 0)',
                width: Dimensions.get('window').width,
                height: Dimensions.get('window').height,
                position: 'absolute',
                opacity: fadeAnim,
                zIndex: 100,
                top: 0,
                left: 0,
            }}
        />    
    )
}

export default Hurting