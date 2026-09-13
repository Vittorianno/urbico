import { useEffect, useState } from "react";
import { StyleProp, TextInput, TextStyle } from "react-native";

import { colors } from "@/components/urbico-ui";

type DateInputProps = {
  /** Data no formato ISO (AAAA-MM-DD) ou "" enquanto incompleta/inválida — mesmo formato já usado no resto do app (armAlert, ordenação, etc.). */
  value: string;
  onChange: (iso: string) => void;
  onSubmit?: () => void;
  style?: StyleProp<TextStyle>;
};

function isoToDigits(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const [, yyyy, mm, dd] = match;
  return `${dd}${mm}${yyyy}`;
}

function formatDigits(digits: string): string {
  let out = digits.slice(0, 2);
  if (digits.length > 2) out += `/${digits.slice(2, 4)}`;
  if (digits.length > 4) out += `/${digits.slice(4, 8)}`;
  return out;
}

function digitsToIso(digits: string): string {
  if (digits.length !== 8) return "";
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const day = Number(dd);
  const month = Number(mm);
  const year = Number(yyyy);
  if (month < 1 || month > 12) return "";
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) return "";
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * FIX: o campo de data era um texto livre no formato AAAA-MM-DD (invertido
 * para quem está acostumado com DD/MM/AAAA no Brasil) e sem nenhuma
 * formatação automática — a pessoa tinha que digitar as barras/hífens na
 * mão. Este componente mostra e edita a data como DD/MM/AAAA, inserindo as
 * barras sozinho conforme os números são digitados, e só entrega para o
 * restante do app (que continua guardando em ISO, para as contas de data
 * funcionarem sem mudar mais nada) quando os 8 dígitos formam uma data
 * válida.
 */
export function DateInput({ value, onChange, onSubmit, style }: DateInputProps) {
  const [digits, setDigits] = useState(() => isoToDigits(value));

  useEffect(() => {
    if (!value) { setDigits(""); return; }
    const externalDigits = isoToDigits(value);
    if (externalDigits) setDigits(externalDigits);
  }, [value]);

  const handleChangeText = (raw: string) => {
    const nextDigits = raw.replace(/\D/g, "").slice(0, 8);
    setDigits(nextDigits);
    onChange(digitsToIso(nextDigits));
  };

  return (
    <TextInput
      value={formatDigits(digits)}
      onChangeText={handleChangeText}
      onSubmitEditing={onSubmit}
      placeholder="Data DD/MM/AAAA"
      placeholderTextColor={colors.muted}
      keyboardType="number-pad"
      maxLength={10}
      returnKeyType="next"
      style={style}
    />
  );
}
