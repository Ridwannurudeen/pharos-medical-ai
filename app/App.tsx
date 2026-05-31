import { Ionicons } from "@expo/vector-icons";
import { DefaultTheme, NavigationContainer, type Theme } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { loadEngines } from "./src/engine";
import type { ScanStackParamList, TabParamList } from "./src/navigation/types";
import { ResultScreen } from "./src/screens/ResultScreen";
import { ScanScreen } from "./src/screens/ScanScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { ShelfScreen } from "./src/screens/ShelfScreen";
import { useShelf } from "./src/store/shelf";
import { colors } from "./src/theme";

const Stack = createNativeStackNavigator<ScanStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function ScanStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTintColor: colors.ink,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="Scan" component={ScanScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Result" component={ResultScreen} options={{ title: "Result" }} />
    </Stack.Navigator>
  );
}

const navTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.bg,
    card: colors.surface,
    text: colors.ink,
    primary: colors.accent,
    border: colors.line,
  },
};

const TAB_ICON: Record<keyof TabParamList, React.ComponentProps<typeof Ionicons>["name"]> = {
  ScanTab: "scan-outline",
  ShelfTab: "medkit-outline",
  SettingsTab: "information-circle-outline",
};

export default function App() {
  useEffect(() => {
    void loadEngines();
    void useShelf.getState().hydrate();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: colors.accent,
            tabBarInactiveTintColor: colors.inkFaint,
            tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={TAB_ICON[route.name]} size={size} color={color} />
            ),
          })}
        >
          <Tab.Screen name="ScanTab" component={ScanStack} options={{ title: "Scan" }} />
          <Tab.Screen name="ShelfTab" component={ShelfScreen} options={{ title: "Shelf" }} />
          <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: "About" }} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
