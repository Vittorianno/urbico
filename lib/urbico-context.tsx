import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";

import { createTripRecord, getNorbyReply } from "@/lib/urbico-logic";

export type CrowdLevel = "Vazio" | "Baixa" | "Normal" | "Alta" | "Lotado";

export type Favorite = {
  id: string;
  label: string;
  address: string;
};

export type Appointment = {
  id: string;
  title: string;
  date: string;
  time: string;
  address: string;
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
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
  addFavorite: (favorite: Omit<Favorite, "id">) => void;
  removeFavorite: (id: string) => void;
  addAppointment: (appointment: Omit<Appointment, "id">) => void;
  removeAppointment: (id: string) => void;
  sendMessage: (text: string) => void;
  addCrowdReport: (level: CrowdLevel) => void;
  startTrip: () => void;
  endTrip: () => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setVoiceEnabled: (enabled: boolean) => void;
};

const STORAGE_KEY = "urbico.local-state.v1";

const initialMessages: ChatMessage[] = [
  {
    id: "norby-welcome",
    role: "assistant",
    content: "Olá, sou o Norby. Diga para onde vamos e eu organizo sua próxima decisão.",
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
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as Partial<Omit<UrbicoState, "addFavorite" | "removeFavorite" | "addAppointment" | "removeAppointment" | "sendMessage" | "addCrowdReport" | "startTrip" | "endTrip" | "setNotificationsEnabled" | "setVoiceEnabled">>;
        if (parsed.favorites) setFavorites(parsed.favorites);
        if (parsed.appointments) setAppointments(parsed.appointments);
        if (parsed.messages) setMessages(parsed.messages);
        if (parsed.crowdReports) setCrowdReports(parsed.crowdReports);
        if (parsed.tripHistory) setTripHistory(parsed.tripHistory);
        if (typeof parsed.isTripActive === "boolean") setIsTripActive(parsed.isTripActive);
        if (typeof parsed.notificationsEnabled === "boolean") setNotificationsEnabled(parsed.notificationsEnabled);
        if (typeof parsed.voiceEnabled === "boolean") setVoiceEnabled(parsed.voiceEnabled);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ favorites, appointments, messages, crowdReports, tripHistory, isTripActive, notificationsEnabled, voiceEnabled }),
    ).catch(() => undefined);
  }, [appointments, crowdReports, favorites, hydrated, isTripActive, messages, notificationsEnabled, tripHistory, voiceEnabled]);

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
      addFavorite: (favorite) => setFavorites((current) => [...current, { ...favorite, id: `favorite-${Date.now()}` }]),
      removeFavorite: (id) => setFavorites((current) => current.filter((favorite) => favorite.id !== id)),
      addAppointment: (appointment) => setAppointments((current) => [...current, { ...appointment, id: `appointment-${Date.now()}` }]),
      removeAppointment: (id) => setAppointments((current) => current.filter((appointment) => appointment.id !== id)),
      sendMessage: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setMessages((current) => [
          ...current,
          { id: `user-${Date.now()}`, role: "user", content: trimmed },
          { id: `norby-${Date.now() + 1}`, role: "assistant", content: getNorbyReply(trimmed) },
        ]);
      },
      addCrowdReport: (level) => setCrowdReports((current) => [...current, level]),
      startTrip: () => setIsTripActive(true),
      endTrip: () => {
        setIsTripActive(false);
        setTripHistory((current) => [createTripRecord(new Date()), ...current]);
      },
      setNotificationsEnabled,
      setVoiceEnabled,
    }),
    [appointments, crowdReports, favorites, isTripActive, messages, notificationsEnabled, tripHistory, voiceEnabled],
  );

  return <UrbicoContext.Provider value={value}>{children}</UrbicoContext.Provider>;
}

export function useUrbico() {
  const context = useContext(UrbicoContext);
  if (!context) throw new Error("useUrbico deve ser usado dentro de UrbicoProvider");
  return context;
}
