import { chromium, type Page } from "playwright";
import { applicant } from "./data";
import {
  clickNext,
  fillPage,
  fillText,
  searchAndPickFirst,
  selectDropdown,
  selectDropdowns,
  step,
  waitForWizardPage,
  watchForCaptcha,
} from "./helpers";

const START_URL = "https://www.immigration.govt.nz/";

// Login details come from .env (see .env.example), so they stay out of the code
process.loadEnvFile();
const USERNAME = process.env.NZ_USERNAME ?? "";
const PASSWORD = process.env.NZ_PASSWORD ?? "";

// ===== Country list (/WorkingHoliday/) =====
// Click the country's tile (a link to Application/Create.aspx?CountryId=...) to start a new application
async function startNewApplication(loginPage: Page, country: string) {
  await step(`Start new application for ${country}`, async () => {
    // Match the whole name, ignoring case, so e.g. "SLOVAKIA" can't match another name containing it
    const escaped = country.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const countryName = loginPage
      .locator('[id^="ContentPlaceHolder1_countryRepeater_countryName_"]')
      .filter({ hasText: new RegExp(`^\\s*${escaped}\\s*$`, "i") });
    const tile = loginPage.locator(".category-item a").filter({ has: countryName });

    if ((await tile.count()) === 0) {
      throw new Error(`Country "${country}" is not in the list - check the spelling in data.ts`);
    }
    const status = (
      await tile.locator('[id^="ContentPlaceHolder1_countryRepeater_countryStatus_"]').innerText()
    ).trim();
    if (status !== "OPEN") {
      throw new Error(`"${country}" is ${status}, so a new application can't be started`);
    }
    await tile.click();
  });
}

// ===== Personal - Personal details, address, contact (Personal1.aspx) =====
async function fillPersonalDetails(loginPage: Page) {
  const p = applicant.personal;
  await fillText(loginPage, "Family name", "ContentPlaceHolder1_personDetails_familyNameTextBox", p.familyName);
  await fillText(loginPage, "Given name", "ContentPlaceHolder1_personDetails_givenName1Textbox", p.givenName1);
  // Not used yet:
  // ContentPlaceHolder1_personDetails_givenName2Textbox
  // ContentPlaceHolder1_personDetails_givenName3Textbox
  // ContentPlaceHolder1_personDetails_otherNamesTextBox
  await selectDropdown(loginPage, "Preferred title", "ContentPlaceHolder1_personDetails_titleDropDownList", p.title);
  await fillText(loginPage, "Other title", "ContentPlaceHolder1_personDetails_otherTitleTextBox", p.otherTitle);
  // Gender options are looked up only inside its own results list
  await selectDropdown(loginPage, "Gender", "ContentPlaceHolder1_personDetails_genderDropDownList", p.gender, "#select2-results-2");
  await fillText(loginPage, "Date of birth", "ContentPlaceHolder1_personDetails_dateOfBirthDatePicker_DatePicker", p.dateOfBirth);
  await selectDropdown(loginPage, "Country of birth", "ContentPlaceHolder1_personDetails_CountryDropDownList", p.countryOfBirth);

  // Address
  const a = applicant.address;
  // Not used yet: ContentPlaceHolder1_addressContactDetails_address_streetNumberTextbox
  await fillText(loginPage, "Address line 1", "ContentPlaceHolder1_addressContactDetails_address_address1TextBox", a.address1);
  await fillText(loginPage, "Suburb", "ContentPlaceHolder1_addressContactDetails_address_suburbTextBox", a.suburb);
  await fillText(loginPage, "City", "ContentPlaceHolder1_addressContactDetails_address_cityTextBox", a.city);
  await fillText(loginPage, "Province/State", "ContentPlaceHolder1_addressContactDetails_address_provinceStateTextBox", a.provinceState);
  await fillText(loginPage, "Postal code", "ContentPlaceHolder1_addressContactDetails_address_postalCodeTextBox", a.postalCode);
  await selectDropdown(loginPage, "Address country", "ContentPlaceHolder1_addressContactDetails_address_countryDropDownList", a.country);

  // Contact details
  const c = applicant.contact;
  await fillText(loginPage, "Phone (day)", "ContentPlaceHolder1_addressContactDetails_contactDetails_phoneNumberTextBox", c.phoneDay);
  await fillText(loginPage, "Phone (night)", "ContentPlaceHolder1_addressContactDetails_contactDetails_phoneNumberNightTextBox", c.phoneNight);
  await fillText(loginPage, "Mobile", "ContentPlaceHolder1_addressContactDetails_contactDetails_phoneNumberMobileTextBox", c.phoneMobile);
  await fillText(loginPage, "Fax", "ContentPlaceHolder1_addressContactDetails_contactDetails_faxNumberTextbox", c.fax);
  await fillText(loginPage, "Email", "ContentPlaceHolder1_addressContactDetails_contactDetails_emailAddressTextBox", c.email);
  await selectDropdown(loginPage, "Represented by agent", "ContentPlaceHolder1_hasAgent_representedByAgentDropdownlist", c.representedByAgent);
  await selectDropdown(loginPage, "Communication method", "ContentPlaceHolder1_communicationMethod_communicationMethodDropDownList", c.communicationMethod);
  await selectDropdown(loginPage, "Has credit card", "ContentPlaceHolder1_hasCreditCard_hasCreditCardDropDownlist", c.hasCreditCard);

  // Save button - save the details if you want to continue later and don't have to fill in the details again
  // await loginPage.getByRole('button', { name: 'SAVE' }).click();
  // (or uncomment `await clickSave(page)` in clickNext, helpers.ts, to save before every Next)

  // Move focus away from the Select2 input
  await loginPage.keyboard.press("Tab");
}

