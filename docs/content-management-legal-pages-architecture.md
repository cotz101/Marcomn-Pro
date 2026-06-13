# MarComn Content Management & Legal Pages Architecture v1

## 1. Objective
- Admin-managed content, not hardcoded pages
- Supports MarComn’s WordPress-style global settings direction
- Starts with Credits and Payment Policies pages
- Supports Global Content Variables to avoid hardcoded pricing/fee information
- Pulls live configurations dynamically (e.g. active MCredit packages, exchange rates) from the single source of truth (`platform_settings`) rather than duplicating them in static CMS content

## 2. Initial Public Pages
- **/credits**
  - MCredits pricing, packages, and how it works (pulls live packages from `platform_settings.mcredit_topup_packages`)
- **/legal/payments**
  - MCredit terms, refund policy, payment disputes, billing support (resolves settings like job posting and job acceptance fees dynamically)

## 3. Future Public Pages
- **/legal/terms**
- **/legal/privacy**
- **/about**
- **/help**
- **/faq**

## 4. Database Architecture

### `cms_pages`
- **Purpose**: Defines top-level pages accessible via specific routes.
- **Proposed Columns**:
  - `id` (UUID, PK)
  - `slug` (String, unique) - e.g., 'credits', 'legal/payments'
  - `title` (String)
  - `meta_description` (Text)
  - `is_published` (Boolean, default: false)
  - `created_at` (Timestamp)
  - `updated_at` (Timestamp)
- **Sample Records**:
  - `slug`: 'credits', `title`: 'MCredits Guide', `is_published`: true
  - `slug`: 'legal/payments', `title`: 'Payment Policies', `is_published`: true

### `cms_page_sections`
- **Purpose**: Contains the modular content blocks for each page.
- **Proposed Columns**:
  - `id` (UUID, PK)
  - `page_id` (UUID, FK to cms_pages)
  - `section_key` (String) - e.g., 'hero', 'pricing', 'terms'
  - `title` (String)
  - `content` (Text) - Support templated placeholders like `{{mcredits_per_usd}}` or `{{company_job_posting_fee_percent}}`
  - `sort_order` (Integer)
  - `is_active` (Boolean, default: true)
  - `created_at` (Timestamp)
  - `updated_at` (Timestamp)
- **Sample Records**:
  - `page_id`: [credits-page-id], `title`: 'What is MCredit?', `sort_order`: 10
  - `page_id`: [payments-page-id], `title`: 'Refund Policy', `sort_order`: 20

### `cms_faqs`
- **Purpose**: Manages global and page-specific frequently asked questions.
- **Proposed Columns**:
  - `id` (UUID, PK)
  - `page_id` (UUID, FK to cms_pages, nullable) - If null, it's a global FAQ
  - `question` (String)
  - `answer` (Text) - Supports templated placeholders
  - `sort_order` (Integer)
  - `is_published` (Boolean, default: true)
  - `created_at` (Timestamp)
  - `updated_at` (Timestamp)
- **Sample Records**:
  - `page_id`: [credits-page-id], `question`: 'Do MCredits expire?', `answer`: 'No, MCredits never expire.'

### `cms_content_variables` / `cms_settings`
- **Purpose**: Key-value pairs for global CMS variables. Additionally, the system resolves variables by querying standard platform configurations.
- **Proposed Columns**:
  - `id` (UUID, PK)
  - `variable_key` (String, unique) - e.g., 'support_email', 'terms_version'
  - `value` (Text)
  - `description` (Text)
  - `created_at` (Timestamp)
  - `updated_at` (Timestamp)
- **Sample Records**:
  - `variable_key`: 'support_email', `value`: 'support@marcomn.com'

## 5. Admin Permissions
**Propose**:
- `can_manage_content_pages` (Boolean)
- `can_manage_faqs` (Boolean)

**Clarify**:
- **Super Admin** can manage all content.
- **Content/Marketing Admin** can manage content (pages, sections, FAQs, CMS settings).
- **Support Admin** cannot edit content.
- **Public users** can only read published content.

## 6. Admin UI Plan
**Route**:
- `/admin/content`

**Tabs**:
- Pages
- Sections
- FAQs
- Variables

**Admin capabilities**:
- create/edit page
- publish/unpublish
- edit sections
- reorder sections
- add/edit/hide FAQs
- manage content variables

## 7. Public Rendering Rules
- Only published pages are visible.
- Only active sections are visible.
- Sections are ordered by `sort_order`.
- FAQs are ordered by `sort_order`.
- **Placeholder Replacement**: Content and answers are parsed for placeholders like `{{key}}` and replaced with variables from `cms_content_variables` or `platform_settings` (e.g. `{{mcredits_per_usd}}`, `{{company_job_posting_fee_percent}}`, `{{candidate_acceptance_fee_percent}}`).
- **Dynamic Content Injection**: If a section references preset packages (e.g., `section_key = 'pricing'`), the rendering UI fetches active packages from `platform_settings.mcredit_topup_packages` and renders them dynamically rather than writing hardcoded lists.
- **Fallback behavior**: If a page is missing or unpublished, return a 404 (Not Found) or a friendly fallback message.

## 8. Initial Content Structure

### For `/credits`
- What is MCredit?
- Current Exchange Rate (dynamic using `{{mcredits_per_usd}}`)
- Available Packages (dynamically populated from `platform_settings.mcredit_topup_packages`)
- How Top-Ups Work
- What MCredits Can Be Used For
- FAQ

### For `/legal/payments`
- MCredit Terms
- Refund Policy
- Payment Disputes
- Billing Support Contact (using `{{support_email}}`)

### Current MarComn Business Rules
- MCredit rate configurable by Super Admin (via `platform_settings.mcredits_per_usd`)
- Launch rate: 1 MCredit = USD 1
- MCredits are not transferable
- MCredits never expire
- Refunds allowed only for duplicate payment, technical error, incorrect crediting, or unauthorized charge investigation
- Job posting fee configurable (via `platform_settings.company_job_posting_fee_percent`)
- Job acceptance fee configurable (via `platform_settings.candidate_acceptance_fee_percent`)
- Payment issues handled through MarComn Support for now

## 9. Implementation Stages
- **Stage CMS-1**: Create architecture doc only (Completed)
- **Stage CMS-2**: Create database tables and seed initial pages (In Progress)
- **Stage CMS-3**: Build public `/credits` and `/legal/payments` pages
- **Stage CMS-4**: Build `/admin/content` management UI
- **Stage CMS-5**: Link pages from wallet modal/footer

## 10. Non-goals for v1
- No complex rich text editor yet
- No page builder layout system yet
- No media library yet
- No multilingual support yet
- No public dispute ticket portal yet
