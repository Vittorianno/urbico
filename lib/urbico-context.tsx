import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { createTripRecord } from "@/lib/urbico-logic";

export type CrowdLevel = "Vazio" | "Baixa" | "Normal" | "Alta" | "Lotado";

export type Favorite = {
  id: string;
  label: string;
  address: string;
  latitude?: number;
  longitude?: number;
};

export type Appointment = {
  id: string;
  title: string;
  date: string;
  time: string;
  address: string;
  latitude?: number;
  longitude?: number;
  relevantLineId?: number;
  relevantLineLabel?: string;
  alertsEnabled?: boolean;
};

export type RoutePlace = { name: string; address: string; latitude: number; longitude: number };
export type TransitContextLine = { id: number; label: string; destination: string; origin: string };
export type ActiveRoute = { origin: RoutePlace; destination: RoutePlace; points: number[][]; distanceMeters: number; durationSeconds: number; line: TransitContextLine | null };
export type CurrentLocation = { latitude: number; longitude: number; accuracy: number | null; capturedAt: number };

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  // FIX: antes não existia este campo, e a tela do Norby calculava o horário
  // exibido com `new Date()` a cada renderização — ou seja, toda mensagem
  // (inclusive as antigas) sempre mostrava a hora atual, e o horário mudava
  // sozinho a cada novo render. Agora o horário real de criação é gravado uma
  // única vez, junto com a mensagem.
  createdAt: number;
};

export type TripRecord = {
  id: string;
  endedAt: string;
};

type UrbicoState = {
  favorites: Favorite[];
  appointments: Appointment[];
  messages: ChatMessage[];
  crowdReports: CrowdLevel[];
  tripHistory: TripRecord[];
  isTripActive: boolean;
  notificationsEnabled: boolean;
  voiceEnabled: boolean;
  activeRoute: ActiveRoute | null;
  currentLocation: CurrentLocation | null;
  locationSharingEnabled: boolean;
  addFavorite: (favorite: Omit<Favorite, "id">) => void;
  removeFavorite: (id: string) => void;
  addAppointment: (appointment: Omit<Appointment, "id">) => void;
  removeAppointment: (id: string) => void;
  sendMessage: (text: string) => void;
  addNorbyMessage: (text: string) => void;
  addCrowdReport: (level: CrowdLevel) => void;
  startTrip: () => void;
  endTrip: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
  setActiveRoute: (route: ActiveRoute | null) => void;
  setCurrentLocation: (location: CurrentLocation | null) => void;
  setLocationSharingEnabled: (enabled: boolean) => void;
};

const STORAGE_KEY = "urbico.local-state.v1";

// FIX: gerador de id com contador monotônico para evitar colisões quando duas
// mensagens (ex.: a pergunta do usuário e a resposta do Norby) são criadas no
// mesmo milissegundo — `Date.now()` sozinho podia gerar o mesmo id duas vezes,
// o que fazia uma mensagem sobrescrever silenciosamente a outra no Map usado
// para mesclar com o armazenamento local.
let messageIdCounter = 0;
function nextMessageId(prefix: string) {
  messageIdCounter += 1;
  return `${prefix}-${Date.now()}-${messageIdCounter}`;
}

const initialMessages: ChatMessage[] = [
  {
    id: "norby-welcome",
    role: "assistant",
    content: "Olá, sou o Norby. Diga para onde vamos e eu organizo sua próxima decisão.",
    createdAt: Date.now(),
  },
];

const UrbicoContext = createContext<UrbicoState | undefined>(undefined);

