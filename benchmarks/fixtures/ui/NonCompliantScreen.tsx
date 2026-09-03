import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import axios from 'axios';

export const NonCompliantScreen = () => {
  // Violation 1: Direct API in UI component
  // Violation 2: Hardcoded hex colors
  // Violation 3: Hardcoded strings
  // Violation 4: Missing testIDs
  return (
    <View style={{ flex: 1, backgroundColor: '#1e1e2e', padding: 14 }}>
      <Text style={{ color: '#ffffff', fontSize: 18 }}>Player Profile Screen</Text>
      <TouchableOpacity
        style={{ backgroundColor: '#ff5500', padding: 10 }}
        onPress={() => axios.get('http://api.mysports.com/data')}
      >
        <Text style={{ color: '#000000' }}>Click Me</Text>
      </TouchableOpacity>
    </View>
  );
};