// ===== Personal identification (Personal2.aspx) =====
async function fillIdentification(loginPage: Page) {
  const i = applicant.identification;
  await fillText(loginPage, "Passport number", "ContentPlaceHolder1_identification_passportNumberTextBox", i.passportNumber);
  await fillText(loginPage, "Confirm passport number", "ContentPlaceHolder1_identification_confirmPassportNumberTextBox", i.passportNumber);
  await fillText(loginPage, "Passport expiry", "ContentPlaceHolder1_identification_passportExpiryDateDatePicker_DatePicker", i.passportExpiry);
  await selectDropdown(loginPage, "Other identification", "ContentPlaceHolder1_identification_otherIdentificationDropdownlist", i.otherIdentification);
  await fillText(loginPage, "Other ID issue date", "ContentPlaceHolder1_identification_otherIssueDateDatePicker_DatePicker", i.otherIssueDate);
  await fillText(loginPage, "Other ID expiry date", "ContentPlaceHolder1_identification_otherExpiryDateDatePicker_DatePicker", i.otherExpiryDate);
}

// ===== Personal - Occupation details (Personal3.aspx) =====
async function fillOccupation(loginPage: Page) {
  const o = applicant.occupation;
  await searchAndPickFirst(loginPage, "Industry", "ContentPlaceHolder1_generalPersonal_industryControl", o.industryCode);
  await searchAndPickFirst(loginPage, "Occupation", "ContentPlaceHolder1_generalPersonal_occupationControl", o.occupationCode);
}

// ===== Medical details (Medical1.aspx) =====
async function fillMedical(loginPage: Page) {
  await selectDropdowns(loginPage, "Medical", {
    renalDialysis: "ContentPlaceHolder1_medicalConditions_renalDialysisDropDownList",
    tuberculosis: "ContentPlaceHolder1_medicalConditions_tuberculosisDropDownList",
    cancer: "ContentPlaceHolder1_medicalConditions_cancerDropDownList",
    heartDisease: "ContentPlaceHolder1_medicalConditions_heartDiseaseDropDownList",
    disability: "ContentPlaceHolder1_medicalConditions_disabilityDropDownList",
    hospitalisation: "ContentPlaceHolder1_medicalConditions_hospitalisationDropDownList",
    // "residentail" is the site's own spelling
    residentialCare: "ContentPlaceHolder1_medicalConditions_residentailCareDropDownList",
    tbRisk: "ContentPlaceHolder1_medicalConditions_tbRiskDropDownList",
  }, applicant.medical);
}

