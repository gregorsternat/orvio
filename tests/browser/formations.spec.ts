import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, test } from "./fixtures";

async function selectOption(page: Page, label: string, option: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}
async function openFilters(page: Page) {
  await page.getByRole("button", { name: /^Filtres/ }).click();
  await expect(
    page.getByRole("button", { name: "Type de formation", exact: true }),
  ).toBeVisible();
}

test("copy feedback handles navigation, keyboard activation and stale writes", async ({
  page,
  context,
}, testInfo) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  // Install before application timers so feedback resets remain cancellable.
  await page.clock.install();
  await page.goto("/formations");
  const copy = page.getByRole("button", { name: "Partager", exact: true });
  await expect(copy).toBeEnabled();
  const initialWidth = await copy.evaluate(
    (button: HTMLButtonElement) => button.offsetWidth,
  );
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(copy).toHaveAttribute("data-copy-state", "copied");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(page.url());
  expect(
    await copy.evaluate((button: HTMLButtonElement) => button.offsetWidth),
  ).toBe(initialWidth);

  await page.getByRole("searchbox").fill("Systèmes");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page).toHaveURL(/q=Syst/);
  await page.evaluate(() => {
    window.location.hash = "contenu";
  });
  await copy.focus();
  await page.keyboard.press("Space");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(page.url());

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new DOMException("Clipboard denied", "NotAllowedError");
        },
      },
    });
  });
  await copy.click();
  await expect(copy).toHaveAttribute("data-copy-state", "error");
  await expect(
    page.getByRole("status").filter({ hasText: "copie impossible" }),
  ).toContainText("réessayez");
  const fallback = page.getByRole("textbox", {
    name: "Lien à copier manuellement",
    exact: true,
  });
  await expect(fallback).toHaveValue(page.url());
  await fallback.focus();
  expect(
    await fallback.evaluate(
      (input: HTMLInputElement) => input.selectionEnd! - input.selectionStart!,
    ),
  ).toBe(page.url().length);
  await page.clock.fastForward(2_500);
  await expect(copy).toHaveAttribute("data-copy-state", "error");

  await page.evaluate(() => {
    let calls = 0;
    let resolveFirstWrite: (() => void) | undefined;
    const testWindow = window as Window & {
      resolveFirstClipboardWrite?: () => void;
    };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          calls += 1;
          if (calls === 1)
            await new Promise<void>((resolve) => {
              resolveFirstWrite = resolve;
            });
          else throw new DOMException("Clipboard denied", "NotAllowedError");
        },
      },
    });
    testWindow.resolveFirstClipboardWrite = () => resolveFirstWrite?.();
  });
  await copy.click();
  await copy.click();
  await expect(copy).toHaveAttribute("data-copy-state", "error");
  await page.evaluate(() => {
    (
      window as Window & { resolveFirstClipboardWrite?: () => void }
    ).resolveFirstClipboardWrite?.();
  });
  await expect(copy).toHaveAttribute("data-copy-state", "error");

  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("copy-error.png") });
});

test("explorer is accessible with provenance and bounded list and card views", async ({
  page,
  isMobile,
}) => {
  await page.goto("/formations");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Explorer les formations",
  );
  await expect(
    page.getByRole("button", { name: "Campagne d’admission" }),
  ).toContainText("2025");
  await expect(page.getByRole("status")).toContainText("31 résultats");
  if (isMobile) {
    await expect(page.getByRole("article")).toHaveCount(25);
    await page.getByRole("tab", { name: "Vue liste" }).click();
  }
  await expect(
    page.getByRole("table", { name: "Résultats de la recherche" }),
  ).toHaveAttribute("aria-rowcount", "26");
  await page
    .getByRole("button", {
      name: "Source et périmètre · Parcoursup 2025",
      exact: true,
    })
    .click();
  const provenance = page.getByRole("region", {
    name: "Source et périmètre · Parcoursup 2025",
    exact: true,
  });
  await expect(provenance.getByText(/Fixtures synthétiques/)).toBeVisible();
  await expect(provenance.locator(":scope > div")).toHaveCSS("opacity", "1");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Vue cartes" }).click();
  await expect(page.getByRole("article")).toHaveCount(25);
  await expect(page).toHaveURL(/vue=cartes/);
  if (isMobile)
    await page
      .getByRole("button", { name: "Afficher ou masquer la navigation" })
      .click();
  await page.getByRole("radio", { name: "Sombre", exact: true }).click();
  if (isMobile) await page.keyboard.press("Escape");
  else
    await expect(
      page.getByRole("tooltip", { name: "Sombre", exact: true }),
    ).toBeVisible();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("search, shared URLs and browser history preserve the visible state", async ({
  page,
}) => {
  await page.goto("/formations");
  const input = page.getByRole("searchbox");
  await input.fill("ecole etampes");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("2 résultats");
  await expect(page).toHaveURL(/q=ecole\+etampes/);
  const shared = page.url();
  await page.reload();
  await expect(input).toHaveValue("ecole etampes");
  await input.fill("introuvable");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Aucune formation ne correspond à votre recherche.",
    }),
  ).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(shared);
  await expect(input).toHaveValue("ecole etampes");
  await expect(page.getByRole("status")).toContainText("2 résultats");
});

