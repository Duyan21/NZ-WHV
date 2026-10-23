import { spawn } from "node:child_process";
import type { Page } from "playwright";

// ===== CAPTCHA tracking =====

// Only check the path: the CAPTCHA URL also contains the next page's name in its ?redirect=
const isCaptcha = (url: URL) => url.pathname.startsWith("/rs-captcha");

// How many times a watched tab has gone to the CAPTCHA page; lets step/fillPage notice an interruption
let captchaVisits = 0;
const watchedPages: Page[] = [];

// Windows notification (toast) via PowerShell - no extra packages needed
const TOAST_SCRIPT = `
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml('<toast><visual><binding template="ToastGeneric"><text>NZ form: CAPTCHA</text><text>Please complete the CAPTCHA in the browser.</text></binding></visual></toast>')
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show([Windows.UI.Notifications.ToastNotification]::new($xml))
`;

// Get your attention when a CAPTCHA shows: terminal message + beep, browser tab to the front,
// and a Windows notification
function notifyCaptcha(page: Page) {
  console.log("\n\x07>>> CAPTCHA needs you: please complete it in the browser <<<");
  page.bringToFront().catch(() => {});
  if (process.platform === "win32") {
    // -EncodedCommand avoids quoting problems; fire and forget, errors are ignored
    const encoded = Buffer.from(TOAST_SCRIPT, "utf16le").toString("base64");
    spawn("powershell.exe", ["-NoProfile", "-EncodedCommand", encoded], { stdio: "ignore" })
      .on("error", () => {})
      .unref();
  }
}

// Call once on each tab the script uses, so CAPTCHA redirects are counted (and you get notified)
export function watchForCaptcha(page: Page) {
  watchedPages.push(page);
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame() && isCaptcha(new URL(frame.url()))) {
      captchaVisits++;
      notifyCaptcha(page);
    }
  });
}

const onCaptcha = () => watchedPages.some((p) => !p.isClosed() && isCaptcha(new URL(p.url())));

// Wait (no time limit) until no watched tab is on the CAPTCHA page any more
async function waitForCaptchaSolved() {
  console.log("CAPTCHA shown. Please complete it in the browser...");
  for (const p of watchedPages) {
    if (p.isClosed()) continue;
    await p.waitForURL((url) => !isCaptcha(url), { timeout: 0 });
    await p.waitForLoadState();
  }
  console.log("CAPTCHA done, continuing.");
}

// Run one UI interaction; if it fails, rethrow with a label saying which page/field it was.
// If a CAPTCHA interrupted it, wait for you to solve it, then try the step again.
export async function step(label: string, action: () => Promise<void>) {
  const maxAttempts = 5;
  for (let attempt = 1; ; attempt++) {
    const visitsBefore = captchaVisits;
    try {
      await action();
      console.log(`  ok  ${label}`);
      return;
    } catch (err) {
      const interrupted = captchaVisits !== visitsBefore || onCaptcha();
      if (!interrupted || attempt >= maxAttempts) {
        const reason = err instanceof Error ? err.message : String(err);
        throw new Error(`Step failed: ${label}\n${reason}`, { cause: err });
      }
      console.log(`CAPTCHA interrupted "${label}"; it will be retried.`);
      if (onCaptcha()) await waitForCaptchaSolved();
    }
  }
}

