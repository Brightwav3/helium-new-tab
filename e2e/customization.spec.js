import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const fixture = fileURLToPath(new URL("../src/assets/extension-icon-128.png", import.meta.url));
const image = { name: "test-image.png", mimeType: "image/png", buffer: await readFile(fixture) };

async function openSettings(page) {
  await page.getByRole("button", { name: "Customize", exact: true }).click();
}

test("loads the bundled variable font and keeps explicit system font choice", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);

  expect(
    await page.evaluate(() => document.fonts.check('500 16px "Instrument Sans Variable"')),
  ).toBe(true);
  await expect(page.locator("#search")).toHaveCSS("font-family", /Instrument Sans Variable/);
  await openSettings(page);
  await expect(page.getByLabel("UI", { exact: true })).toHaveValue("instrument");
  await page.getByLabel("UI", { exact: true }).selectOption("system");
  await page.reload();
  await expect(page.locator("#search")).toHaveCSS("font-family", /system-ui/);
});

test("image picker posts the image directly to Lens as multipart data", async ({ page }) => {
  let upload;
  await page.route("https://lens.google.com/**", async (route) => {
    upload = route.request();
    await route.fulfill({ contentType: "text/html", body: "<title>Image results</title>" });
  });
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Search image with Google Lens" }).click();
  await (await chooser).setFiles(image);
  await expect(page).toHaveTitle("Image results");

  expect(upload.url()).toBe("https://lens.google.com/v3/upload");
  expect(upload.method()).toBe("POST");
  expect(upload.headers()["content-type"]).toContain("multipart/form-data");
  expect(upload.postDataBuffer().includes(image.buffer)).toBe(true);
  expect(upload.postData()).toContain('name="encoded_image"; filename="test-image.png"');
});

test("dropping an image shows a target and sends the same upload", async ({ page }) => {
  await page.route("https://lens.google.com/**", (route) =>
    route.fulfill({ body: "<title>Dropped image</title>" }),
  );
  await page.goto("/");
  const transfer = await page.evaluateHandle(
    (bytes) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(bytes)], "dropped.png", { type: "image/png" }));

      return data;
    },
    [...image.buffer],
  );
  await page.locator("body").dispatchEvent("dragenter", { dataTransfer: transfer });
  await expect(page.locator("#image-drop-zone")).toBeVisible();
  await page.locator("body").dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page).toHaveTitle("Dropped image");
});

test("invalid or undecodable images stay local and show an error", async ({ page }) => {
  const remote = [];
  page.on("request", (request) => {
    if (!request.url().startsWith("http://127.0.0.1")) {
      remote.push(request.url());
    }
  });
  await page.goto("/");
  await page
    .locator("#image-file")
    .setInputFiles({ name: "text.txt", mimeType: "text/plain", buffer: Buffer.from("text") });
  await expect(page.getByRole("status")).toContainText("Choose one");
  await page.locator("#image-file").setInputFiles({
    name: "fake.png",
    mimeType: "image/png",
    buffer: Buffer.from("not an image"),
  });
  await expect(page.getByRole("status")).toContainText("Could not open");
  expect(remote).toEqual([]);
});

test("custom background survives reload, reaches another tab and resets", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await page.goto("/");
  await other.goto("/");
  await openSettings(page);
  await page.locator("#background-file").setInputFiles(image);
  await expect(page.locator("html")).toHaveAttribute("data-custom-background", "true");
  await expect(other.locator("html")).toHaveAttribute("data-custom-background", "true");
  await expect(page.locator("#background-name")).toHaveText("test-image.png");
  expect(
    await page.evaluate(() => getComputedStyle(document.body, "::before").backgroundImage),
  ).not.toContain("gradient");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-custom-background", "true");
  await openSettings(page);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-custom-background");
  await expect(other.locator("html")).not.toHaveAttribute("data-custom-background");
  await page.reload();
  await expect(page.locator("html")).not.toHaveAttribute("data-custom-background");
});

async function mockTopSites(page, allow) {
  await page.addInitScript((granted) => {
    let permission = false;
    window.permissionRequests = 0;
    window.topSitesReads = 0;
    window.chrome ??= {};
    window.chrome.permissions = {
      async request() {
        window.permissionRequests++;
        permission = granted;

        return permission;
      },
      async contains() {
        return permission;
      },
      onRemoved: {
        addListener(listener) {
          window.revokeTopSites = () => {
            permission = false;
            listener({ permissions: ["topSites"] });
          };
        },
      },
    };
    window.chrome.topSites = {
      async get() {
        window.topSitesReads++;

        return [
          { title: "Frequently visited", url: "https://example.org/" },
          { title: "Internal", url: "chrome://settings" },
        ];
      },
    };
  }, allow);
}

