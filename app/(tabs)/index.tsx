import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Button, Image, ActivityIndicator, Alert, StyleSheet, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
// --- Import expo-av Video ---
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av'; // Import from expo-av

// IMPORTANT: Replace with your actual backend URL
// TODO: Use environment variables for different environments
const BACKEND_URL = 'https://0fc6-34-125-212-198.ngrok-free.app'; // <--- Using your ngrok URL

interface MediaFile {
  uri: string;
  name: string;
  type: string; // MIME type
}

interface AnalysisResponse {
  text?: string;
  session_id?: string;
  error?: string;
}

// --- No Dependency Check Reminder needed for expo-av (built-in) ---

const CaptureScreen: React.FC = () => {
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null); // Stores the detected MIME type
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false); // State for expo-av

  // --- Update Ref type for expo-av Video ---
  const videoRef = useRef<Video>(null); // Use expo-av Video type

  useEffect(() => {
    // Request camera permissions on component mount
    (async () => {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      setHasPermission(cameraPermission.status === 'granted');
      if (cameraPermission.status !== 'granted') {
         Alert.alert('Permission Required', 'Camera permission is needed to capture media.');
      }
    })();

    // Cleanup for expo-av: Unload video if component unmounts
    return () => {
        videoRef.current?.unloadAsync();
    };
  }, []);

  // --- Callbacks for expo-av Video ---
  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      // Video not loaded or unloaded
      if (status.error) {
        console.error(`Video Error: ${status.error}`);
        Alert.alert('Playback Error', `Could not load the video: ${status.error}`);
      }
    } else {
      // Video is loaded
      setIsVideoPlaying(status.isPlaying);
      // You can add more logic here based on status (buffering, finished, etc.)
    }
  };


  // --- captureMedia function includes improved MIME type logic ---
  const captureMedia = async () => {
    if (hasPermission === null) {
       Alert.alert('Permissions', 'Checking camera permissions...');
       return;
    }
    if (hasPermission === false) {
      Alert.alert('Permission Denied', 'Camera access is required. Please grant permission in settings.');
      return;
    }

    // Reset previous state before capturing new media
    setMediaUri(null);
    setMediaType(null);
    setResult(null);
    setSessionId(null);
    videoRef.current?.unloadAsync(); // Unload previous video

    try {
      const response = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All, // Capture images or videos
        quality: 0.8,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      });

      if (!response.canceled && response.assets && response.assets.length > 0) {
        const asset = response.assets[0];
        let determinedMediaType = asset.mimeType ?? asset.type ?? null;
        const fileExtension = asset.uri.split('.').pop()?.toLowerCase();

        // --- Improved MIME Type Logic ---
        if (!determinedMediaType || !determinedMediaType.includes('/')) {
           console.warn(`MIME type '${determinedMediaType}' is generic or missing. Guessing from extension '.${fileExtension}'.`);
           if (fileExtension === 'jpg' || fileExtension === 'jpeg') {
               determinedMediaType = 'image/jpeg';
           } else if (fileExtension === 'png') {
               determinedMediaType = 'image/png';
           } else if (fileExtension === 'mp4') {
               determinedMediaType = 'video/mp4';
           } else if (fileExtension === 'mov') {
               determinedMediaType = 'video/quicktime'; // Common for iOS MOV files
           } else if (fileExtension === 'avi') {
               determinedMediaType = 'video/x-msvideo';
           } else if (fileExtension === 'webm') {
               determinedMediaType = 'video/webm';
           } else if (fileExtension === '3gp' || fileExtension === '3gpp') {
               determinedMediaType = 'video/3gpp';
           } else {
               // Fallback based on asset type and extension if specific type unknown
               determinedMediaType = asset.type === 'video' ? `video/${fileExtension}` : asset.type === 'image' ? `image/${fileExtension}` : 'application/octet-stream';
               console.warn(`Could not determine specific MIME type for extension '.${fileExtension}'. Using fallback: ${determinedMediaType}`);
           }
        }
        // --- End Improved Logic ---

        console.log(`Captured Media - URI: ${asset.uri}, Final Determined MIME Type: ${determinedMediaType}`);

        setMediaUri(asset.uri);
        setMediaType(determinedMediaType);

        const mediaFile: MediaFile = {
          uri: asset.uri,
          name: asset.fileName ?? `media_${Date.now()}.${fileExtension || 'unknown'}`,
          type: determinedMediaType, // Use the determined type
        };

        await uploadToBackend(mediaFile);
      } else {
          console.log("Media capture cancelled or failed.");
      }
    } catch (error: unknown) {
       console.error('Camera Launch Error:', error);
       const errorMessage = error instanceof Error ? error.message : String(error);
       Alert.alert('Error', `Failed to launch camera: ${errorMessage}`);
    }
  };

  // --- uploadToBackend function includes more logging and refined error display ---
  const uploadToBackend = async (file: MediaFile) => {
    if (!BACKEND_URL) {
        Alert.alert('Configuration Error', 'Backend URL is not set.');
        return;
    }
    setLoading(true);
    setResult(null);

    try {
      // --- Add extra logging here ---
      console.log(`[uploadToBackend] Preparing FormData with file type: ${file.type}`);
      // -----------------------------

      const formData = new FormData();
      formData.append('prompt', 'Please analyze this media.');
      formData.append('media_file', {
        uri: Platform.OS === 'android' ? file.uri : file.uri.replace('file://', ''),
        name: file.name,
        type: file.type, // Use the determined type
      } as any); // Use 'as any' for RN FormData compatibility

      console.log("Sending request to:", `${BACKEND_URL}/analyze-media`);
      const response = await fetch(`${BACKEND_URL}/analyze-media`, {
        method: 'POST',
        body: formData,
        headers: { 'Accept': 'application/json' }, // Let fetch set Content-Type for FormData
      });

      console.log(`Server Response Status: ${response.status}`);
      const responseBodyText = await response.text();
      console.log(`Server Response Body: ${responseBodyText}`);

      if (!response.ok) {
          let errorMessage = `Analysis failed. Status: ${response.status}`;
          try {
              const errorData: AnalysisResponse = JSON.parse(responseBodyText);
              // Use the detailed error from the backend if available
              errorMessage = errorData.error || `Analysis failed. Status: ${response.status}`;
          } catch (e) {
              // If parsing fails, use the raw text, especially if it's the "Unsupported" error
              errorMessage = responseBodyText.includes("Unsupported media type")
                  ? responseBodyText // Show the detailed unsupported type message
                  : `${errorMessage} - ${response.statusText || responseBodyText}`;
          }
          console.error("Upload/Analysis Error:", errorMessage);
          Alert.alert('Error', errorMessage); // Show the potentially more detailed error
          return;
      }

      // --- Success Handling ---
      try {
        const data: AnalysisResponse = JSON.parse(responseBodyText);
        setResult(data.text || 'Analysis complete, but no text returned.');
        if (data.session_id) {
            setSessionId(data.session_id);
            console.log("Received session ID:", data.session_id);
        }
      } catch (error) {
        console.error('JSON Parsing Error on Success:', error);
        Alert.alert('Error', 'Received response, but failed to parse result JSON.');
        setResult('Received response, but failed to parse result JSON.');
      }
    } catch (error: unknown) {
       console.error('Upload Error:', error);
       const errorMessage = error instanceof Error ? error.message : String(error);
       Alert.alert('Upload Failed', `An error occurred during upload: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // Determine if the displayed media is a video based on the *state*
  const isVideo = mediaType?.startsWith('video/');

  return (
    <View style={styles.container}>
      <Button title="Capture Media" onPress={captureMedia} disabled={loading || hasPermission === null} />
       {hasPermission === false && <Text style={styles.permissionText}>Camera permission denied.</Text>}

      {mediaUri && (
        <View style={styles.mediaContainer}>
          {isVideo ? (
            // --- Use expo-av Video component ---
            <Video
              ref={videoRef}
              style={styles.media}
              source={{ uri: mediaUri }}
              useNativeControls // Use Expo's native controls
              resizeMode={ResizeMode.CONTAIN} // Use ResizeMode enum
              isLooping // Example: make video loop
              onPlaybackStatusUpdate={onPlaybackStatusUpdate} // Use expo-av's status update
            />
          ) : (
            <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="contain" />
          )}
        </View>
      )}

      {/* Loading and Result sections remain the same */}
      {loading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0000ff" />
          <Text style={styles.loadingText}>Analyzing media...</Text>
        </View>
      )}

      {result && !loading && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>AI Analysis:</Text>
          <Text style={styles.resultText}>{result}</Text>
           {sessionId && <Text style={styles.sessionIdText}>Session ID: {sessionId}</Text> }
        </View>
      )}
    </View>
  );
};

// Styles remain the same
const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', padding: 20, paddingTop: 50 },
  permissionText: { color: 'red', marginTop: 10, },
  mediaContainer: { marginTop: 20, width: '100%', aspectRatio: 1, maxWidth: 400, maxHeight: 400, alignSelf: 'center', },
  media: { width: '100%', height: '100%', borderRadius: 10, backgroundColor: '#eee' },
  loadingContainer: { marginTop: 30, alignItems: 'center', },
  loadingText: { marginTop: 10, color: '#666', fontSize: 16, },
  resultContainer: { marginTop: 30, width: '100%', padding: 15, backgroundColor: '#f0f0f0', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', },
  resultTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: '#333', },
  resultText: { fontSize: 16, color: '#555', },
  sessionIdText: { fontSize: 12, color: '#888', marginTop: 8, }
});

export default CaptureScreen;
