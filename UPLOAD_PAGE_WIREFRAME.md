# Upload New Beat Page Redesign Wireframes (V3 - Shopify UI Patterns compliant)

## Page Skeleton (Responsive Two-Column Layout)

**<Contextual Save Bar>** *(Appears at top when unsaved changes exist)*
`[Discard]`                                                    `[Save product (Primary Action)]`

**Page Title:** `⬅ Upload New Beat`

---

### Layout Grid

```text
+-------------------------------------------------------------+---------------------------------------+
|                    MAIN COLUMN (2/3)                        |          SIDEBAR COLUMN (1/3)         |
+-------------------------------------------------------------+---------------------------------------+
|                                                             |                                       |
|  [ Card 1: Beat Details ]                                   |  [ Card 4: Status ]                   |
|  - Title                                                    |  - Status Select (Draft/Active)       |
|  - BPM                                                      |  - Missing files warning banner here  |
|  - Key                                                      |    (if applicable, yellow caution)    |
|                                                             |                                       |
|  [ Card 2: Media (2-Column Media Pattern) ]                 |  [ Card 5: Organization ]             |
|  - Left (160px): Cover Art Slot                             |  - Producers Search (Combobox)        |
|  - Right (1fr):  Preview Audio (File Row)                   |  - Tags (PZY)                         |
|                  ------------------ (Divider)               |  - Producer Alias                     |
|                  License Files Upload Array                 |  - Genres Search (Combobox)           |
|                  (File Rows + Add More Button hidden input) |  - Tags (Trap, Hip Hop)               |
|                                                             |                                       |
|  [ Card 3: License packages (Left-Rail navigation) ]        |                                       |
|  - Left Rail (180px): Variant List (Basic, Premium)         |                                       |
|  - Right Panel: Checkbox assignment to current Variant      |                                       |
|                                                             |                                       |
+-------------------------------------------------------------+---------------------------------------+
```

---

## Detailed Views (Main Column)

### Card 1: Beat Details
```text
Beat Title (required)
[_______________________________________]       
(Inline Error text appears here if empty on blur)

BPM (required)                         Key (required)
[__________________]                   [ C minor         v ]
```

### Card 2: Media (Shopify Media Pattern)
```text
(Header) Media

[ Cover Art ]                |  Preview audio (required)
[ Icon: Add image ]          |  [ File Row: MP3 Chip | Preview_Tag.mp3 (2.1MB) | [X] ]
                             |
                             |  ------------------------------------------------------------
                             |  License files
                             |  [ + Add files (Button) ]  (Hidden <input type="file"> pattern)
                             |
                             |  [ File Row: MP3 Chip   | KAROL-G_Full.mp3 (4.2MB) | [X] ]
                             |  [ File Row: Stems Chip | track-stems.zip (1.6MB)  | [X] ]
```

### Card 3: License packages (Left-Rail Navigation Pattern)
**(Solves the massive vertical scrolling issue by using tabs)**
```text
(Header) License packages (Box with border bottom)

+-----------------------+-------------------------------------------------------------+
|  Basic                |  Basic package                                              |
|  $29.99     [⚠️ Icon] |  Assign the downloaded files for merchants who buy this.    |
|-----------------------|                                                             |
|  Premium              |  [x] KAROL-G_Full.mp3  (4.2 MB)                             |
|  $49.99     [✅ Icon] |  [ ] track-stems.zip   (1.6 MB)                             |
|-----------------------|                                                             |
|  Unlimited            |  ⚠️ (Inline Warning Text if required files are unassigned)  |
|  $99.99     [✅ Icon] |                                                             |
+-----------------------+-------------------------------------------------------------+
```
*(Yellow ⚠️ is `AlertDiamondIcon tone="caution"`, Green ✅ is `CheckCircleIcon tone="success"`)*

---

## Detailed Views (Sidebar Column)

### Card 4: Status
```text
Status
[ Draft  v ]

(If missing files on variants:)
[ Banner tone="warning" ]
  There are missing audio files.
  Please assign files to the Basic package before publishing.
```

### Card 5: Organization
```text
Producers
[ Search producers (Combobox) ]
[ PZY [x] ]

Producer Alias 
Alternative name to display
[_________________________]

Genres
[ Search genres (Combobox)    ]
[ Trap [x] ]
```

---
## Component & Style Adherence (SKILL.md check)

- **Layout:** Standard `<Layout.Section>` / `variant="oneThird"`.
- **Text & Copy:** Sentence case headers ("Preview audio" not "Preview Audio"). Used "(required)" subdued text instead of a yellow Badge.
- **Card Action Headers:** Clean Polaris `<Box>` wrapper headers. 
- **Icons & Signals:** Replaced ugly emojis with `AlertDiamondIcon tone="caution"` and `CheckCircleIcon tone="success"`.
- **Component Patterns Direct matches:** Utilizes the exact "Media Card 2-column" layout and "Left-Rail Navigation Panel" definitions from `component-patterns.md`. The File components are rendered as tight `File Row` patterns instead of giant squares. No multiple primary buttons detected. No raw Hex colors stringed.