test("pending searches and sorting retain criteria when the view is changed immediately", async ({
  page,
}) => {
  await page.goto("/formations?vue=liste");
  await expect(page.getByRole("status")).toContainText("31 résultats");
  let releaseSearch!: () => void;
  let releaseSort!: () => void;
  const searchGate = new Promise<void>((resolve) => {
    releaseSearch = resolve;
  });
  const sortGate = new Promise<void>((resolve) => {
    releaseSort = resolve;
  });
  await page.route("**/api/workspace/formations?**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("q") === "ecole etampes")
      await (params.get("tri") === "capacite" ? sortGate : searchGate);
    await route.continue();
  });
  try {
    await page.getByRole("searchbox").fill("ecole etampes");
    await page.getByRole("button", { name: "Rechercher", exact: true }).click();
    await expect(page.locator("#formations-contenu")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Vue cartes" })).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Trier les formations" }),
    ).toBeDisabled();
    const changeToCards = page.getByRole("tab", { name: "Vue cartes" }).click();
    releaseSearch();
    await changeToCards;
    await expect(page.getByRole("status")).toContainText("2 résultats");
    await expect(page.getByRole("article")).toHaveCount(2);
    expect(new URL(page.url()).searchParams.get("q")).toBe("ecole etampes");

    await selectOption(page, "Trier les formations", "Places · Décroissant");
    await expect(page.locator("#formations-contenu")).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await expect(page.getByRole("tab", { name: "Vue liste" })).toBeDisabled();
    const changeToList = page.getByRole("tab", { name: "Vue liste" }).click();
    releaseSort();
    await changeToList;
    const params = new URL(page.url()).searchParams;
    expect(params.get("q")).toBe("ecole etampes");
    expect(params.get("tri")).toBe("capacite");
    expect(params.get("vue")).toBe("liste");
    await expect(
      page.getByRole("table", { name: "Résultats de la recherche" }),
    ).toHaveAttribute("aria-rowcount", "3");
  } finally {
    releaseSearch();
    releaseSort();
  }
});

test("filters combine, pagination is stable and new searches reset the page", async ({
  page,
}) => {
  await page.goto("/formations?vue=cartes");
  await page.getByRole("link", { name: "Suivante", exact: true }).click();
  await expect(page.getByText("Page 2 sur 2")).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(6);
  await openFilters(page);
  await selectOption(page, "Type de formation", "Licence");
  await selectOption(page, "Région", "Ile-de-France");
  await selectOption(page, "Département", "Essonne");
  await page.getByRole("button", { name: "Appliquer les filtres" }).click();
  await expect(page.getByRole("status")).toContainText("2 résultats");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.getByRole("article")).toHaveCount(2);
  await selectOption(page, "Trier les formations", "Places · Décroissant");
  await expect(page).toHaveURL(/tri=capacite/);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Trier les formations" }),
  ).toContainText("Places · Décroissant");
});

