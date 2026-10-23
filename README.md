# NZ Working Holiday form filler

Playwright script that fills in the Immigration NZ Working Holiday application in a visible browser. It stops on the last page - **it does not submit**.

---

## 1. How to run

**First time only**

```bash
npm install
npx playwright install chromium
```

**Create your own data files (required)**

Your personal data is **not** in the repo. Create these two files from the samples:

```bash
cp .env.example .env
cp src/data.example.ts src/data.ts
```

| What | Where |
|---|---|
| Login (username / password) | `.env`:<br>`NZ_USERNAME=...`<br>`NZ_PASSWORD=...` |
| Your answers (names, dates, country, Yes/No, industry & occupation codes) | `src/data.ts` |

Both files are in `.gitignore`, so they stay on your computer only. Edit them, never the `.example` files.

Rules for `src/data.ts`:
- Dropdown values must match the text on the site **exactly** (`"Mr"`, `"Male"`, `"Vietnam"`, `"Yes"`, `"No"`).
- Dates use the site's format: `"1 January, 2000"`.
- `country` = the name on the country tile, e.g. `"THAILAND"`. It must show **OPEN** on the site.
- `""` leaves a field empty.

**Run**

```bash
npm start
```

- You **never press Enter** - the terminal only shows progress (`ok <field>`, `== /page`).
- When it finishes or fails, the browser **stays open**. Close the browser window to end the script.
- If a step fails, the terminal says which one (`Step failed: ...`) and a screenshot is saved in `screenshots/`.

---

## 2. Commented-out scripts - when to use them

### Option 2: edit an existing application - `src/main.ts`
- **Default (Option 1):** create a **new** application for `country` (click country tile → APPLY NOW).
- **Use Option 2 when** you already have an application and want to continue/edit it instead of creating a new one - e.g. when re-running the script many times while testing.
- **How:** comment out the Option 1 lines (`startNewApplication(...)` and the APPLY NOW step), uncomment the Option 2 block. It opens the **first** application in your list (`..._editHyperLink_0`); change `_0` to `_1`, `_2`, ... for another one.

### SAVE - `src/helpers.ts` (in `clickNext`) and `src/main.ts` (Personal details)
- **Off by default.**
- **Use it when** you want each page stored on the site, so you can stop and continue later without refilling.
- **How:** in `clickNext()` uncomment `// await clickSave(page);` to save **before every Next**. Or call `await clickSave(loginPage);` at the end of one page's fill function to save only that page.
- The last page (Working Holiday Specific) has no Next, so it isn't saved by this.

### SUBMIT - `src/main.ts` (end of `fillWorkingHoliday`)
- ⚠️ **Final submission. It cannot be undone.**
- **Off on purpose.** Normally: let the script stop, review every page in the browser, then click SUBMIT yourself.
- **Only uncomment it when** the whole run works reliably (especially Industry/Occupation) and you have checked all answers in `data.ts`.
- **Keep it commented if you had to reload Personal3** during the run (see risks below) - Industry/Occupation may have been skipped.

### Not-yet-used fields - `src/main.ts`
- Given name 2/3, other names, street number are listed as comments. Add them (with a value in `data.ts`) only if you need them.

---

## 3. Risks / problems you may face

**CAPTCHA can appear at any time**
- Especially after running the script many times. It can show after Next, in the middle of a page, during login or APPLY NOW. The page URL looks like `.../rs-captcha?redirect=...`.
- You'll be alerted: terminal message + beep, the tab comes to the front, and a Windows notification. If the Windows pop-up doesn't show, check Focus/Do not disturb and that notifications are allowed for *Windows PowerShell*.
- **Do the CAPTCHA steps and submit it yourself.** The site then redirects back and the script continues on its own. No time limit.
- If it interrupted a page in the middle, that page is **filled again from the top** (what was typed before may be lost). Up to 5 retries.
- If the site redirects somewhere unexpected after the CAPTCHA, the script keeps waiting - you'll see it stuck on `CAPTCHA shown ...`.

**Industry / Occupation search (Personal3) can break**
- Typing the code too fast or clicking search too soon can crash the search. The script types slowly and waits a few seconds after each action.
- If it still fails, increase the timings at the bottom of `searchAndPickFirst` in `src/helpers.ts` (start with `AFTER_SEARCH_MS`, e.g. `5_000`).
- The script picks the **first** search result and doesn't check what got selected - check it on the page.
- **If the Personal3 page crashes:** reload that page in the browser Playwright is running (the one the script opened). The script may then **skip Industry/Occupation** and carry on, leaving them empty or wrong.
  - To be safe, **keep the SUBMIT step commented out** in `fillWorkingHoliday` (`src/main.ts`). The script then stops on the last page, so you can go back to Personal3, check/fix Industry and Occupation manually, and **submit manually** later.

**APPLY NOW creates a new draft every run**
- Running Option 1 many times = many draft applications. Use Option 2 to keep working on the same one.

**Country may be CLOSED**
- The script stops with `"<COUNTRY>" is CLOSED`. Countries open/close over time (e.g. VIETNAM was CLOSED when this was written).

**Unknown page → script waits forever**
- If the site shows a page the script doesn't expect (e.g. something between APPLY NOW and Personal1), it sits on `Waiting for Personal1.aspx ...`. Note the URL - it needs to be added to the script.

**Values must match the site**
- After filling, each value is read back. If the site shows something different (date format, option text), it stops with `Expected "..." but the field shows "..."` → fix `data.ts`.

**Selectors may change**
- If the site changes, a step fails with `Timeout ... exceeded`. Find the new id in DevTools (or `npm run codegen`) and update `src/main.ts`. Most likely to break: `#step-input-388` / `#step-input-389` (start page) and Gender (`#select2-results-2`).

**Same tab after Next**
- Next loads the next page in the **same tab** (`loginPage`). Any new code must use `loginPage`, not `page` (that's the first immigration.govt.nz tab).

**Your answers are your responsibility**
- Medical and character answers are copied from `data.ts` as-is - make sure they are true.

**Private data**
- `.env` has your password and `data.ts` has your personal details, in plain text. Don't share or commit them.
