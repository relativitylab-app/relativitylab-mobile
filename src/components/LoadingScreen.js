import React from 'react';
import { View, StyleSheet, ActivityIndicator, Text } from 'react-native';
import { GLView } from 'expo-gl';
import { Renderer } from 'expo-three';
import { Scene, PerspectiveCamera, SphereGeometry, MeshBasicMaterial, Mesh } from 'three';

const LoadingScreen = ({ message = 'Loading...' }) => {
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
        <ActivityIndicator size="large" color="#1d4ed8" />
        <Text style={styles.text}>{message}</Text>
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
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  text: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default LoadingScreen;