// ===== Character details (Character.aspx) =====
async function fillCharacter(loginPage: Page) {
  await selectDropdowns(loginPage, "Character", {
    imprisonment5Years: "ContentPlaceHolder1_character_imprisonment5YearsDropDownList",
    imprisonment12Months: "ContentPlaceHolder1_character_imprisonment12MonthsDropDownList",
    deported: "ContentPlaceHolder1_character_deportedDropDownList",
    charged: "ContentPlaceHolder1_character_chargedDropDownList",
    convicted: "ContentPlaceHolder1_character_convictedDropDownList",
    underInvestigation: "ContentPlaceHolder1_character_underInvestigationDropDownList",
    excluded: "ContentPlaceHolder1_character_excludedDropDownList",
    removed: "ContentPlaceHolder1_character_removedDropDownList",
  }, applicant.character);
}

// ===== Working Holiday Specific (WorkingHolidaySpecific.aspx) =====
async function fillWorkingHoliday(loginPage: Page) {
  const { intendedTravelDate, ...answers } = applicant.workingHoliday;
  await selectDropdowns(loginPage, "Working holiday", {
    previousWhsPermitVisa: "ContentPlaceHolder1_offshoreDetails_commonWHSQuestions_previousWhsPermitVisaDropDownList",
    sufficientFundsHoliday: "ContentPlaceHolder1_offshoreDetails_commonWHSQuestions_sufficientFundsHolidayDropDownList",
    beenToNz: "ContentPlaceHolder1_offshoreDetails_beenToNzDropDownList",
    sufficientFundsOnwardTicket: "ContentPlaceHolder1_offshoreDetails_requirementsQuestions_sufficientFundsOnwardTicketDropDownList",
    readRequirements: "ContentPlaceHolder1_offshoreDetails_requirementsQuestions_readRequirementsDropDownList",
  }, answers);
  await fillText(loginPage, "Intended travel date", "ContentPlaceHolder1_offshoreDetails_intendedTravelDateDatePicker_DatePicker", intendedTravelDate);

  // ===== SUBMIT (final submission) - kept commented out on purpose =====
  // NOTE: this sends the whole application to Immigration NZ and can't be undone.
  // Review every page in the browser first. Only uncomment once the full run works reliably
  // (e.g. Industry / Occupation on Personal3 load correctly), or just click SUBMIT yourself.
  //
  // await step("SUBMIT application", async () => {
  //   const submitButton = loginPage.locator(
  //     "#ContentPlaceHolder1_wizardPageFooter_wizardPageNavigator_submitImageButton",
  //   );
  //   await submitButton.scrollIntoViewIfNeeded();
  //   await submitButton.click();
  // });
}

