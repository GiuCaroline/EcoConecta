import './global.css';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { useFonts, Poppins_200ExtraLight, Poppins_300Light, Poppins_400Regular,
    Poppins_600SemiBold_Italic, Poppins_500Medium, Poppins_600SemiBold, Poppins_700Bold } from '@expo-google-fonts/poppins';


    
import { Login } from './src/screens/Login';


const Stack = createNativeStackNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_200ExtraLight,
    Poppins_300Light,
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  return (
    <NavigationContainer>
      
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: "fade",
          animationDuration: 1000,
        }}
      >
        <Stack.Screen name="Login" component={Login} />
      </Stack.Navigator>
      <StatusBar />
    </NavigationContainer>
  );
}