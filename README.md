# WebViewer read-only form-field render bug — repro

Minimal client-only reproduction for **@pdftron/webviewer 11.13.0** with **`fullAPI: true`**.

## Run

```bash
npm install
npm start
```

Opens at http://localhost:3000. When it says *"ready"*, click **Switch to View mode (read-only)**.

## The bug

When form-field widgets are flagged read-only at runtime via
`WidgetFlags.READ_ONLY` — exactly what our viewer does when the user switches
from the **Annotate** toolbar group to the **View** toolbar group — the **live
viewer re-renders the widgets incorrectly**:

- a **checked checkbox loses its checkmark** (renders unchecked), and
- **text fields render blank**.

…even though the underlying values are completely intact. This is purely
WebViewer's **on-screen read-only renderer** — not a data loss and not a
saved-appearance problem (see "Why the live viewer" below).

### Trigger (the exact Core-API our app runs on entering View mode)

See `src/App.tsx`, `setReadOnly()`, which mirrors our real `handleToolbarGroupChange`:

```js
const { annotationManager, Annotations } = instance.Core;
const fm = annotationManager.getFieldManager();

fm.getFields().forEach((field) =>
  field.widgets?.forEach((w) =>
    w.fieldFlags.set(Annotations.WidgetFlags.READ_ONLY, true)
  )
);
annotationManager.getAnnotationsList().forEach((annot) => {
  annot.ReadOnly = true;
  if (annot instanceof Annotations.WidgetAnnotation && annot.element) {
    annot.element.style.setProperty("pointer-events", "none");
  }
});
```

- **Sample PDF:** `public/files/readonly-form-bug.pdf` (regenerate with `node tools/make-sample-pdf.cjs`).
- **Checkbox field that goes blank:** `optNewsletter` (checked in the source PDF).
- **Text fields that go blank:** `applicantName` (`Max Mustermann`), `referenceNumber` (`REF-2024-0001`), `salutation` (`Herr`), `birthDate` (`1990-01-01`).

## Steps

1. `npm start` → wait for *"ready"*. The checkbox is **checked** and the text
   fields show their values.
2. Click **Switch to View mode (read-only)**.
   - **Expected:** the form still shows the checkbox checked and the text values.
   - **Actual (bug):** the checkbox renders **unchecked** and the text fields
     render **blank**.
3. Look at the dark **live `getValue()` bar** at the top: every value is still
   correct (`optNewsletter=Yes`, `applicantName=Max Mustermann`, …) — the data
   is intact, only the render is wrong.
4. Click **Switch to Annotate mode (editable)** → the render is fully restored
   (checkmark and text come back). The bug is reversible and tied solely to the
   read-only flag.
5. Click **Download exported PDF (it's fine)** → open `exported.pdf` in Acrobat:
   the checkbox is checked and the text is present, confirming the saved data /
   appearance is correct.

## Why the live viewer (not export) is where to look

The data and the **exported** appearance are both correct: `getFileData()`
produces a PDF whose checkbox is `/V /Yes /AS /Yes` and whose text fields contain
their `Tj` strings. The defect is only in how WebViewer **renders read-only
widgets on screen**. So:

- watching the **live viewer toggle** between Annotate and View mode is the
  deterministic way to see it, and
- the **downloadable PDF being correct** is the counter-proof that isolates the
  problem to the on-screen read-only renderer.
