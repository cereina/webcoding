# Maple — Document studio

A first local version of a Word-to-HTML workbench, built with strict TypeScript and Vite. Brian reviewed architecture, Tom built the interface stylesheet, and Ali built the conversion helpers.

## Run

Requires Node.js 20.19+ or 22.12+.

```sh
npm install
npm run dev
```

Open the local address printed by Vite. For a production build, run `npm run build`; serve the `dist` folder or run `npm run preview`. Run conversion checks with `npm test`.

## First-version features

- Paste rich content from Word, or upload/drop a `.docx` up to 10 MB.
- Edit HTML on the left and view sanitized HTML on the right.
- Framework-neutral HTML with no bundled CSS framework; custom classes can be edited directly.
- Insert information sections, tables, sections, and native expandable content at the cursor.
- Undo/redo imports, typing, and inserted components.
- Review basic heading, image, table, and link checks.
- Preview a narrow page; choose English or French document language.
- Copy or download a sanitized fragment or complete HTML page.

## Scope and limitations

DOCX conversion uses Mammoth and preserves semantic content rather than recreating Word page layout. Complex lists, merged tables, text boxes, tracked changes, headers/footers, and floating images need manual review. Legacy `.doc` and PDF are not supported.

Documents are processed locally, with no upload service or analytics. The preview and complete-page exports use minimal, self-contained styles for readability. No external theme or CSS framework is loaded; fragment exports contain only your HTML. External document images are replaced with an explanatory placeholder; DOCX embedded raster images are included as data URLs. Scripts, inline styles, event handlers, and unsupported markup are stripped from imports, preview, and exports. The editor source is not changed by preview refresh.

The preview is a sandboxed iframe with scripts disabled. Building blocks use plain semantic HTML with no framework classes. User-authored safe classes remain available for integration with your own styles. The Monaco editor includes HTML highlighting, line numbers, folding, suggestions, search, and native undo/redo. The workspace supports resizing and expanded panes. Saved drafts and project presets are future improvements. Work is held in memory: export before closing or refreshing.

Accessibility checks are advisory and do not certify compliance. Language changes set the page language, not a translation. All generated content and component wording should be reviewed before publishing. No deployment has been performed.

## Files

- `index.html`: accessible interface structure.
- `main.ts`: import workflow, editor state, preview, components, and export.
- `converter.ts`: sanitization, review checks, and page generation.
- `styles.css`: responsive interface styling.
- `tests/converter.test.js`: conversion and sanitization regression checks.

Formatting: use Format code above the editor. Word imports, pasted documents, copied HTML, and downloads are automatically indented. Formatting supports Undo and preserves inline text spacing and preformatted content.

## Monaco Editor

Monaco is bundled locally, including its editor and HTML workers. No CDN or editor account is required. Ctrl+F opens search, Ctrl+Space opens suggestions, and Ctrl+M toggles whether Tab moves focus out of the editor. The existing Format code button and formatted export remain available. Microsoft MIT license and third-party notices are included in `public/` and copied into production builds.

## Visual table editor

Use **Edit tables** above the code editor. Its count updates after typing or importing. The dialog detects tables throughout the document, including nested tables, and shows rendered content without HTML source.

- Jump to a table by its caption, or use Previous/Next.
- Add, change, or remove captions.
- Select header rows and columns; selected cells become `th` with `scope="col"` or `scope="row"`. Row-header selection takes precedence at intersections.
- Preview selections immediately. Switching tables preserves pending changes.
- Apply all pending changes together, or Cancel/Escape to discard them. Applied changes support Monaco Undo/Redo.
- Content outside changed tables is preserved. Existing safe `headers` attributes survive cleanup and export.

Merged or uneven tables support captions, cell text, and individual header associations. Bulk header and row/column structure controls remain disabled for these tables. Merge and split controls are described below. These controls help author accessible markup; they do not certify table accessibility.

## TypeScript development

All application modules use `.ts` files with strict type checking. Run `npm run typecheck` for a standalone check; `npm run build` checks types before creating the production bundle. Vite handles the development server and transpilation. Existing JavaScript regression tests import the TypeScript modules through `tsx` when running `npm test`. `dom.ts` validates and types DOM element lookups; `types/mammoth.d.ts` connects the browser bundle to Mammoth’s bundled declarations.

## Table of contents

Use **Table of contents** above the editor to select document headings in a visual dialog. Select all, clear selection, or choose H2 only, and review the live preview before saving. The TOC is inserted after an opening H1 (including within a leading content wrapper), otherwise at the top of the content. Complete HTML documents keep the TOC inside the body.

Selected headings receive unique anchor IDs when needed. Existing unique IDs and unrelated source text are preserved. Reopening a generated TOC restores its selections and updates it rather than creating a duplicate. Save supports Undo/Redo; Cancel leaves the source unchanged. Empty selections cannot be saved.

