import { describe, expect, it } from "vitest";

import { getInitials } from "../lib/initials";
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  normalizeNotificationPreferences,
  parseStoredNotificationSettings,
  shouldNotify,
} from "../lib/notification-preferences";

describe("getInitials", () => {
  it("usa primeira e última palavra do nome", () => {
    expect(getInitials("Vitor Hugo Silva", null)).toBe("VS");
    expect(getInitials("vitor", null)).toBe("V");
  });
  it("cai para o e-mail e depois para null", () => {
    expect(getInitials(null, "ana@exemplo.com")).toBe("A");
    expect(getInitials("  ", "")).toBeNull();
    expect(getInitials(undefined, undefined)).toBeNull();
  });
});

describe("notification preferences", () => {
  it("normaliza valores ausentes ou inválidos para os padrões", () => {
    expect(normalizeNotificationPreferences(undefined)).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
    expect(normalizeNotificationPreferences({ departureAlerts: "sim", tripUpdates: false })).toEqual({ departureAlerts: true, tripUpdates: false });
  });

  it("a chave geral desligada bloqueia todas as categorias", () => {
    const preferences = { departureAlerts: true, tripUpdates: true };
    expect(shouldNotify({ notificationsEnabled: false, preferences }, "departureAlerts")).toBe(false);
    expect(shouldNotify({ notificationsEnabled: true, preferences }, "tripUpdates")).toBe(true);
  });

  it("cada categoria pode ser desligada individualmente", () => {
    const settings = { notificationsEnabled: true, preferences: { departureAlerts: false, tripUpdates: true } };
    expect(shouldNotify(settings, "departureAlerts")).toBe(false);
    expect(shouldNotify(settings, "tripUpdates")).toBe(true);
  });

  it("lê o estado local salvo e tolera lixo", () => {
    const raw = JSON.stringify({ notificationsEnabled: false, notificationPreferences: { departureAlerts: false } });
    expect(parseStoredNotificationSettings(raw)).toEqual({ notificationsEnabled: false, preferences: { departureAlerts: false, tripUpdates: true } });
    expect(parseStoredNotificationSettings(null).notificationsEnabled).toBe(true);
    expect(parseStoredNotificationSettings("{quebrado").preferences).toEqual(DEFAULT_NOTIFICATION_PREFERENCES);
  });
});
