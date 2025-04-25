import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, Image, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { AVPlaybackStatus } from 'expo-av';
// TODO: Use environment variables for different environments
const BACKEND_URL = 'https://8f56-34-143-143-231.ngrok-free.app'; // Replace with your backend URL

interface MediaFile {
  uri: string;
  name: string;
  type: string;
}

interface AnalysisResponse {
  text?: string;
  session_id?: string;
  error?: string;
}

const CaptureScreen: React.FC = () => {
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    // Request camera permissions on component mount
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
    
    // Cleanup resources when component unmounts
    return () => {
      if (videoRef.current) {
        videoRef.current.unloadAsync();
      }
    };
  }, []);

  const handleVideoStatusUpdate = (status: AVPlaybackStatus) => {
    if (status.isLoaded) {
      setIsPlaying(status.isPlaying);
    }
  };

  const captureMedia = async () => {
    // Don't proceed if we're still checking permissions or don't have them
    if (hasPermission === null) {
      return; // Still loading permissions
    }
    
    if (hasPermission === false) {
      Alert.alert('Permission Denied', 'Camera access is required.');
      return;
    }

    try {
      const response = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.8,
        allowsEditing: true,
      });

      if (!response.canceled && response.assets && response.assets.length > 0) {
        const asset = response.assets[0];    
        
        setMediaUri(asset.uri);
        setMediaType(asset.type || null);

        const mediaFile: MediaFile = {
          uri: asset.uri,
          name: asset.fileName ?? `media_${Date.now()}.${asset.uri.split('.').pop()}`,
          type: asset.type ?? 'application/octet-stream',
        };
        
        await uploadToBackend(mediaFile);
      }
    } catch (error) {
      console.error('Camera Error:', error);
      Alert.alert('Error', 'Failed to capture media');
    }
  };

  const uploadToBackend = async (file: MediaFile) => {
    setLoading(true);
    setResult(null);
    
    try {
      console.log("Uploading file:", file);
      
      // Create form data properly for React Native
      const formData = new FormData();
      formData.append('prompt', 'Please analyze this media.');
      
      // Correctly format the file object for FormData
      const fileExt = file.uri.split('.').pop()?.toLowerCase();
      const fileType = file.type || (
        fileExt === 'jpg' || fileExt === 'jpeg' ? 'image/jpeg' :
        fileExt === 'png' ? 'image/png' :
        fileExt === 'mp4' ? 'video/mp4' :
        fileExt === 'mov' ? 'video/quicktime' :
        'application/octet-stream'
      );
      
      formData.append('media_file', {
        uri: file.uri,
        name: file.name,
        type: fileType,
      } as any);
  
      console.log("FormData file type:", fileType);
      
      const response = await fetch(`${BACKEND_URL}/analyze-media`, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
          // Don't set Content-Type header, React Native will set it with boundary
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server response:", errorText);
        try {
          // Try to parse as JSON first
          const errorData = JSON.parse(errorText);
          Alert.alert('Error', errorData.error || 'Analysis failed.');
        } catch {
          // If not JSON, use the raw text
          Alert.alert('Error', `Server error: ${response.status} ${response.statusText}`);
        }
        return;
      }
  
      try {
        const data: AnalysisResponse = await response.json();
        setResult(data.text || 'No result text.');
        if (data.session_id) setSessionId(data.session_id);
      } catch (error) {
        console.error('JSON parsing error:', error);
        Alert.alert('Error', 'Failed to parse server response');
      }
    } catch (error) {
      console.error('Upload Error:', error);
      Alert.alert('Error', 'Failed to upload and analyze media');
    } finally {
      setLoading(false);
    }
  };

  const isVideo = mediaType ? mediaType.startsWith('video') :
               mediaUri ? /\.(mp4|mov|avi)$/i.test(mediaUri) : false;


  return (
    <View style={styles.container}>
      <Button title="Capture Media" onPress={captureMedia} disabled={loading} />

      {mediaUri && (
        <View style={styles.mediaContainer}>
          {isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: mediaUri }}
              style={styles.media}
              resizeMode={ResizeMode.CONTAIN}
              useNativeControls
              onPlaybackStatusUpdate={handleVideoStatusUpdate}
            />
          ) : (
            <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="contain" />
          )}
        </View>
      )}

      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Analyzing media...</Text>
        </View>
      )}

      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>AI Analysis:</Text>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  mediaContainer: { marginTop: 20 },
  media: { width: 300, height: 300, borderRadius: 10 },
  loadingContainer: { marginTop: 20, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  resultContainer: { marginTop: 20, width: '100%', padding: 10, backgroundColor: '#f5f5f5', borderRadius: 8 },
  resultTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  resultText: { fontSize: 14 },
});

export default CaptureScreen;