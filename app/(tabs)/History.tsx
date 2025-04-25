import React from 'react';
import { View, Text, FlatList } from 'react-native';

interface HistoryItem {
  id: string;
  fileName: string;
  analysis: any;
}

interface HistoryScreenProps {
  history: HistoryItem[];
}

const HistoryScreen: React.FC<HistoryScreenProps> = ({ history }) => {
  return (
    <View style={{ flex: 1, padding: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 10 }}>History</Text>
      {history.length === 0 ? (
        <Text>No history available</Text>
      ) : (
        <FlatList
          data={history}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={{ padding: 10, borderBottomWidth: 1 }}>
              <Text>File: {item.fileName}</Text>
              <Text>Analysis: {JSON.stringify(item.analysis)}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
};

export default HistoryScreen;
