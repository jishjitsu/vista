import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, TouchableOpacity } from 'react-native';
import { Tabs } from 'expo-router';
import CaptureScreen from './index';  // Adjust path if needed
import HistoryScreen from './History';  // Adjust path if needed

// Custom Bottom Navigation Bar
const CustomTabBar = ({ state, navigation }: any) => {
  return (
    <View style={{
      flexDirection: 'row',
      justifyContent: 'space-around',
      padding: 15,
      backgroundColor: '#fff',
      borderTopWidth: 1,
      borderTopColor: '#ddd'
    }}>
      {state.routes.map((route: any, index: number) => (
        <TouchableOpacity
          key={route.key}
          onPress={() => navigation.navigate(route.name)}
          style={{
            paddingVertical: 12,
            paddingHorizontal: 30,
            backgroundColor: state.index === index ? '#007BFF' : '#ccc',
            borderRadius: 10,
          }}
        >
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>{route.name}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default function Layout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
      }}
      tabBar={(props) => <CustomTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Capture' }} />
      <Tabs.Screen name="History" options={{ title: 'History' }} />
    </Tabs>
  );
}