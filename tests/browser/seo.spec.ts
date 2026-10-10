import { expect, test } from "./fixtures";

const crawler = { "User-Agent": "Twitterbot/1.0" };
const locations = (xml: string) =>
  [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
const localPath = (url: string) => new URL(url).pathname + new URL(url).search;

test("robots and all advertised sitemaps expose the complete published fixture campaigns @smoke", async ({
  request,
}) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  expect(await robots.text()).toContain(
    "Sitemap: https://gradavia.com/sitemap.xml",
  );
  expect(await robots.text()).not.toContain("Disallow: /formations");
  const index = await request.get("/sitemap.xml");
  expect(index.headers()["content-type"]).toContain("application/xml");
  const maps = locations(await index.text());
  expect(maps).toHaveLength(4);
  const seen = new Set<string>();
  for (const url of maps) {
    const response = await request.get(localPath(url));
    expect(response.status()).toBe(200);
    const urls = locations(await response.text());
    const expected = url.includes("formations")
      ? 31
      : url.includes("apprentissage")
        ? 1
        : url.includes("apb")
          ? 1
          : 13;
    expect(urls).toHaveLength(expected);
    for (const entry of urls) {
      expect(entry.startsWith("https://gradavia.com/")).toBe(true);
      expect(seen.has(entry)).toBe(false);
      seen.add(entry);
    }
    expect(
      urls.some(
        (entry) =>
          /comparer|localhost/.test(entry) ||
          entry === "https://gradavia.com/favoris",
      ),
    ).toBe(false);
  }
});

test("crawler HTML includes distinct metadata and safe structured data before JavaScript", async ({
  request,
}) => {
  const home = await request.get("/", { headers: crawler });
  const html = await home.text();
  const head = html.split("</head>")[0]!;
  expect(head).toContain("https://gradavia.com/");
  expect(head).toContain('property="og:title"');
  expect(head).toContain('name="twitter:card" content="summary_large_image"');
  expect(html).toContain('"@type":"WebSite"');
  for (const sitemap of ["formations", "apprentissage", "apb"]) {
    const xml = await (await request.get(`/sitemap-${sitemap}.xml`)).text();
    const url = locations(xml)[0]!;
    const response = await request.get(localPath(url), { headers: crawler });
    expect(response.status()).toBe(200);
    const body = await response.text();
    const detailHead = body.split("</head>")[0]!;
    expect(detailHead).toContain(`<link rel="canonical" href="${url}"`);
    expect(detailHead).toMatch(/<title>[^<]*démonstration[^<]*<\/title>/);
    expect(detailHead).toContain(sitemap === "apb" ? "2017" : "2025");
    expect(body).toContain('"@type":"BreadcrumbList"');
    expect(body).toContain('aria-label="Fil d’Ariane"');
  }
});

test("pagination has its own canonical while search and private selections are noindex", async ({
  page,
}) => {
  await page.goto(
    "/formations?campagne=2025&page=2&utm_source=test&vue=cartes",
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://gradavia.com/formations?page=2",
  );
  await expect(page).toHaveTitle(/2025.*page 2/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  await page.goto("/formations?q=Droit");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await page.goto("/favoris");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
});

test("all formation links and pagination work without JavaScript", async ({
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
    await staticPage.goto("/formations");
    const directory = staticPage
      .locator("details")
      .filter({ hasText: "Toutes les formations de cette page" });
    await expect(directory.locator('a[href^="/formations/"]')).toHaveCount(25);
    await directory.locator("summary").focus();
    await staticPage.keyboard.press("Enter");
    await expect(directory).toHaveAttribute("open", "");
    await directory.locator("a").first().click();
    await expect(staticPage.getByRole("heading", { level: 1 })).not.toBeEmpty();
    await expect(
      staticPage.getByRole("navigation", { name: "Fil d’Ariane" }),
    ).toBeVisible();
    await staticPage.goto("/formations");
    await staticPage
      .getByRole("link", { name: "Suivante", exact: true })
      .click();
    await expect(staticPage).toHaveURL(/page=2/);
    await expect(
      staticPage
        .locator("details")
        .filter({ hasText: "Toutes les formations de cette page" })
        .locator("a"),
    ).toHaveCount(6);
    await staticPage
      .getByRole("navigation", { name: "Campagnes Parcoursup" })
      .getByRole("link", { name: "2018", exact: true })
      .click();
    await expect(staticPage).toHaveURL(/campagne=2018$/);
    await expect(
      staticPage
        .getByRole("navigation", { name: "Campagnes Parcoursup" })
        .getByRole("link", { name: "2018", exact: true }),
    ).toHaveAttribute("aria-current", "page");
  } finally {
    await context.close();
  }
});

test("unknown formations remain excluded and the social preview is a real image", async ({
  request,
}) => {
  const missing = await request.get("/formations/not-a-formation", {
    headers: crawler,
  });
  // Streaming data routes can carry a 200 transport status; Next emits noindex.
  expect(await missing.text()).toContain('name="robots" content="noindex"');
  const image = await request.get("/opengraph-image");
  expect(image.status()).toBe(200);
  expect(image.headers()["content-type"]).toContain("image/png");
  const png = await image.body();
  expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
  expect(png.readUInt32BE(16)).toBe(1200);
  expect(png.readUInt32BE(20)).toBe(630);
});
