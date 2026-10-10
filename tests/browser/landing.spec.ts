import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("landing fills the first screen and settles on the next section after scrolling", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const preview = page.locator("#apercu");
  await expect(preview).toContainText("Campagne 2025");
  const headerHeight = (await page.getByRole("banner").boundingBox())!.height;
  const viewport = page.viewportSize()!;
  const availableHeight = viewport.height - headerHeight;
  const heights = await page
    .locator("main > section, main > #apercu")
    .evaluateAll((sections) =>
      sections.map((section) => section.getBoundingClientRect().height),
    );
  // The final chapter shares its screen with the page footer.
  const footerHeight = (await page.getByRole("contentinfo").boundingBox())!
    .height;
  for (const [index, height] of heights.entries()) {
    const chapterHeight =
      height + (index === heights.length - 1 ? footerHeight : 0);
    expect(chapterHeight).toBeGreaterThanOrEqual(availableHeight - 1);
  }
  expect((await preview.boundingBox())!.y).toBeGreaterThanOrEqual(
    viewport.height,
  );

  await page.mouse.move(viewport.width - 10, viewport.height / 2);
  await page.mouse.wheel(0, availableHeight * 0.65);
  await expect
    .poll(async () => Math.abs((await preview.boundingBox())!.y - headerHeight))
    .toBeLessThan(2);

  await page.keyboard.press("End");
  await expect(page.getByRole("contentinfo")).toBeInViewport();
  await expect(
    page.getByRole("radiogroup", { name: "Apparence" }),
  ).toBeInViewport();
});

test("landing anchor links glide to their section and retain keyboard navigation", async ({
  page,
  isMobile,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("#apercu")).toContainText("Campagne 2025");
  const previewLink = page.getByRole("link", { name: "Voir l’aperçu" });
  await previewLink.focus();
  const samples: number[] = [];
  await page.exposeFunction("recordLandingScroll", (position: number) => {
    samples.push(position);
  });
  await page.evaluate(() => {
    const record = (
      window as typeof window & {
        recordLandingScroll: (position: number) => Promise<void>;
      }
    ).recordLandingScroll;
    window.addEventListener("scroll", () => {
      void record(window.scrollY);
    });
  });
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/#apercu$/);
  const headerHeight = (await page.getByRole("banner").boundingBox())!.height;
  await expect
    .poll(async () =>
      Math.abs((await page.locator("#apercu").boundingBox())!.y - headerHeight),
    )
    .toBeLessThan(2);
  const destination = await page.evaluate(() => window.scrollY);
  expect(
    new Set(samples.filter((y) => y > 0 && y < destination - 1)).size,
  ).toBeGreaterThan(1);
  await expect(page.locator("#apercu")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Définition : Formations" }),
  ).toBeFocused();

  if (!isMobile) {
    await page.getByRole("link", { name: "Découvrir", exact: true }).click();
    await expect(page).toHaveURL(/\/#explorer$/);
    await expect
      .poll(async () =>
        Math.abs(
          (await page.locator("#explorer").boundingBox())!.y - headerHeight,
        ),
      )
      .toBeLessThan(2);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("searchbox")).toBeFocused();
  }
  await page
    .getByRole("navigation", { name: "Navigation d’accueil" })
    .getByRole("link", { name: "Ouvrir l’observatoire" })
    .click();
  await expect(page).toHaveURL(/\/observatoire$/);
  await expect(page.locator("html")).toHaveCSS("scroll-snap-type", "none");
  await expect(page.locator("html")).toHaveCSS("scroll-behavior", "auto");
});

