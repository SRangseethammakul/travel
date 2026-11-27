# Plan PDF is made by the browser's print dialog, not a PDF library

The "บันทึก PDF" button on the Planner opens a print page (`/trips/[id]/plan/print`) that lays out every day of the Trip with `@media print` CSS. The user saves it through the browser's own print dialog ("Save as PDF"), started by `window.print()`. We do not generate PDF bytes ourselves.

The text is almost all Thai. Thai has no spaces between words, so a PDF library has to break lines itself, and client libraries such as `@react-pdf/renderer` and jsPDF do not break Thai correctly. They also need a Thai font embedded in the bundle. The browser already shapes Thai and breaks lines correctly with the fonts the app uses, and the print page can reuse the app's components and the helpers in `lib/plan.ts`.

## Considered Options

- **Client-side PDF library** (`@react-pdf/renderer`, jsPDF): gives a real file with one tap and works inside LINE's in-app browser. Rejected because of bad Thai line breaks, the embedded font and bundle size, and a second layout to maintain.
- **Server-side headless Chrome** (Puppeteer/Playwright): correct Thai and a real file in every browser. Rejected for the MVP because it adds Chromium (~150MB) and memory to the backend, and it has to render pages as the signed-in Member.

## Consequences

- Saving takes one extra step in the OS print sheet, and the result depends a little on the browser (margins, header and footer).
- LINE's in-app browser cannot open the print dialog. The print page detects it and tells the user to open the page in Safari/Chrome.
- No backend change. Any Member who can see the plan can print it.
- If one-tap files become a must, the server-side option is the way to go. The print page can then be the page it renders.