test("campaign changes reset the search and explain historical gaps", async ({
  page,
}) => {
  await page.goto(
    "/formations?campagne=2025&q=droit&type=Licence&page=2&vue=cartes",
  );
  await selectOption(page, "Campagne d’admission", "Campagne 2018");
  await expect(page).toHaveURL(/\/formations\?campagne=2018&vue=cartes$/);
  await expect(page.getByRole("searchbox")).toHaveValue("");
  await openFilters(page);
  await expect(
    page.getByRole("button", {
      name: "Statut de l’établissement",
      exact: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Sélectivité", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText("Ville non renseignée", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Licence - Droit — Droit — Parcours européen",
    }),
  ).toBeVisible();
  await expect(page).toHaveTitle(/Parcoursup 2018/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gradavia.com/formations?campagne=2018",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("keyboard and reduced motion preserve search and filter access", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/formations");
  await expect(page.getByRole("status")).toContainText("31 résultats");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("main#contenu")).toBeFocused();
  await expect(page.getByRole("button", { name: /^Filtres/ })).toBeEnabled();
  await page.getByRole("button", { name: /^Filtres/ }).focus();
  await page.keyboard.press("Enter");
  const filter = page.getByRole("button", {
    name: "Type de formation",
    exact: true,
  });
  await expect(filter).toBeVisible();
  await filter.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("option", { name: "Tous", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await page.keyboard.press("Escape");
  await expect(filter).toBeFocused();
  await page.getByRole("searchbox").focus();
  await page.keyboard.type("BTS");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("1 résultat");
});

test("formation details preserve zero and masked values with history and definitions @smoke", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit+02&vue=cartes");
  await page.getByRole("link", { name: "Voir la formation" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Licence - Droit 02",
  );
  await expect(
    page.getByRole("heading", { name: "Admis", exact: true }).locator("../.."),
  ).toContainText("0");
  await expect(page.locator(".recharts-surface:visible")).toHaveCount(2);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("tab", { name: "Historique", exact: true }).click();
  await expect(
    page.getByRole("table", {
      name: "Historique des indicateurs et continuité",
    }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Définitions et source" }).click();
  await expect(
    page.getByRole("heading", { name: "Comprendre chaque indicateur" }),
  ).toBeVisible();
  const accessDefinition = page.getByRole("button", {
    name: /Taux d’accès/,
    exact: false,
  });
  await accessDefinition.click();
  await expect(page.getByText(/taux_acces_ens/)).toBeVisible();
  await page.goto("/formations?q=Droit+03&vue=cartes");
  await page.getByRole("link", { name: "Voir la formation" }).click();
  await expect(
    page
      .getByRole("heading", { name: "Taux d’accès", exact: true })
      .locator("../.."),
  ).toContainText("Masqué");
});

test("favorites persist through reload and can be removed from the saved page @smoke", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit+01&vue=cartes");
  await page
    .getByRole("button", {
      name: "Ajouter aux favoris : Licence - Droit 01",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Retirer des favoris : Licence - Droit 01",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/favoris");
  await expect(
    page.getByRole("heading", { name: "Licence - Droit 01", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Licence - Droit 01", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Retirer des favoris : Licence - Droit 01",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Aucune formation enregistrée",
    }),
  ).toBeVisible();
});

test("selections saved before the rename survive and new empty selections take precedence", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit+01&vue=cartes");
  const href = await page
    .getByRole("link", { name: "Licence - Droit 01", exact: true })
    .getAttribute("href");
  const formation = {
    id: decodeURIComponent(href!.split("/").at(-1)!),
    campaign: 2025,
    title: "Licence - Droit 01",
    establishment: null,
  };
  await page.evaluate((row) => {
    localStorage.setItem(
      "orvio.selection.v1",
      JSON.stringify({ favorites: [row], comparison: [row] }),
    );
  }, formation);
  await page.goto("/favoris");
  await expect(
    page.getByRole("heading", { name: formation.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: `Retirer des favoris : ${formation.title}`,
      exact: true,
    })
    .click();
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Aucune formation enregistrée",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gradavia.selection.v1")!),
    ),
  ).toEqual({ favorites: [], comparison: [formation] });
  await page.goto("/comparer");
  await expect(
    page.getByRole("link", { name: formation.title, exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: `Retirer ${formation.title} de la comparaison`,
      exact: true,
    })
    .click();
  await page.goto("/comparer");
  await expect(
    page.getByRole("heading", {
      name: "Quelles formations vous intéressent ?",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("gradavia.selection.v1")!),
    ),
  ).toEqual({ favorites: [], comparison: [] });
});