test("landing opens the observatory and the home link returns to the public entry", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Votre orientation,",
  );
  await expect(
    page.getByRole("button", { name: "Afficher ou masquer la navigation" }),
  ).toHaveCount(0);
  await page
    .getByRole("navigation", { name: "Navigation d’accueil" })
    .getByRole("link", { name: "Ouvrir l’observatoire" })
    .click();
  await expect(page).toHaveURL(/\/observatoire$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Vue d’ensemble",
  );
  // The server heading can precede the shell's interactive navigation.
  await expect(page.locator(".recharts-surface")).toHaveCount(4);
  if (isMobile)
    await page
      .getByRole("button", { name: "Afficher ou masquer la navigation" })
      .click();
  await page.getByRole("link", { name: "Gradavia, accueil" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(
    page.getByRole("navigation", { name: "Navigation d’accueil" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Afficher ou masquer la navigation" }),
  ).toHaveCount(0);
  await page
    .getByRole("region", { name: /Votre orientation,/ })
    .getByRole("link", { name: "Explorer les formations" })
    .click();
  await expect(page).toHaveURL(/\/formations$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Explorer les formations",
  );
  await expect(page.getByRole("status")).toContainText("31 résultats");
});

test("shared campaign links from the former home retain their campaign in the observatory", async ({
  page,
}) => {
  await page.goto("/?campagne=2018");
  await expect(page).toHaveURL(/\/observatoire\?campagne=2018$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Vue d’ensemble",
  );
  await expect(
    page.getByRole("button", { name: "Campagne d’admission" }),
  ).toContainText("2018");
  await expect(page.getByRole("main")).toContainText(
    "Campagne 2018 · Hors apprentissage",
  );
});

test("landing search carries accented words and spaces into a shareable explorer query @smoke", async ({
  page,
}) => {
  await page.goto("/");
  const query = "école étampes";
  const search = page.getByRole("search", { name: "Trouver une formation" });
  await search.getByRole("searchbox").fill(query);
  await search.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page).toHaveURL(/\/formations\?q=%C3%A9cole\+%C3%A9tampes$/);
  expect(new URL(page.url()).searchParams.get("q")).toBe(query);
  await expect(page.getByRole("searchbox")).toHaveValue(query);
  await expect(page.getByRole("status")).toContainText("2 résultats");
  await page.reload();
  await expect(page.getByRole("searchbox")).toHaveValue(query);
  await expect(page.getByRole("status")).toContainText("2 résultats");
});

test("landing preview preserves source, campaign and partial coverage when switching metrics", async ({
  page,
}) => {
  await page.goto("/");
  const preview = page.getByRole("region", {
    name: "Aperçu de l’observatoire",
  });
  await expect(preview).toContainText("Campagne 2025");
  await expect(preview).toContainText("Hors apprentissage");
  await expect(
    preview.getByRole("definition").getByText("31", { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByRole("definition").getByText("6 537", { exact: true }),
  ).toBeVisible();
  await expect(preview).toContainText("Renseigné pour 30 / 31 lignes");
  await expect(
    preview.getByRole("link", {
      name: "Source Parcoursup : Producteur de démonstration",
    }),
  ).toHaveAttribute(
    "href",
    "https://data.enseignementsup-recherche.gouv.fr/explore/dataset/fr-esr-parcoursup/",
  );
  await expect(preview).toContainText("Périmètre variable selon les campagnes");
  await expect(preview).toContainText("Certaines sommes sont partielles");
  // The server-rendered values can precede the accordion's client handlers.
  await expect(preview.locator(".recharts-surface")).toBeVisible();
  await preview.getByRole("button", { name: "Voir les valeurs" }).click();
  const places = preview.getByRole("table", {
    name: "Places proposées par campagne et couverture",
  });
  await expect(places).toBeVisible();
  const latestPlaces = places.getByRole("row").filter({
    has: page.getByRole("cell", { name: "2025", exact: true }),
  });
  await expect(latestPlaces).toContainText("6 537");
  await expect(latestPlaces).toContainText("30 / 31");
  const earliestPlaces = places.getByRole("row").filter({
    has: page.getByRole("cell", { name: "2018", exact: true }),
  });
  await expect(earliestPlaces).toContainText("100");
  await expect(earliestPlaces).toContainText("1 / 1");

  const metric = preview.getByRole("radiogroup", {
    name: "Indicateur de l’aperçu",
  });
  await metric.getByRole("radio", { name: "Places", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(metric.getByRole("radio", { name: "Admis" })).toBeChecked();
  const admitted = preview.getByRole("table", {
    name: "Admis par campagne et couverture",
  });
  await expect(admitted).toBeVisible();
  const latestAdmitted = admitted.getByRole("row").filter({
    has: page.getByRole("cell", { name: "2025", exact: true }),
  });
  await expect(latestAdmitted).toContainText("6 220");
  await expect(latestAdmitted).toContainText("30 / 31");
  await expect(
    latestAdmitted.getByRole("link", { name: "Source Parcoursup 2025" }),
  ).toHaveAttribute("href", /\/dataset\/fr-esr-parcoursup\/$/);
  await preview.getByRole("link", { name: "Ouvrir l’observatoire" }).click();
  await expect(page).toHaveURL(/\/observatoire\?campagne=2025$/);
  await expect(
    page.getByRole("button", { name: "Campagne d’admission" }),
  ).toContainText("2025");
});

test("skip link and source questions remain keyboard accessible with reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Aller au contenu" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  const previewTop = await page
    .getByRole("link", { name: "Voir l’aperçu" })
    .evaluate((link) => {
      (link as HTMLAnchorElement).click();
      return document.getElementById("apercu")!.getBoundingClientRect().top;
    });
  expect(previewTop).toBe(
    (await page.getByRole("banner").boundingBox())!.height,
  );
  const sources = page.getByRole("button", {
    name: "D’où viennent les données ?",
  });
  const sourceReveal = sources.locator(
    "xpath=ancestor::*[@data-landing-reveal][1]",
  );
  await expect(sourceReveal).toHaveCSS("opacity", "1");
  await expect(sourceReveal).toHaveCSS("transform", "none");
  await sources.focus();
  await expect(sourceReveal).toHaveCSS("opacity", "1");
  await expect(sourceReveal).toHaveCSS("transform", "none");
  await page.keyboard.press("Enter");
  await expect(sources).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("region", { name: "D’où viennent les données ?" }),
  ).toContainText("indépendant du service Parcoursup");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Consulter les sources" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  const rates = page.getByRole("button", {
    name: "Le taux d’accès indique-t-il mes chances ?",
  });
  await expect(rates).toBeFocused();
  await page.keyboard.press("Space");
  await expect(rates).toHaveAttribute("aria-expanded", "true");
  await expect(sources).toHaveAttribute("aria-expanded", "false");
  await expect(
    page.getByRole("region", {
      name: "Le taux d’accès indique-t-il mes chances ?",
    }),
  ).toContainText("pas votre probabilité personnelle d’admission");
  await page.keyboard.press("Space");
  await expect(rates).toHaveAttribute("aria-expanded", "false");
  await expect(rates).toBeFocused();
});

test("landing entrances reveal on scroll once and reveal focused controls immediately", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const search = page.getByRole("search", { name: "Trouver une formation" });
  const searchReveal = search.locator(
    "xpath=ancestor::*[@data-landing-reveal][1]",
  );
  await expect(search).not.toBeInViewport();
  await expect(searchReveal).toHaveCSS("opacity", "0");
  await search.scrollIntoViewIfNeeded();
  await expect(searchReveal).toHaveCSS("opacity", "1");
  await expect(searchReveal).toHaveCSS("transform", "none");
  await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();
  await expect(search).not.toBeInViewport();
  await expect(searchReveal).toHaveCSS("opacity", "1");
  await search.scrollIntoViewIfNeeded();
  await expect(searchReveal).toHaveCSS("opacity", "1");
  await expect(searchReveal).toHaveCSS("transform", "none");
  await page.getByRole("heading", { level: 1 }).scrollIntoViewIfNeeded();

  const question = page.getByRole("button", {
    name: "D’où viennent les données ?",
  });
  const questionReveal = question.locator(
    "xpath=ancestor::*[@data-landing-reveal][1]",
  );
  await expect(question).not.toBeInViewport();
  await expect(questionReveal).toHaveCSS("opacity", "0");
  const focusedAppearance = await question.evaluate(async (element) => {
    element.focus({ preventScroll: true });
    await new Promise(requestAnimationFrame);
    const reveal = element.closest("[data-landing-reveal]")!;
    const style = getComputedStyle(reveal);
    return { opacity: style.opacity, transform: style.transform };
  });
  expect(focusedAppearance).toEqual({ opacity: "1", transform: "none" });
  await expect(question).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(question).toHaveAttribute("aria-expanded", "true");
});

