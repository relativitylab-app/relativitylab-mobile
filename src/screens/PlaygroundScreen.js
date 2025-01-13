import React, { useState, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated 
} from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { 
  Scene,
  PerspectiveCamera,
  BoxGeometry,
  MeshBasicMaterial,
  Mesh,
  Color
} from 'three';
import Slider from '@react-native-community/slider';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';

const PlaygroundScreen = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [dimensions, setDimensions] = useState({
    x: 1,
    y: 1,
    z: 1
  });
  const [velocity, setVelocity] = useState({
    x: 0,
    y: 0,
    z: 0
  });
  
  let timeout;
  let cube;

  const calculateLorentzFactor = (v) => {
    return 1 / Math.sqrt(1 - Math.pow(v, 2));
  };

  const updateCubeDimensions = () => {
    if (cube) {
      const vTotal = Math.sqrt(
        Math.pow(velocity.x, 2) + 
        Math.pow(velocity.y, 2) + 
        Math.pow(velocity.z, 2)
      );
      
      const gamma = calculateLorentzFactor(vTotal);
      
      cube.scale.x = dimensions.x / gamma;
      cube.scale.y = dimensions.y / gamma;
      cube.scale.z = dimensions.z / gamma;
    }
  };

  const onContextCreate = async (gl) => {
    const scene = new Scene();
    scene.background = new Color(0x000000);
    
    const camera = new PerspectiveCamera(
      75,
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );
    
    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);
    
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial({ 
      color: 0x1d4ed8,
      wireframe: true
    });
    cube = new Mesh(geometry, material);
    
    scene.add(cube);
    camera.position.z = 5;
    
    const render = () => {
      timeout = requestAnimationFrame(render);
      
      cube.rotation.x += 0.01;
      cube.rotation.y += 0.01;
      
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
    
    updateCubeDimensions();
  };

  React.useEffect(() => {
    return () => {
      if (timeout) {
        cancelAnimationFrame(timeout);
      }
    };
  }, []);

  React.useEffect(() => {
    updateCubeDimensions();
  }, [dimensions, velocity]);

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
    Animated.timing(slideAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <View style={styles.main}>
        <GLView 
          style={styles.glView}
          onContextCreate={onContextCreate}
        />
        
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={toggleExpand}
        >
          <Text style={styles.toggleButtonText}>
            {isExpanded ? 'Hide Controls' : 'Show Controls'}
          </Text>
        </TouchableOpacity>

        <Animated.View 
          style={[
            styles.controlPanel,
            {
              height: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '60%']
              })
            }
          ]}
        >
          <ScrollView style={styles.controlScroll}>
            <View style={styles.controlSection}>
              <Text style={styles.sectionTitle}>Initial Length</Text>
              {Object.keys(dimensions).map((axis) => (
                <View key={`dim-${axis}`} style={styles.inputRow}>
                  <Text style={styles.inputLabel}>{axis.toUpperCase()}</Text>
                  <TextInput
                    style={styles.input}
                    value={dimensions[axis].toString()}
                    onChangeText={(text) => {
                      const value = parseFloat(text) || 0;
                      setDimensions(prev => ({
                        ...prev,
                        [axis]: value
                      }));
                    }}
                    keyboardType="numeric"
                  />
                </View>
              ))}
            </View>

            <View style={styles.controlSection}>
              <Text style={styles.sectionTitle}>Velocity (c)</Text>
              {Object.keys(velocity).map((axis) => (
                <View key={`vel-${axis}`} style={styles.sliderContainer}>
                  <Text style={styles.inputLabel}>{axis.toUpperCase()}</Text>
                  <Slider
                    style={styles.slider}
                    minimumValue={0}
                    maximumValue={0.99}
                    value={velocity[axis]}
                    onValueChange={(value) => {
                      setVelocity(prev => ({
                        ...prev,
                        [axis]: value
                      }));
                    }}
                    minimumTrackTintColor="#1d4ed8"
                    maximumTrackTintColor="#6b7280"
                    thumbTintColor="#1d4ed8"
                  />
                  <Text style={styles.sliderValue}>
                    {velocity[axis].toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  main: {
    flex: 1,
  },
  glView: {
    ...StyleSheet.absoluteFillObject,
  },
  toggleButton: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: '#1d4ed8',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  toggleButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  controlPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  controlScroll: {
    flex: 1,
  },
  controlSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  inputLabel: {
    color: '#ffffff',
    width: 30,
    marginRight: 8,
  },
  input: {
    backgroundColor: '#374151',
    color: '#ffffff',
    padding: 8,
    borderRadius: 4,
    flex: 1,
  },
  sliderContainer: {
    marginBottom: 16,
  },
  slider: {
    height: 40,
  },
  sliderValue: {
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 4,
  },
});

export default PlaygroundScreen;