test("frequent sites are opt-in and keep manual shortcuts on return or permission removal", async ({
  page,
}) => {
  await mockTopSites(page, true);
  await page.goto("/");
  expect(await page.evaluate(() => window.topSitesReads)).toBe(0);
  await openSettings(page);
  await page.getByRole("switch", { name: "Show pinned sites" }).check();
  await page.getByLabel("Site address", { exact: true }).fill("manual.example.com");
  await page.getByRole("button", { name: "Add site", exact: true }).click();
  await page.getByLabel("Shortcuts", { exact: true }).selectOption("frequent");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pinned-sites a")).toHaveCount(1);
  await expect(page.locator("#pinned-sites a")).toHaveAttribute("href", "https://example.org/");
  expect(await page.evaluate(() => window.permissionRequests)).toBe(1);

  await openSettings(page);
  await page.getByLabel("Shortcuts", { exact: true }).selectOption("manual");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pinned-sites a")).toHaveAttribute(
    "href",
    "https://manual.example.com/",
  );

  await openSettings(page);
  await page.getByLabel("Shortcuts", { exact: true }).selectOption("frequent");
  await page.evaluate(() => window.revokeTopSites());
  await expect(page.getByLabel("Shortcuts", { exact: true })).toHaveValue("manual");
  await page.keyboard.press("Escape");
  await expect(page.locator("#pinned-sites a")).toHaveAttribute(
    "href",
    "https://manual.example.com/",
  );
});

test("declining top sites permission leaves the manual list selected", async ({ page }) => {
  await mockTopSites(page, false);
  await page.goto("/");
  await openSettings(page);
  await page.getByLabel("Shortcuts", { exact: true }).selectOption("frequent");
  await expect(page.getByLabel("Shortcuts", { exact: true })).toHaveValue("manual");
  expect(await page.evaluate(() => window.topSitesReads)).toBe(0);
});

test("centers the content with and without clock, date and shortcuts", async ({ page }) => {
  await page.setViewportSize({ width: 970, height: 834 });
  await page.goto("/");

  for (const showClock of [false, true]) {
    for (const showPinnedSites of [false, true]) {
      await page.evaluate(
        ({ showClock, showPinnedSites }) => {
          localStorage.setItem(
            "helium-tab",
            JSON.stringify({ showClock, showDate: showClock, showPinnedSites }),
          );
          localStorage.setItem(
            "helium-tab-sites",
            JSON.stringify({ sites: [{ title: "Example", url: "https://example.com/" }] }),
          );
        },
        { showClock, showPinnedSites },
      );
      await page.reload();
      if (showClock) {
        await expect(page.locator("#clock-block")).toHaveAttribute("data-ready", "true");
      } else {
        await expect(page.locator("#clock-block")).toBeHidden();
      }

      await page.evaluate(() => document.fonts.ready);
      const content = await page.locator(".start").boundingBox();

      expect(Math.abs(content.y + content.height / 2 - 417)).toBeLessThan(2);
      expect(Math.abs(content.x + content.width / 2 - 485)).toBeLessThan(2);
    }
  }
});

test("footer shows only the accessible settings icon", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("footer")).toHaveText("");
  await expect(page.locator("footer button svg")).toBeVisible();
  await expect(page.getByRole("button", { name: "Customize", exact: true })).toHaveCSS(
    "background-color",
    "rgba(0, 0, 0, 0)",
  );
  await openSettings(page);
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("search placeholder centering switches immediately and persists", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#search")).toHaveCSS("text-align", "center");
  await openSettings(page);
  await page.getByRole("switch", { name: "Center search placeholder" }).uncheck();
  await page.keyboard.press("Escape");

  await expect(page.locator("#search")).not.toHaveCSS("text-align", "center");
  await page.reload();
  await expect(page.locator("#search")).not.toHaveCSS("text-align", "center");
  await openSettings(page);
  await expect(page.getByRole("switch", { name: "Center search placeholder" })).not.toBeChecked();
  await page.getByRole("switch", { name: "Center search placeholder" }).check();
  await page.keyboard.press("Escape");
  await expect(page.locator("#search")).toHaveCSS("text-align", "center");
  await page.locator("#search").fill("test query");
  await expect(page.locator("#search")).not.toHaveCSS("text-align", "center");
  await page.reload();
  await expect(page.locator("#search")).toHaveCSS("text-align", "center");
});
