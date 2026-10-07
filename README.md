# Documents & Projects Creator

A free, local-first academic document formatter by Akash. Paste your own content, add images, organise sections and export an A4 PDF or editable Word document. Assignment, project and general black book templates.

## Honest scope

This version uses local rules, not a generative AI or a vision model. It recognises headings and proposes image sections using caption / filename words. The user reviews image placement and may change section order. It preserves supplied text rather than inventing research, citations, grades or approvals. It is not a university-approved template. The optional certificate is clearly an unsigned draft.

No paid services, sign-in, card, backend, analytics or automatic uploads. Nothing is saved automatically. Project backups download to the student's own device. Uploaded images are resized to a 1600px maximum edge. Use up to 12 images of 10 MB each and 300,000 text characters. PDF generation can take time on low-memory phones.

PDF output is high-resolution raster pages matching the preview, including Hindi / Unicode rendered by the browser. For selectable text use the print route. DOCX is editable and may reflow in Word or LibreOffice; check the static contents page after editing. Preview uses 12pt-equivalent serif text, 1.6 line spacing, a wider left margin, measured page filling and heading orphan avoidance. New-page-per-section mode is optional; deliberate cover/certificate whitespace is not a pagination error.

## Development

Node 20+: `npm ci` then `npm run build`. Serve this directory as static files. Libraries are bundled locally into `app.js`; runtime needs no third-party CDN. `index.html`, `style.css` and `app.js` are the deploy files. Dependencies: docx (MIT), jsPDF (MIT), html2canvas (MIT). Dependency notices are supplied in the repository.

The example is fictional, and the diagram is illustrative. It must not be submitted as original research.


## Reference-style black book update

Black books use bordered A4 pages, Times-style serif text, centered underlined main headings, justified paragraphs and centered page numbers. Front matter: cover, title page, unsigned director recommendation and certificate templates, acknowledgement, abstract, then contents and numbered chapters. Institution details, degree/university and individual student PRNs are editable. No real student report or private reference details are included in this repository.

Use `# Chapter title` for chapters, `## Subheading` or `1.1 Subheading` for subsections. Separate paragraphs with a blank line. Each black book chapter starts on a new page. PDF matches the preview; DOCX can reflow in another word processor, so check its page numbers after editing.

Current deploy files: `index.html`, `3-creator.css`, `1-creator.js`. Current editable source: `2-creator-source.js`. The unprefixed JS/CSS files are the earlier version and are not used by the updated website. `npm run build` rebuilds the current bundle from `2-creator-source.js`.


## Workflow polish

Text-file import, character count, editable section bodies, confirmed demo/reset replacement, missing-details review notices, preview page navigation, full-size preview and build/export control locking. Project backup format remains compatible with earlier versions. Old public links continue to work at the same GitHub Pages address. This is a local formatter, not a guarantee of research correctness or institution approval.