The title is **On this page** for both English and French, as specified. The dialog uses the page language setting when creating the navigation. The generated `data-maple-toc` marker survives cleanup and export so later edits can identify it.

## Word footnotes

DOCX imports retain footnote/endnote text and link inline reference numbers to their notes. Imported notes include labelled return links to the reference, with French labels when French is selected before importing. Word clipboard named anchors are normalized when present; missing or ambiguous note targets appear in Accessibility review. Upload the original .docx for reliable extraction: pasted content may omit footnote text. Links survive formatting, cleanup, copy, and download. The sandboxed preview uses its own document base so fragment links navigate within the preview.


## Accessibility review and preview selection

The Accessibility review panel groups potential issues and manual review prompts. Select a finding to select its original HTML in Monaco and highlight the corresponding preview element. Document-level findings navigate to the start of the source. Checks cover heading hierarchy, image alternatives, table headers, captions, link names, and missing or ambiguous fragment destinations. Complex table relationships, contrast, reading order, and the quality of descriptions still require human review.

Turn on **Select content** above the preview to click a rendered element and jump to its source. Keyboard users can Tab through preview elements and press Enter or Space. Turn the toggle off to test ordinary links and footnotes. Preview-only source markers and focus attributes never modify editor content or exports. The preview permits same-origin DOM access for navigation while scripts remain disabled by the iframe sandbox; document content remains sanitized.

## Cell and structure editing

Select a displayed cell in Edit tables (keyboard: focus the cell and press Enter). Change Cell text and choose Update cell text, then Apply changes to commit the draft. Replacing text removes inline formatting and links in that cell; untouched cells retain their original content. Cells containing nested tables cannot be replaced.

Add row below, Add column after, Remove row, and Remove column operate on the selected cell in rectangular, unmerged tables without nested tables. At least one row and column remain. For merged or uneven tables, edit individual cell types and choose the headers describing each cell. Explicit associations generate header IDs and headers attributes. Group scopes require suitable existing groups and manual accessibility review. Cancel discards the draft; applied changes support Undo.

## Merge and split cells

Select a cell in Edit tables, then use Merge with right or Merge with below above the preview. Repeat to extend a merged region. Adjacent cells must align and have the same header type and row group. Both cells' rich content is retained. Split cell restores individual cells and leaves combined content in the first cell; the new cells are empty. Cancel discards draft edits, and Undo restores an applied change. Advanced header relationships are collapsed by default.

TOC links follow the document heading hierarchy: selected H2 entries nest inside the parent H1 list item, with the same behavior for H3 through H6. Excluding a parent promotes its children to the nearest included ancestor. To include the opening H1, select it in the TOC dialog. Reopen and save an existing TOC to update its nesting.

## Flexible workspace

Use Workspace above the panes to show both panes, expand the editor, or expand the preview. Drag the divider in split view or focus it and use Left/Right arrows (Home/End jump to the limits). Reset layout restores equal widths and desktop preview. Small screens stack the panes. Preview sizes offer desktop (available space), tablet (768 px), and phone (375 px); fixed previews scroll horizontally when the pane is narrower. Selecting preview content reveals the editor if it was hidden. Layout changes do not alter the document.

## More building blocks

The library includes figures with captions, quotations, definition lists, numbered instructions, related links, contact information, code examples, download links, FAQs, and linked footnotes. Figure inserts an embedded PNG/JPEG/GIF/WebP chosen from your PC (up to 10 MB). Replace its starter alternative text and caption. Other blocks contain example content and URLs to replace before publishing. Footnotes use unique IDs and reciprocal links; French pages use French return labels. Inserts support Undo and formatted export.

## Heading sections

Use Wrap headings in sections above the editor to group each heading and its following content. Lower heading levels become nested sections; equal or higher levels start sibling sections. Existing content containers are retained, and headings inside navigation, tables, lists, and other self-contained components are not restructured. Repeated use avoids duplicate wrappers. The action supports Undo.

## Railway deployment

The Dockerfile builds the Vite application and serves only the generated dist directory through NGINX. It listens on Railway's PORT variable (8080 by default). Deploy the GitHub repository as a Railway service, then generate a public domain targeting the service port. The container contains static application files; document conversion runs in each visitor's browser. No document upload endpoint or database is provisioned.

Local artifacts, test documents, caches, logs, and environment files are excluded from source control and Docker builds. The postponed accessibility/draft-recovery work is backed up locally under artifacts and is not part of this release.

Automatic table headers: In the table dialog, mark header rows/columns (or individual header cells), then choose **Analyze and assign headers**. The tool assigns document-unique IDs and links cells to clear row, column, and grouped headings. Review the draft and choose **Apply changes**. Cancel discards the draft. Valid explicit relationships are preserved. Ambiguous, malformed, nested-container, or oversized tables produce review messages without partial changes. After changing the table structure, review existing relationships; the button preserves them rather than replacing author intent. This assists accessible authoring and does not certify WCAG conformance.
