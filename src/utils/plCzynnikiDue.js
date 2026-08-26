/**
 * Terminy kolejnych pomiarów czynników szkodliwych — wejście do wspólnego kalendarza terminów.
 *
 * Pomiar po terminie jest tak samo „przeterminowany" jak badania lekarskie czy przegląd sprzętu,
 * więc powinien pojawiać się w tym samym miejscu, a nie tylko wewnątrz swojego rejestru.
 * Dla rynków innych niż PL rejestr jest pusty, więc funkcja nie zwraca nic.
 */
import { loadOrgScoped } from "./orgStorage";
import { liveOrgArrayRows } from "./d1ArrayMerge";
import { ocenPomiar } from "./plCzynnikiLibrary";

const STORAGE_KEY = "pl_czynniki_szkodliwe";

/**
 * @returns {Array<{ id: string, nextDueIso: string, name: string, stanowisko: string, moduleId: string }>}
 */
export function collectHarmfulFactorDueItems() {
  const rows = liveOrgArrayRows(loadOrgScoped(STORAGE_KEY, []) || []);
  const out = [];
  for (const row of rows) {
    // Odstąpienie od pomiarów jest decyzją pracodawcy zapisaną we wpisie — nie przypominamy o niej.
    if (row?.odstapiono) continue;
    const ocena = ocenPomiar(row);
    if (!ocena.nastepnyPomiar) continue;
    out.push({
      id: `czynnik_${row.id}`,
      nextDueIso: ocena.nastepnyPomiar,
      name: row.nazwa || "Czynnik szkodliwy",
      stanowisko: row.stanowisko || "",
      moduleId: "pl-czynniki",
    });
  }
  return out;
}