test("landing content, navigation and native search remain available without JavaScript", async ({
  browser,
  baseURL,
  page,
}) => {
  const context = await browser.newContext({
    baseURL,
    javaScriptEnabled: false,
    viewport: page.viewportSize(),
  });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto("/");
    await expect(staticPage.getByRole("heading", { level: 1 })).toContainText(
      "Votre orientation,",
    );
    const reveals = staticPage.locator("[data-landing-reveal]");
    expect(await reveals.count()).toBeGreaterThan(0);
    const appearances = await reveals.evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return { opacity: style.opacity, transform: style.transform };
      }),
    );
    for (const appearance of appearances)
      expect(appearance).toEqual({ opacity: "1", transform: "none" });

    await staticPage.getByRole("link", { name: "Voir l’aperçu" }).click();
    await expect(staticPage).toHaveURL(/\/#apercu$/);
    await expect(staticPage.locator("#apercu")).toBeInViewport();

    await staticPage
      .getByRole("navigation", { name: "Navigation d’accueil" })
      .getByRole("link", { name: "Ouvrir l’observatoire" })
      .click();
    await expect(staticPage).toHaveURL(/\/observatoire$/);
    await staticPage.goto("/");
    const search = staticPage.getByRole("search", {
      name: "Trouver une formation",
    });
    await search.scrollIntoViewIfNeeded();
    await search.getByRole("searchbox").fill("école étampes");
    await search
      .getByRole("button", { name: "Rechercher", exact: true })
      .click();
    await expect(staticPage).toHaveURL(
      /\/formations\?q=%C3%A9cole\+%C3%A9tampes$/,
    );
    expect(new URL(staticPage.url()).searchParams.get("q")).toBe(
      "école étampes",
    );
  } finally {
    await context.close();
  }
});