// Re-read a value until it matches (the site may post back / reformat), or fail after timeoutMs
async function waitForValue(
  read: () => Promise<string>,
  expected: string,
  timeoutMs = 10_000,
) {
  const deadline = Date.now() + timeoutMs;
  let actual = "";
  while (true) {
    try {
      actual = (await read()).trim();
      if (actual === expected.trim()) return;
    } catch {
      // Page may be mid-postback; try again
    }
    if (Date.now() > deadline) {
      throw new Error(`Expected "${expected}" but the field shows "${actual}"`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

// Text box or date picker: fill it, then check the value stuck
export async function fillText(page: Page, label: string, id: string, value: string) {
  await step(label, async () => {
    const input = page.locator(`#${id}`);
    await input.fill(value);
    await waitForValue(() => input.inputValue(), value);
  });
}

// Select2 dropdown: `id` is the original <select> id; Select2 draws its own box at #s2id_<id>.
// resultsSelector limits the option search to one results list, when needed.
export async function selectDropdown(
  page: Page,
  label: string,
  id: string,
  value: string,
  resultsSelector?: string,
) {
  await step(`${label} = ${value}`, async () => {
    await page.locator(`#s2id_${id}`).click();
    const scope = resultsSelector ? page.locator(resultsSelector) : page;
    await scope.getByRole("option", { name: value, exact: true }).click();
    // Select2 copies the choice into the hidden <select>, so check that
    await waitForValue(
      () =>
        page
          .locator(`#${id}`)
          .evaluate((el: HTMLSelectElement) => el.selectedOptions[0]?.text ?? ""),
      value,
    );
  });
}

// Several Select2 dropdowns at once: answers maps a short name to its value, ids maps it to the <select> id
export async function selectDropdowns<K extends string>(
  page: Page,
  section: string,
  ids: Record<K, string>,
  answers: Record<K, string>,
) {
  for (const key of Object.keys(ids) as K[]) {
    await selectDropdown(page, `${section} > ${key}`, ids[key], answers[key]);
  }
}

// Search box + search button + results list (Industry / Occupation): search, then pick the first result.
// `control` is the shared id prefix, e.g. ContentPlaceHolder1_generalPersonal_industryControl
export async function searchAndPickFirst(
  page: Page,
  label: string,
  control: string,
  searchText: string,
) {
  await step(`${label} search "${searchText}"`, async () => {
    const input = page.locator(`#${control}_optionListSearch_SearchStringTextBox`);
    await input.click();
    // Type key by key (not paste) - the search can break if the code arrives too fast
    await input.clear();
    await input.pressSequentially(searchText, { delay: TYPE_DELAY_MS });
    await page.waitForTimeout(BEFORE_SEARCH_MS);

    await page.locator(`#${control}_optionListSearch_SearchImageButton`).click();
    // Give the search time to run before looking for results
    await page.waitForTimeout(AFTER_SEARCH_MS);

    const firstResult = page.locator(
      `#${control}_optionListSearch_SearchResultRepeater_optionDescriptionButton_0`,
    );
    // The search posts back to the server, so wait as long as it takes for the result -
    // unless a CAPTCHA shows instead (the result would then never appear)
    const outcome = await Promise.race([
      firstResult.waitFor({ state: "visible", timeout: 0 }).then(() => "result", () => "error"),
      page.waitForURL(isCaptcha, { timeout: 0 }).then(() => "captcha", () => "error"),
    ]);
    if (outcome !== "result") throw new Error("Search was interrupted (CAPTCHA?)");

    // Picking the result posts back to the server too; wait for the page to reload (up to 30s),
    // then a few extra seconds so the choice has settled before the next field / Next
    await Promise.all([
      page.waitForEvent("load", { timeout: 30_000 }).catch(() => {}),
      firstResult.click(),
    ]);
    await page.waitForTimeout(PICK_SETTLE_MS);
  });
}

// Industry / Occupation timings - raise them if the site is slow or the search still breaks
const TYPE_DELAY_MS = 150; // between each typed character
const BEFORE_SEARCH_MS = 1_000; // after typing, before clicking the search icon
const AFTER_SEARCH_MS = 3_000; // after clicking the search icon, before looking for results
const PICK_SETTLE_MS = 3_000; // after picking a result, before the next field / Next

// Fill one wizard page. The site can send you to the CAPTCHA at any moment (not only on Next);
// if that happens, wait for you to solve it, then fill the whole page again, because whatever
// was typed before the CAPTCHA may be gone when the site brings you back.
export async function fillPage(
  page: Page,
  name: string,
  pageUrl: RegExp,
  fill: (page: Page) => Promise<void>,
) {
  const maxAttempts = 5;
  for (let attempt = 1; ; attempt++) {
    const visitsBefore = captchaVisits;
    try {
      await fill(page);
      if (captchaVisits === visitsBefore) return;
      console.log(`CAPTCHA interrupted "${name}"; it will be filled again.`);
    } catch (err) {
      const interrupted =
        captchaVisits !== visitsBefore || isCaptcha(new URL(page.url()));
      if (!interrupted) throw err;
      console.log(`CAPTCHA interrupted "${name}".`);
    }
    if (attempt >= maxAttempts) {
      throw new Error(`"${name}" was interrupted by a CAPTCHA ${maxAttempts} times; giving up`);
    }
    // Waits while you solve the CAPTCHA, until the site brings you back to this page
    await waitForWizardPage(page, pageUrl);
  }
}

// Wait until the wizard shows `pageUrl`. If the CAPTCHA page (/rs-captcha?redirect=...) comes first,
// wait while you solve it in the browser; the site then redirects to the page by itself.
export async function waitForWizardPage(page: Page, pageUrl: RegExp) {
  const isTarget = (url: URL) => pageUrl.test(url.pathname);

  await page.waitForURL((url) => isCaptcha(url) || isTarget(url), { timeout: 0 });

  if (isCaptcha(new URL(page.url()))) {
    console.log("CAPTCHA shown. Please complete it in the browser...");
    await page.waitForURL(isTarget, { timeout: 0 });
    console.log("CAPTCHA done, continuing.");
  }
  console.log(`\n== ${new URL(page.url()).pathname}`);
}

// Click the wizard's SAVE button so the page is stored on the site (you can continue later)
export async function clickSave(page: Page) {
  const pagePath = new URL(page.url()).pathname;
  await step("Save", async () => {
    const saveButton = page.getByRole("button", { name: "SAVE" });
    await saveButton.scrollIntoViewIfNeeded();
    // Save posts the form back to the server and reloads the page; wait for that so Next
    // isn't clicked mid-reload. If the page doesn't reload within 30s, carry on anyway.
    const reloaded = await Promise.all([
      page.waitForEvent("load", { timeout: 30_000 }).then(() => true, () => false),
      saveButton.click(),
    ]).then(([didReload]) => didReload);
    if (!reloaded) console.log("  (Save: page didn't reload within 30s, continuing)");
  });

  // The site may show a CAPTCHA after saving; after you solve it, it brings you back to this page
  if (isCaptcha(new URL(page.url()))) {
    console.log("CAPTCHA shown. Please complete it in the browser...");
    await page.waitForURL((url) => url.pathname === pagePath, { timeout: 0 });
    console.log("CAPTCHA done, continuing.");
  }
}

// Click the wizard's Next button and wait for the next page (handling a CAPTCHA in between)
export async function clickNext(page: Page, nextUrl: RegExp) {
  // Optional: uncomment to click SAVE before every Next
  // await clickSave(page);
  await step("Next", async () => {
    const nextButton = page.locator(
      "#ContentPlaceHolder1_wizardPageFooter_wizardPageNavigator_nextImageButton",
    );
    await nextButton.scrollIntoViewIfNeeded();
    await nextButton.click();
  });
  await waitForWizardPage(page, nextUrl);
}