test("comparison is shareable, exports its values and blocks mixed campaign selection @smoke", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit&vue=cartes");
  await page
    .getByRole("button", { name: "Comparer : Licence - Droit 01", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Comparer : Licence - Droit 02", exact: true })
    .click();
  await page.getByRole("link", { name: "Comparer", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Comparer les formations",
  );
  await expect(
    page.getByRole("table", { name: "Comparaison des indicateurs" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toHaveLength(
    2,
  );
  const shared = page.url();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exporter la comparaison" }).click();
  expect((await download).suggestedFilename()).toBe("gradavia-comparaison.csv");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.reload();
  await expect(page).toHaveURL(shared);
  await expect(
    page.getByRole("link", { name: "Licence - Droit 02", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Retirer du comparateur : Licence - Droit 02",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("link", { name: "Licence - Droit 02", exact: true }),
  ).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toHaveLength(
    1,
  );
  await page.goto("/formations?q=Droit+02&vue=cartes");
  await expect(
    page.getByRole("button", {
      name: "Comparer : Licence - Droit 02",
      exact: true,
    }),
  ).toHaveAttribute("aria-pressed", "false");
  await page.goto("/formations?campagne=2024&vue=cartes");
  await page
    .getByRole("button", { name: "Comparer : Licence - Droit", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "La sélection concerne la campagne 2025" }),
  ).toBeVisible();
});

test("shared comparison controls remove displayed URL selections without local state", async ({
  page,
}) => {
  await page.goto("/formations?q=Droit&vue=cartes");
  const ids = await Promise.all(
    ["Licence - Droit 01", "Licence - Droit 02"].map(async (title) => {
      const path = await page
        .getByRole("link", { name: title, exact: true })
        .getAttribute("href");
      return decodeURIComponent(path!.split("/").at(-1)!);
    }),
  );
  await page.goto(`/comparer?${new URLSearchParams({ ids: ids.join(",") })}`);
  const remove = page.getByRole("button", {
    name: "Retirer du comparateur : Licence - Droit 01",
    exact: true,
  });
  await expect(remove).toHaveAttribute("aria-pressed", "true");
  await remove.click();
  await expect(
    page.getByRole("link", { name: "Licence - Droit 01", exact: true }),
  ).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("ids")).toBe(ids[1]);
  await page
    .getByRole("button", {
      name: "Retirer Licence - Droit 02 de la comparaison",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Quelles formations vous intéressent ?",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page).toHaveURL(/comparer\?ids=$/);
});

test("adding to a shared comparison preserves its formations and campaign with fresh storage", async ({
  page,
}) => {
  const titles = [
    "Licence - Droit 01",
    "Licence - Droit 02",
    "Licence - Droit 03",
  ];
  await page.goto("/formations?campagne=2025&q=Droit&vue=cartes");
  const ids = await Promise.all(
    titles.map(async (title) => {
      const path = await page
        .getByRole("link", { name: title, exact: true })
        .getAttribute("href");
      return decodeURIComponent(path!.split("/").at(-1)!);
    }),
  );
  expect(
    await page.evaluate(() => localStorage.getItem("gradavia.selection.v1")),
  ).toBeNull();
  await page.goto(
    `/comparer?${new URLSearchParams({ ids: ids.slice(0, 2).join(",") })}`,
  );
  await page.getByRole("button", { name: "Ajouter une formation" }).click();
  await expect(page).toHaveURL(/\/formations\?campagne=2025$/);
  await expect(
    page.getByRole("button", { name: "Campagne d’admission" }),
  ).toContainText("2025");
  await page.getByRole("searchbox").fill("Droit 03");
  await page.getByRole("button", { name: "Rechercher", exact: true }).click();
  await page
    .getByRole("button", { name: `Comparer : ${titles[2]}`, exact: true })
    .click();
  await page.getByRole("link", { name: "Comparer", exact: true }).click();
  for (const title of titles)
    await expect(
      page.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toEqual(ids);
  await page.reload();
  await expect(
    page.getByRole("table", { name: "Comparaison des indicateurs" }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toEqual(ids);
  let releaseFirst!: () => void;
  const firstResponse = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  let requestCount = 0;
  await page.route("**/api/workspace/selection?*", async (route) => {
    const first = requestCount++ === 0;
    const response = await route.fetch();
    if (first) await firstResponse;
    await route.fulfill({ response });
  });
  try {
    const firstRequest = page.waitForRequest("**/api/workspace/selection?*");
    await page
      .getByRole("button", {
        name: `Retirer du comparateur : ${titles[0]}`,
        exact: true,
      })
      .click();
    await firstRequest;
    await expect(
      page.getByRole("link", { name: titles[0], exact: true }),
    ).toHaveCount(0);
    const secondResponse = page.waitForResponse("**/api/workspace/selection?*");
    await page
      .getByRole("button", {
        name: `Retirer du comparateur : ${titles[1]}`,
        exact: true,
      })
      .click();
    await secondResponse;
    for (const title of titles.slice(0, 2))
      await expect(
        page.getByRole("link", { name: title, exact: true }),
      ).toHaveCount(0);
    expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toEqual([
      ids[2],
    ]);
    const staleResponse = page.waitForResponse("**/api/workspace/selection?*");
    releaseFirst();
    await staleResponse;
    for (const title of titles.slice(0, 2))
      await expect(
        page.getByRole("link", { name: title, exact: true }),
      ).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: titles[2], exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("ids")?.split(",")).toEqual([
      ids[2],
    ]);
  } finally {
    releaseFirst();
    await page.unrouteAll({ behavior: "wait" });
  }
});