async function main() {
  if (!USERNAME || !PASSWORD) {
    throw new Error("Set NZ_USERNAME and NZ_PASSWORD in .env (see .env.example)");
  }

  // headless: false so you can watch the browser; slowMo makes each step visible
  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
    args: ["--start-maximized"],
  });
  // viewport: null lets the page follow the real (maximized) window size instead of Playwright's 1280x720 default
  const context = await browser.newContext({ viewport: null });
  const page = await context.newPage();
  // The tab that is being filled in; used for the screenshot if something fails
  let currentPage = page;

  // Every step on either tab is retried if a CAPTCHA interrupts it
  watchForCaptcha(page);

  try {
    await step("Open start page", async () => {
      await page.goto(START_URL);
      console.log("Page title:", await page.title());
    });

    await step("Click Login", async () => {
      await page.getByRole("button", { name: "Login" }).click();
    });

    await step('Search "Start"', async () => {
      const search_input = page.locator("#step-input-388");
      await search_input.fill("Start");
      await search_input.press("Enter");
    });

    await step('Search "worki"', async () => {
      const visa_input = page.locator("#step-input-389");
      await visa_input.fill("worki");
      await visa_input.press("Enter");
    });

    // This link opens the login form in a new tab, so start listening before clicking
    let loginPage = page;
    await step("Open login form (new tab)", async () => {
      [loginPage] = await Promise.all([
        context.waitForEvent("page"),
        page.getByRole("link", { name: "Log in or create account" }).click(),
      ]);
    });
    currentPage = loginPage;
    watchForCaptcha(loginPage);
    await loginPage.waitForLoadState();

    await step("Log in", async () => {
      await loginPage.locator('input[name="username"]').fill(USERNAME);
      await loginPage.locator('input[name="password"]').fill(PASSWORD);
      await loginPage.locator('input[type="submit"][value="LOGIN"]').click();
    });

    // After login the site shows the country list (/WorkingHoliday/)
    await waitForWizardPage(loginPage, /^\/WorkingHoliday\/?$/);

    // ===== Option 1 (current): create a NEW application for applicant.country =====
    await startNewApplication(loginPage, applicant.country);

    // The country tile opens /WorkingHoliday/Application/Create.aspx?CountryId=...; click APPLY NOW there
    await waitForWizardPage(loginPage, /\/Application\/Create\.aspx$/);
    await step("Apply now", async () => {
      await loginPage.locator("#ContentPlaceHolder1_applyNowButton").click();
    });

    // ===== Option 2: EDIT an existing application =====
    // NOTE: this was the original flow. To use it, comment out Option 1 above and
    // uncomment the block below. It opens the FIRST application in your list (_0);
    // change the number at the end to open a different one (_1, _2, ...).
    //
    // //===== Select application ===== incase you have existed applications
    // await step("Open first existing application", async () => {
    //   await loginPage
    //     .locator("#ContentPlaceHolder1_applicationList_applicationsDataGrid_editHyperLink_0")
    //     .click();
    // });

    // A CAPTCHA may show here; once you solve it the site goes to Personal1.aspx by itself
    console.log("Waiting for Personal1.aspx (if a different page shows, note its URL)...");
    await waitForWizardPage(loginPage, /Personal1\.aspx/);

    // Wizard pages in order. Next navigates the same tab each time, so keep using loginPage
    const wizardPages = [
      { name: "Personal details", url: /Personal1\.aspx/, fill: fillPersonalDetails },
      { name: "Identification", url: /Personal2\.aspx/, fill: fillIdentification },
      { name: "Occupation", url: /Personal3\.aspx/, fill: fillOccupation },
      { name: "Medical", url: /Medical1\.aspx/, fill: fillMedical },
      { name: "Character", url: /Character\.aspx/, fill: fillCharacter },
      { name: "Working holiday", url: /WorkingHolidaySpecific\.aspx/, fill: fillWorkingHoliday },
    ];

    for (const [index, wizardPage] of wizardPages.entries()) {
      if (index > 0) await clickNext(loginPage, wizardPage.url);
      await fillPage(loginPage, wizardPage.name, wizardPage.url, wizardPage.fill);
    }

    // Stops here on purpose: review the form and do any further pages / submission yourself
    console.log("\nAll pages filled. Nothing has been submitted - please review in the browser.");
  } catch (err) {
    // Don't close on failure, so you can see where it got stuck
    console.error("\nAutomation failed:", err instanceof Error ? err.message : err);
    console.error("Page URL:", currentPage.url());
    const file = `screenshots/failure-${Date.now()}.png`;
    await currentPage
      .screenshot({ path: file, fullPage: true })
      .then(() => console.error("Screenshot saved:", file))
      .catch(() => {});
  }

  // Hand control over to you: the browser stays open until you close the window
  console.log("Browser left open - close the window when finished.");
  await page.waitForEvent("close", { timeout: 0 });
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
