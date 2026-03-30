import { COUNTER_KEY } from "./constants";

export const today = () =>
  new Date().toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });

export const nextNum = () => {
  const n = Number(localStorage.getItem(COUNTER_KEY) || 0) + 1;
  localStorage.setItem(COUNTER_KEY, n);
  return `S-${String(n).padStart(3, "0")}`;
};