export function UrbicoProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<Favorite[]>([
    { id: "home", label: "Casa", address: "Defina seu endereço" },
    { id: "work", label: "Trabalho", address: "Defina seu endereço" },
  ]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [crowdReports, setCrowdReports] = useState<CrowdLevel[]>([]);
  const [tripHistory, setTripHistory] = useState<TripRecord[]>([]);
  const [isTripActive, setIsTripActive] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [activeRoute, setActiveRoute] = useState<ActiveRoute | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as Partial<Omit<UrbicoState, "addFavorite" | "removeFavorite" | "addAppointment" | "removeAppointment" | "sendMessage" | "addNorbyMessage" | "addCrowdReport" | "startTrip" | "endTrip" | "setNotificationsEnabled" | "setVoiceEnabled" | "setActiveRoute" | "setCurrentLocation" | "setLocationSharingEnabled">>;
        if (parsed.favorites) setFavorites(parsed.favorites);
        if (parsed.appointments) setAppointments(parsed.appointments);
        if (parsed.messages) {
          // FIX: mensagens salvas antes desta correção não têm `createdAt`.
          // Preenche com Date.now() como aproximação só na migração, para não
          // quebrar a tela do Norby ao ler dados antigos do AsyncStorage.
          const storedMessages = parsed.messages.map((message) => ({
            ...message,
            createdAt: (message as Partial<ChatMessage>).createdAt ?? Date.now(),
          }));
          setMessages((current) => {
            const merged = new Map(storedMessages.map((message) => [message.id, message]));
            current.forEach((message) => merged.set(message.id, message));
            return Array.from(merged.values());
          });
        }
        if (parsed.crowdReports) setCrowdReports(parsed.crowdReports);
        if (parsed.tripHistory) setTripHistory(parsed.tripHistory);
        if (typeof parsed.isTripActive === "boolean") setIsTripActive(parsed.isTripActive);
        if (typeof parsed.notificationsEnabled === "boolean") setNotificationsEnabled(parsed.notificationsEnabled);
        if (typeof parsed.voiceEnabled === "boolean") setVoiceEnabled(parsed.voiceEnabled);
        if (parsed.activeRoute) setActiveRoute(parsed.activeRoute);
        if (parsed.currentLocation) setCurrentLocation(parsed.currentLocation);
        if (typeof parsed.locationSharingEnabled === "boolean") setLocationSharingEnabled(parsed.locationSharingEnabled);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ favorites, appointments, messages, crowdReports, tripHistory, isTripActive, notificationsEnabled, voiceEnabled, activeRoute, currentLocation, locationSharingEnabled }),
    ).catch(() => undefined);
  }, [activeRoute, appointments, crowdReports, currentLocation, favorites, hydrated, isTripActive, locationSharingEnabled, messages, notificationsEnabled, tripHistory, voiceEnabled]);

  const value = useMemo<UrbicoState>(
    () => ({
      favorites,
      appointments,
      messages,
      crowdReports,
      tripHistory,
      isTripActive,
      notificationsEnabled,
      voiceEnabled,
      activeRoute,
      currentLocation,
      locationSharingEnabled,
      addFavorite: (favorite) => setFavorites((current) => [...current, { ...favorite, id: `favorite-${Date.now()}` }]),
      removeFavorite: (id) => setFavorites((current) => current.filter((favorite) => favorite.id !== id)),
      addAppointment: (appointment) => setAppointments((current) => [...current, { ...appointment, id: `appointment-${Date.now()}` }]),
      removeAppointment: (id) => setAppointments((current) => current.filter((appointment) => appointment.id !== id)),
      sendMessage: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setMessages((current) => [
          ...current,
          { id: nextMessageId("user"), role: "user", content: trimmed, createdAt: Date.now() },
        ]);
      },
      addNorbyMessage: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setMessages((current) => [...current, { id: nextMessageId("norby"), role: "assistant", content: trimmed, createdAt: Date.now() }]);
      },
      addCrowdReport: (level) => setCrowdReports((current) => [...current, level]),
      startTrip: () => setIsTripActive(true),
      endTrip: () => {
        setIsTripActive(false);
        setTripHistory((current) => [createTripRecord(new Date()), ...current]);
      },
      setNotificationsEnabled,
      setVoiceEnabled,
      setActiveRoute,
      setCurrentLocation,
      setLocationSharingEnabled,
    }),
    [activeRoute, appointments, crowdReports, currentLocation, favorites, isTripActive, locationSharingEnabled, messages, notificationsEnabled, tripHistory, voiceEnabled],
  );

  return <UrbicoContext.Provider value={value}>{children}</UrbicoContext.Provider>;
}

export function useUrbico() {
  const context = useContext(UrbicoContext);
  if (!context) throw new Error("useUrbico deve ser usado dentro de UrbicoProvider");
  return context;
}
