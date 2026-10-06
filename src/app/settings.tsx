import { Text, View } from 'react-native';
import BottomBubble from '../components/BottomBubble';

export default function Settings() {
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#8a8f98' }}>Настройки скоро появятся</Text>
      <BottomBubble active="settings" />
    </View>
  );
}