test("landing is accessible in both themes without horizontal page overflow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("region", { name: "Aperçu de l’observatoire" }),
  ).toContainText("Campagne 2025");
  await page
    .getByRole("button", { name: "D’où viennent les données ?" })
    .click();
  for (const [label, theme] of [
    ["Clair", "light"],
    ["Sombre", "dark"],
  ] as const) {
    await page.getByRole("radio", { name: label, exact: true }).click();
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await page.getByRole("radio", { name: label, exact: true }).focus();
    await expect(
      page.getByRole("tooltip", { name: label, exact: true }),
    ).toHaveCSS("opacity", "1");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
});

test("landing search and preview remain usable at a 320 pixel width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  const preview = page.getByRole("region", {
    name: "Aperçu de l’observatoire",
  });
  // Wait for the client-rendered preview before using its accordion control.
  await expect(preview.locator(".recharts-surface")).toBeVisible();
  await preview.getByRole("button", { name: "Voir les valeurs" }).click();
  await expect(
    preview.getByRole("table", {
      name: "Places proposées par campagne et couverture",
    }),
  ).toBeVisible();
  const search = page.getByRole("search", { name: "Trouver une formation" });
  await search.getByRole("searchbox").fill("Droit");
  const questionText = "Faut-il un compte pour garder une sélection ?";
  const question = page.getByRole("button", { name: questionText });
  await question.scrollIntoViewIfNeeded();
  await expect(question).toBeInViewport();
  const questionBounds = await question.boundingBox();
  expect(questionBounds).not.toBeNull();
  expect(questionBounds!.x).toBeGreaterThanOrEqual(0);
  expect(questionBounds!.x + questionBounds!.width).toBeLessThanOrEqual(320);
  const title = question.getByText(questionText, { exact: true });
  const textLayout = await title.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const lines = new Set(
      Array.from(range.getClientRects(), (rect) => Math.round(rect.top)),
    );
    return {
      lines: lines.size,
      fits: element.scrollWidth <= element.clientWidth,
    };
  });
  expect(textLayout.lines).toBeGreaterThan(1);
  expect(textLayout.fits).toBe(true);
  await question.click();
  await expect(page.getByRole("region", { name: questionText })).toContainText(
    "Vos favoris sont enregistrés dans ce navigateur",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await search.getByRole("button", { name: "Rechercher", exact: true }).click();
  await expect(page).toHaveURL(/\/formations\?q=Droit$/);
  await expect(page.getByRole("searchbox")).toHaveValue("Droit");
});
