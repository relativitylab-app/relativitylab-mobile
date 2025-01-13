import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { 
  Scene,
  PerspectiveCamera,
  SphereGeometry,
  MeshBasicMaterial,
  Mesh,
  TextureLoader
} from 'three';

const HomeScreen = ({ navigation }) => {
  let timeout;

  const onContextCreate = async (gl) => {
    const scene = new Scene();
    const camera = new PerspectiveCamera(
      75, 
      gl.drawingBufferWidth / gl.drawingBufferHeight,
      0.1,
      1000
    );

    const renderer = new Renderer({ gl });
    renderer.setSize(gl.drawingBufferWidth, gl.drawingBufferHeight);

    const geometry = new SphereGeometry(1, 32, 32);
    const material = new MeshBasicMaterial({ color: 0x1d4ed8 });
    const sphere = new Mesh(geometry, material);
    
    scene.add(sphere);
    camera.position.z = 2;

    const render = () => {
      timeout = requestAnimationFrame(render);
      sphere.rotation.x += 0.01;
      sphere.rotation.y += 0.01;
      renderer.render(scene, camera);
      gl.endFrameEXP();
    };
    render();
  };

  React.useEffect(() => {
    return () => {
      if (timeout) {
        cancelAnimationFrame(timeout);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <GLView style={styles.glView} onContextCreate={onContextCreate} />
      <View style={styles.content}>
        <Text style={styles.title}>RelativityLab</Text>
        <Text style={styles.subtitle}>
          Warp Space, Bend Time.
        </Text>
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('Playground')}
        >
          <Text style={styles.buttonText}>Explore RelativityLab</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  glView: {
    position: 'absolute',
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#ffffff',
    marginBottom: 30,
  },
  button: {
    backgroundColor: '#1d4ed8',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default HomeScreen;